"""
Core matching engine for the CV-Job Matching pipeline.

This module wires together the semantic encoder (a SentenceTransformer
model -- by default the fine-tuned ``BAAI/bge-large-en-v1.5`` and a
multilingual ``BAAI/bge-m3`` fallback), the lexical TF-IDF backstop,
the curated :class:`SkillGraph` and the URL evidence collector.

The output is a single ``match`` dict suitable for serving via an API,
persisting to the database layer or rendering as a report.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

# scikit-learn is a hard dep
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# langdetect is used to pick the right encoder
try:
    from langdetect import detect, DetectorFactory  # type: ignore

    DetectorFactory.seed = 0  # deterministic detection
except Exception:  # pragma: no cover - graceful degradation
    detect = None  # type: ignore
    DetectorFactory = None  # type: ignore

# sentence_transformers is the embedding backend
try:
    from sentence_transformers import SentenceTransformer  # type: ignore
except Exception:  # pragma: no cover
    SentenceTransformer = None  # type: ignore


# ---------------------------------------------------------------------------
# Sibling-module imports (work both when run as a package and as a script)
# ---------------------------------------------------------------------------
try:
    from app.skill_graph import SkillGraph  # type: ignore
except ImportError:  # pragma: no cover
    try:
        from .skill_graph import SkillGraph  # type: ignore
    except ImportError:
        from skill_graph import SkillGraph  # type: ignore

try:
    from app.url_reader import analyze_urls  # type: ignore
except ImportError:  # pragma: no cover
    try:
        from .url_reader import analyze_urls  # type: ignore
    except ImportError:
        from url_reader import analyze_urls  # type: ignore

try:
    from app.pdf_extractor import PDFExtractor  # type: ignore
except ImportError:  # pragma: no cover
    try:
        from .pdf_extractor import PDFExtractor  # type: ignore
    except ImportError:
        from pdf_extractor import PDFExtractor  # type: ignore


logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
PRIMARY_BASE_MODEL = "BAAI/bge-base-en-v1.5"
MULTILINGUAL_MODEL = "BAAI/bge-m3"

NON_ENGLISH_LANGS = {"fr", "ar", "es", "de", "zh", "ja", "ko"}

URL_BOOST_CAP = 15.0  # max raw URL boost contribution to total_score


# ---------------------------------------------------------------------------
# MatchingEngine
# ---------------------------------------------------------------------------
class MatchingEngine:
    """End-to-end CV/Job matcher with two embedding backends."""

    def __init__(self, model_dir: str = "app/models/cv-matcher-finetuned") -> None:
        self.start_time: float = time.time()
        self.model_dir: str = model_dir
        self.models_loaded: List[str] = []
        self.model_used: str = "unknown"

        # Primary encoder: prefer the fine-tuned snapshot, fall back to base.
        self._primary_model = None
        self._primary_name: str = PRIMARY_BASE_MODEL
        self._load_primary_model(model_dir)

        # Multilingual encoder is loaded lazily.
        self._multilingual_model = None
        self._multilingual_name: str = MULTILINGUAL_MODEL

        # Skill graph + supporting components.
        self.skill_graph: SkillGraph = SkillGraph()
        self.pdf_extractor: PDFExtractor = PDFExtractor()

        # Default to whatever primary model name we resolved.
        self.model_used = self._primary_name

    # ------------------------------------------------------------------ #
    # Model loading
    # ------------------------------------------------------------------ #
    def _load_primary_model(self, model_dir: str) -> None:
        """Try to load the fine-tuned model, otherwise fall back to base."""
        if SentenceTransformer is None:
            logger.warning(
                "sentence_transformers not installed; semantic scoring disabled."
            )
            return

        finetuned_path = Path(model_dir)
        if finetuned_path.exists() and finetuned_path.is_dir():
            try:
                logger.info("Loading fine-tuned primary model from %s", finetuned_path)
                self._primary_model = SentenceTransformer(str(finetuned_path))
                self._primary_name = f"finetuned:{finetuned_path.name}"
                self.models_loaded.append(self._primary_name)
                return
            except Exception as e:
                logger.warning(
                    "Failed to load fine-tuned model from %s: %s. "
                    "Falling back to base model.", finetuned_path, e
                )

        try:
            logger.info("Loading base primary model %s", PRIMARY_BASE_MODEL)
            self._primary_model = SentenceTransformer(PRIMARY_BASE_MODEL)
            self._primary_name = PRIMARY_BASE_MODEL
            self.models_loaded.append(self._primary_name)
        except Exception as e:
            logger.error("Failed to load base primary model: %s", e)
            self._primary_model = None

    def _load_multilingual_model(self) -> None:
        """Load the multilingual fallback on first use."""
        if self._multilingual_model is not None:
            return
        if SentenceTransformer is None:
            logger.warning(
                "sentence_transformers not installed; multilingual model unavailable."
            )
            return
        try:
            logger.info("Loading multilingual model %s", MULTILINGUAL_MODEL)
            self._multilingual_model = SentenceTransformer(MULTILINGUAL_MODEL)
            if self._multilingual_name not in self.models_loaded:
                self.models_loaded.append(self._multilingual_name)
        except Exception as e:
            logger.error("Failed to load multilingual model: %s", e)
            self._multilingual_model = None

    # ------------------------------------------------------------------ #
    # Language detection / model selection
    # ------------------------------------------------------------------ #
    @staticmethod
    def _detect_language(text: str) -> str:
        """Robust language detection. Defaults to 'en' on any failure."""
        if not text or detect is None:
            return "en"
        snippet = text.strip()
        if len(snippet) < 20:
            return "en"
        try:
            return detect(snippet[:2000])
        except Exception:
            return "en"

    def _select_model(self, language: str):
        """Return the encoder + its display name for the given language."""
        if language in NON_ENGLISH_LANGS:
            self._load_multilingual_model()
            if self._multilingual_model is not None:
                return self._multilingual_model, self._multilingual_name
            logger.warning(
                "Multilingual model unavailable; using primary for language=%s",
                language,
            )
        return self._primary_model, self._primary_name

    # ------------------------------------------------------------------ #
    # Embedding & similarity primitives
    # ------------------------------------------------------------------ #
    def _get_embedding(self, text: str, model_name: str = "primary") -> np.ndarray:
        """Encode *text* with the requested backend and L2-normalise it."""
        if model_name == "multilingual":
            self._load_multilingual_model()
            model = self._multilingual_model
        else:
            model = self._primary_model

        if model is None or not text:
            return np.zeros(1, dtype=np.float32)

        emb = model.encode(text, show_progress_bar=False, convert_to_numpy=True)
        emb = np.asarray(emb, dtype=np.float32)
        norm = np.linalg.norm(emb)
        if norm > 0:
            emb = emb / norm
        return emb

    @staticmethod
    def _embed_with(model, text: str) -> Optional[np.ndarray]:
        """Encode + normalise using a specific *model* instance."""
        if model is None or not text:
            return None
        emb = model.encode(text, show_progress_bar=False, convert_to_numpy=True)
        emb = np.asarray(emb, dtype=np.float32)
        norm = np.linalg.norm(emb)
        if norm > 0:
            emb = emb / norm
        return emb

    def _semantic_similarity(self, cv_text: str, job_text: str, model) -> float:
        """Cosine similarity between CV and job embeddings on a 0..100 scale."""
        if not cv_text or not job_text or model is None:
            return 0.0
        cv_emb = self._embed_with(model, cv_text)
        job_emb = self._embed_with(model, job_text)
        if cv_emb is None or job_emb is None:
            return 0.0
        try:
            sim = float(
                cosine_similarity(cv_emb.reshape(1, -1), job_emb.reshape(1, -1))[0, 0]
            )
        except Exception as e:
            logger.warning("Cosine similarity failed: %s", e)
            return 0.0
        # Cosine is in [-1, 1]; clamp to [0, 1] then scale to 0..100.
        sim = max(0.0, min(sim, 1.0))
        return round(sim * 100.0, 2)

    def _tfidf_similarity(self, cv_text: str, job_text: str) -> float:
        """TF-IDF cosine similarity on a 0..100 scale."""
        if not cv_text or not job_text:
            return 0.0
        try:
            vectorizer = TfidfVectorizer(
                stop_words="english",
                max_features=10000,
                ngram_range=(1, 2),
            )
            matrix = vectorizer.fit_transform([cv_text, job_text])
            sim = float(cosine_similarity(matrix[0], matrix[1])[0, 0])
        except Exception as e:
            logger.warning("TF-IDF similarity failed: %s", e)
            return 0.0
        sim = max(0.0, min(sim, 1.0))
        return round(sim * 100.0, 2)

    # ------------------------------------------------------------------ #
    # Section-level scoring
    # ------------------------------------------------------------------ #
    def _compute_section_scores(
        self, cv_text: str, job_text: str, model
    ) -> Dict[str, float]:
        """Embed each detected CV section and compare to the full job text."""
        if not cv_text or not job_text or model is None:
            return {}

        try:
            sections = self.pdf_extractor.extract_sections(cv_text) or {}
        except Exception as e:
            logger.warning("Section extraction failed: %s", e)
            return {}

        target_sections = ("experience", "skills", "education", "projects")

        job_emb = self._embed_with(model, job_text)
        if job_emb is None:
            return {}

        out: Dict[str, float] = {}
        for name in target_sections:
            body = (sections.get(name) or "").strip()
            if not body:
                continue
            sec_emb = self._embed_with(model, body)
            if sec_emb is None:
                continue
            try:
                sim = float(
                    cosine_similarity(
                        sec_emb.reshape(1, -1), job_emb.reshape(1, -1)
                    )[0, 0]
                )
            except Exception:
                continue
            sim = max(0.0, min(sim, 1.0))
            out[name] = round(sim * 100.0, 2)
        return out

    # ------------------------------------------------------------------ #
    # End-to-end matching
    # ------------------------------------------------------------------ #
    def match(self, cv_text: str, job_text: str) -> Dict[str, Any]:
        """Run the full matching pipeline against a single CV / job pair."""
        cv_text = cv_text or ""
        job_text = job_text or ""

        # 1) Language detection
        language = self._detect_language(cv_text)

        # 2) Model selection (loads bge-m3 lazily for non-English)
        model, model_name = self._select_model(language)
        self.model_used = model_name

        # 3) Semantic similarity (CV vs Job)
        semantic_score = self._semantic_similarity(cv_text, job_text, model)

        # 4) TF-IDF similarity
        tfidf_score = self._tfidf_similarity(cv_text, job_text)

        # 5) Skill graph scoring
        try:
            skill_result = self.skill_graph.score_cv_against_job(cv_text, job_text)
        except Exception as e:
            logger.warning("SkillGraph scoring failed: %s", e)
            skill_result = {
                "cv_skills": [],
                "job_skills": [],
                "matched_skills": [],
                "partial_skills": [],
                "missing_skills": [],
                "skill_proximity_score": 0.0,
            }

        skill_proximity_score = float(
            skill_result.get("skill_proximity_score", 0.0) or 0.0
        )

        # 6) URL analysis (uses extracted job skills as relevance amplifier)
        try:
            job_skills = self.skill_graph.extract_skills(job_text)
            url_result = analyze_urls(cv_text, job_skills=job_skills)
        except Exception as e:
            logger.warning("URL analysis failed: %s", e)
            url_result = {
                "urls_found": [],
                "url_signals": [],
                "total_boost": 0.0,
                "details": [],
            }

        # 7) URL boost: raw points clamped at URL_BOOST_CAP (max 15)
        raw_url_boost = float(url_result.get("total_boost", 0.0) or 0.0)
        url_boost = min(raw_url_boost, URL_BOOST_CAP)

        # 8) Section-level scores
        section_scores = self._compute_section_scores(cv_text, job_text, model)

        # 9) Confidence (semantic-weighted blend with skill proximity)
        confidence = (semantic_score / 100.0) * 0.6 + (
            skill_proximity_score / 100.0
        ) * 0.4

        # ---- Total score ------------------------------------------------
        # Weighted core: out of 85 points.
        weighted_core = (
            (semantic_score * 0.40)
            + (skill_proximity_score * 0.30)
            + (tfidf_score * 0.15)
        )
        # URL boost contributes raw points up to URL_BOOST_CAP (15).
        total_score = weighted_core + url_boost
        total_score = max(0.0, min(total_score, 100.0))

        return {
            "total_score": round(total_score, 1),
            "semantic_score": round(semantic_score, 1),
            "skill_proximity_score": round(skill_proximity_score, 1),
            "tfidf_score": round(tfidf_score, 1),
            "url_boost": round(url_boost, 1),
            "language_detected": language,
            "model_used": self.model_used,
            "confidence": round(confidence, 2),
            "matched_skills": skill_result.get("matched_skills", []),
            "missing_skills": skill_result.get("missing_skills", []),
            "partial_skills": skill_result.get("partial_skills", []),
            "urls_found": url_result.get("urls_found", []),
            "url_signals": url_result.get("url_signals", []),
            "matching_sections": section_scores,
        }

    # ------------------------------------------------------------------ #
    # Batch matching
    # ------------------------------------------------------------------ #
    def match_batch(
        self, cvs: List[str], job_text: str
    ) -> List[Dict[str, Any]]:
        """Match many CVs against a single job, ranked by ``total_score``."""
        if not cvs:
            return []

        results: List[Dict[str, Any]] = []
        for idx, cv in enumerate(cvs):
            cv_text = cv or ""
            try:
                m = self.match(cv_text, job_text)
            except Exception as e:
                logger.warning("Batch entry #%d crashed: %s", idx, e)
                m = {
                    "total_score": 0.0,
                    "semantic_score": 0.0,
                    "skill_proximity_score": 0.0,
                    "tfidf_score": 0.0,
                    "url_boost": 0.0,
                    "language_detected": "en",
                    "model_used": self.model_used,
                    "confidence": 0.0,
                    "matched_skills": [],
                    "missing_skills": [],
                    "partial_skills": [],
                    "urls_found": [],
                    "url_signals": [],
                    "matching_sections": {},
                    "error": str(e),
                }

            preview = (cv_text or "").strip().replace("\n", " ")
            preview = (preview[:100] + "...") if len(preview) > 100 else preview
            m["cv_preview"] = preview
            m["cv_index"] = idx
            results.append(m)

        results.sort(key=lambda r: r.get("total_score", 0.0), reverse=True)
        for rank, item in enumerate(results, start=1):
            item["rank"] = rank
        return results

    # ------------------------------------------------------------------ #
    # Health / status
    # ------------------------------------------------------------------ #
    def get_status(self) -> Dict[str, Any]:
        """Return a small diagnostic dict suitable for a /health endpoint."""
        primary_ready = self._primary_model is not None
        status = "ready" if primary_ready else "degraded"
        return {
            "models_loaded": list(self.models_loaded),
            "model_used": self.model_used,
            "uptime_seconds": round(time.time() - self.start_time, 2),
            "status": status,
        }


__all__ = ["MatchingEngine"]


if __name__ == "__main__":  # pragma: no cover - manual smoke test
    logging.basicConfig(level=logging.INFO)

    engine = MatchingEngine()
    cv = (
        "Senior Python developer with 6 years of experience using FastAPI, "
        "Django, PostgreSQL, Docker and GitHub Actions. Built ML pipelines "
        "with scikit-learn and PyTorch. https://github.com/example"
    )
    job = (
        "Looking for a backend engineer fluent in Python, FastAPI, AWS, "
        "Kubernetes and PostgreSQL. ML experience is a plus."
    )
    from pprint import pprint

    pprint(engine.match(cv, job))
    print("---")
    pprint(engine.get_status())
