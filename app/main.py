"""
CV-Job Matching Engine - FastAPI Application

A production-ready REST API for matching CVs against job descriptions using
semantic similarity, skill graph analysis, and explainable AI.

Run with:
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Dict, List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Internal module imports (support both package and flat layouts)
# ---------------------------------------------------------------------------
try:
    from app.matching import MatchingEngine
except ImportError:  # pragma: no cover - fallback for flat layout
    from matching import MatchingEngine  # type: ignore[no-redef]

try:
    from app.explainer import Explainer
except ImportError:  # pragma: no cover
    from explainer import Explainer  # type: ignore[no-redef]

try:
    from app.pdf_extractor import PDFExtractor
except ImportError:  # pragma: no cover
    from pdf_extractor import PDFExtractor  # type: ignore[no-redef]

try:
    from app import database
except ImportError:  # pragma: no cover
    import database  # type: ignore[no-redef]

try:
    from app.platform_routes import router as platform_router
    from app.platform_db import init_platform_db
except ImportError:  # pragma: no cover
    from platform_routes import router as platform_router  # type: ignore[no-redef]
    from platform_db import init_platform_db  # type: ignore[no-redef]


# ---------------------------------------------------------------------------
# Logging configuration
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("cv_matching_engine")


# ---------------------------------------------------------------------------
# Module-level singletons (populated by the lifespan context manager)
# ---------------------------------------------------------------------------
engine: Optional[MatchingEngine] = None
explainer: Optional[Explainer] = None
pdf_extractor: Optional[PDFExtractor] = None

# Application state
APP_START_TIME: float = time.time()
MODELS_LOADED: bool = False


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class TextMatchRequest(BaseModel):
    """Request body for plain-text CV/job matching."""

    cv_text: str = Field(..., min_length=1, description="Raw CV / resume text")
    job_text: str = Field(..., min_length=1, description="Raw job-description text")


class BatchMatchRequest(BaseModel):
    """Request body for batch matching of many CVs against one job."""

    cvs: List[str] = Field(..., min_length=1, description="List of CV texts")
    job_text: str = Field(..., min_length=1, description="Raw job-description text")


class MatchResponse(BaseModel):
    """Single-match response: full score dict plus a human-readable explanation."""

    score: float = Field(..., description="Overall match score, typically 0..1 or 0..100")
    semantic_score: Optional[float] = Field(None, description="Semantic similarity sub-score")
    skill_score: Optional[float] = Field(None, description="Skill-graph sub-score")
    matched_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    explanation: str = Field(..., description="Human-readable explanation of the score")

    # Allow any additional fields the engine may emit without breaking the schema.
    model_config = {"extra": "allow"}


class BatchMatchItem(BaseModel):
    """One ranked entry inside a batch-match response."""

    rank: int
    cv_preview: str
    score: float
    explanation: str
    matched_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    # Breakdown used by the Batch page (same keys as the single-match response)
    total_score: float = 0.0
    semantic_score: float = 0.0
    skill_proximity_score: float = 0.0
    tfidf_score: float = 0.0
    url_boost: float = 0.0
    partial_skills: List[Any] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str
    models_loaded: bool
    uptime_seconds: float


class MetricsResponse(BaseModel):
    total_matches: int
    avg_score: float
    model_versions: List[str]


class RootResponse(BaseModel):
    message: str
    version: str
    docs: str


# ---------------------------------------------------------------------------
# Lifespan: startup / shutdown
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Initialize singletons on startup, clean up on shutdown."""
    global engine, explainer, pdf_extractor, MODELS_LOADED, APP_START_TIME

    APP_START_TIME = time.time()
    logger.info("Starting CV Matching Engine...")

    try:
        logger.info("Loading MatchingEngine...")
        engine = MatchingEngine()

        logger.info("Loading Explainer...")
        explainer = Explainer()

        logger.info("Loading PDFExtractor...")
        pdf_extractor = PDFExtractor()

        # Initialize the database (idempotent if already set up)
        if hasattr(database, "init_db"):
            logger.info("Initializing database...")
            database.init_db()

        MODELS_LOADED = True
        logger.info("Startup complete - models loaded successfully.")
    except Exception as exc:  # pragma: no cover - defensive startup
        MODELS_LOADED = False
        logger.exception("Failed to initialize application components: %s", exc)
        # Re-raise so uvicorn aborts startup rather than running half-broken.
        raise

    try:
        yield
    finally:
        logger.info("Shutting down CV Matching Engine...")
        if hasattr(database, "close"):
            try:
                database.close()
            except Exception:  # pragma: no cover
                logger.exception("Error closing database.")


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------
app = FastAPI(
    title="CV Matching Engine API",
    description="Semantic CV-to-Job matching with explainable scores.",
    version="2.0.0",
    lifespan=lifespan,
)

# Permissive CORS for development; tighten origins for production deployments.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include platform routes (auth, users, jobs, applications, admin)
app.include_router(platform_router)
init_platform_db()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _ensure_ready() -> None:
    """Raise 503 if the engine is not yet initialized."""
    if engine is None or explainer is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Models are still loading. Please retry shortly.",
        )


def _normalize_match_result(result: Any) -> Dict[str, Any]:
    """Coerce a MatchingEngine.match() result into a plain dict."""
    if isinstance(result, dict):
        return dict(result)
    if hasattr(result, "model_dump"):
        return result.model_dump()  # pydantic v2
    if hasattr(result, "dict"):
        return result.dict()  # pydantic v1
    if hasattr(result, "__dict__"):
        return dict(result.__dict__)
    raise TypeError(f"Cannot normalize match result of type {type(result)!r}")


def _build_match_response(cv_text: str, job_text: str) -> Dict[str, Any]:
    """Run the full match -> explain -> persist pipeline."""
    assert engine is not None and explainer is not None  # for mypy

    logger.info("Running match: cv_len=%d, job_len=%d", len(cv_text), len(job_text))
    raw_result = engine.match(cv_text, job_text)
    score_dict = _normalize_match_result(raw_result)

    try:
        explanation = explainer.generate(score_dict)
    except Exception as exc:  # pragma: no cover - explanation must not break match
        logger.exception("Explainer failed: %s", exc)
        explanation = "Explanation unavailable."

    score_dict["explanation"] = explanation

    # The MatchResponse schema requires `score`, but the engine emits `total_score`.
    # Mirror it so the response validates (keeps both keys for clients).
    if "score" not in score_dict:
        score_dict["score"] = score_dict.get("total_score", score_dict.get("score", 0))

    # Persist (best-effort: log and continue if DB write fails).
    try:
        if hasattr(database, "save_match"):
            persist_data = dict(score_dict)
            persist_data["cv_text"] = cv_text
            persist_data["job_text"] = job_text
            database.save_match(persist_data)
    except Exception as exc:  # pragma: no cover
        logger.exception("Failed to persist match to database: %s", exc)

    return score_dict


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/", response_model=RootResponse, tags=["meta"])
async def root() -> RootResponse:
    """API landing endpoint."""
    return RootResponse(
        message="CV Matching Engine API",
        version="2.0.0",
        docs="/docs",
    )


@app.get("/health", response_model=HealthResponse, tags=["meta"])
async def health() -> HealthResponse:
    """Liveness/readiness probe."""
    return HealthResponse(
        status="ok",
        models_loaded=MODELS_LOADED,
        uptime_seconds=round(time.time() - APP_START_TIME, 3),
    )


@app.get("/metrics", response_model=MetricsResponse, tags=["meta"])
async def metrics() -> MetricsResponse:
    """Aggregate runtime metrics drawn from the database and loaded models."""
    total_matches, avg_score = 0, 0.0
    try:
        if hasattr(database, "get_stats"):
            stats = database.get_stats()
            total_matches = int(stats.get("total_matches", 0) or 0)
            avg_score = float(stats.get("avg_score", 0.0) or 0.0)
        elif hasattr(database, "get_history"):
            rows = database.get_history(1000)
            total_matches = len(rows)
            avg_score = (
                sum(r.get("total_score", 0) for r in rows) / total_matches
                if total_matches else 0.0
            )
    except Exception as exc:  # pragma: no cover
        logger.exception("Metrics query failed: %s", exc)

    model_versions: List[str] = []
    if engine is not None:
        models = getattr(engine, "models_loaded", [])
        if models:
            model_versions = [str(m) for m in models]
        elif getattr(engine, "model_used", None):
            model_versions = [str(engine.model_used)]

    return MetricsResponse(
        total_matches=total_matches,
        avg_score=round(avg_score, 2),
        model_versions=model_versions,
    )


@app.get("/history", tags=["history"])
async def history(limit: int = 20) -> List[Dict[str, Any]]:
    """Return the most recent matches stored in the database."""
    if limit < 1 or limit > 1000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="limit must be between 1 and 1000",
        )

    try:
        records = database.get_history(limit)
    except Exception as exc:
        logger.exception("Failed to fetch history: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not load match history.",
        ) from exc

    return list(records or [])


@app.post("/match/text", response_model=MatchResponse, tags=["match"])
async def match_text(payload: TextMatchRequest) -> Dict[str, Any]:
    """Match a CV given as plain text against a job description."""
    _ensure_ready()

    try:
        result = _build_match_response(payload.cv_text, payload.job_text)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("match/text failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Matching failed: {exc}",
        ) from exc

    return result


@app.post("/match/pdf", response_model=MatchResponse, tags=["match"])
async def match_pdf(
    cv_pdf: UploadFile = File(..., description="CV document as PDF"),
    job_text: str = Form(..., description="Raw job-description text"),
) -> Dict[str, Any]:
    """Match a CV uploaded as a PDF against a job description."""
    _ensure_ready()
    assert pdf_extractor is not None  # for mypy

    if not job_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="job_text must not be empty.",
        )

    filename = cv_pdf.filename or "uploaded.pdf"
    if not filename.lower().endswith(".pdf"):
        logger.warning("Uploaded file %r is not a .pdf - attempting extraction anyway.", filename)

    try:
        pdf_bytes = await cv_pdf.read()
    except Exception as exc:
        logger.exception("Failed to read uploaded file: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not read uploaded PDF.",
        ) from exc
    finally:
        await cv_pdf.close()

    if not pdf_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded PDF is empty.",
        )

    # PDFExtractor may expose either extract(bytes) or extract_text(bytes); try both.
    try:
        if hasattr(pdf_extractor, "extract"):
            cv_text = pdf_extractor.extract(pdf_bytes)
        elif hasattr(pdf_extractor, "extract_text"):
            cv_text = pdf_extractor.extract_text(pdf_bytes)
        else:
            raise AttributeError("PDFExtractor has no extract/extract_text method.")
    except Exception as exc:
        logger.exception("PDF extraction failed for %s: %s", filename, exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not extract text from PDF: {exc}",
        ) from exc

    if not cv_text or not cv_text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="PDF contained no extractable text.",
        )

    try:
        result = _build_match_response(cv_text, job_text)
    except Exception as exc:
        logger.exception("match/pdf scoring failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Matching failed: {exc}",
        ) from exc

    return result


@app.post("/match/batch", response_model=List[BatchMatchItem], tags=["match"])
async def match_batch(payload: BatchMatchRequest) -> List[BatchMatchItem]:
    """Match many CVs against a single job and return them ranked best-first."""
    _ensure_ready()
    assert engine is not None and explainer is not None  # for mypy

    if not payload.cvs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="cvs must contain at least one CV.",
        )

    logger.info("Running batch match: n_cvs=%d", len(payload.cvs))

    try:
        raw_results = engine.match_batch(payload.cvs, payload.job_text)
    except Exception as exc:
        logger.exception("match/batch failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch matching failed: {exc}",
        ) from exc

    # raw_results is already sorted best-first with cv_index pointing to original CV
    cv_map = {i: cv for i, cv in enumerate(payload.cvs)}
    ranked: List[BatchMatchItem] = []

    for idx, raw in enumerate(raw_results or [], start=1):
        score_dict = _normalize_match_result(raw)
        cv_idx = score_dict.get("cv_index", idx - 1)
        cv_text = cv_map.get(cv_idx, "")

        try:
            explanation = explainer.generate(score_dict)
        except Exception as exc:  # pragma: no cover
            logger.exception("Explainer failed in batch: %s", exc)
            explanation = "Explanation unavailable."

        # Engine emits total_score; accept either key
        score = float(
            score_dict.get("total_score") or score_dict.get("score") or 0.0
        )
        preview = score_dict.get("cv_preview") or (cv_text[:100] if cv_text else "")

        ranked.append(
            BatchMatchItem(
                rank=idx,
                cv_preview=preview,
                score=score,
                explanation=explanation,
                matched_skills=list(score_dict.get("matched_skills", []) or []),
                missing_skills=list(score_dict.get("missing_skills", []) or []),
                total_score=score,
                semantic_score=float(score_dict.get("semantic_score") or 0.0),
                skill_proximity_score=float(score_dict.get("skill_proximity_score") or 0.0),
                tfidf_score=float(score_dict.get("tfidf_score") or 0.0),
                url_boost=float(score_dict.get("url_boost") or 0.0),
                partial_skills=list(score_dict.get("partial_skills", []) or []),
            )
        )

    return ranked


# ---------------------------------------------------------------------------
# Global error handler (defence in depth)
# ---------------------------------------------------------------------------
@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc: Exception) -> JSONResponse:  # type: ignore[no-untyped-def]
    """Last-resort handler so the API never returns a bare stack trace."""
    logger.exception("Unhandled exception on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error."},
    )


# ---------------------------------------------------------------------------
# Direct invocation: `python -m app.main` or `python app/main.py`
# ---------------------------------------------------------------------------
if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
