"""
Database layer for the CV-Job Matching Engine.

This module provides a small SQLAlchemy-backed persistence layer for
storing the results of CV/Job matches and querying basic statistics
about the engine's history.

Schema
------
A single ``matches`` table tracks every match the engine produces, with
the score breakdown (semantic, skill proximity, TF-IDF, URL boost),
metadata about the model used, the detected language, the human-readable
explanation and JSON-serialised lists of matched / missing skills.

Public API
----------
- :func:`init_db`     -- create the schema if it does not exist
- :func:`save_match`  -- persist a match dict, returns its primary key
- :func:`get_history` -- fetch the most recent matches (newest first)
- :func:`get_stats`   -- aggregate statistics across all matches
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    create_engine,
    func,
)
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Database location resolution
# ---------------------------------------------------------------------------
def _resolve_db_path() -> Path:
    """Resolve the SQLite path, handling both run-from-root and run-from-app.

    The desired final location is always ``<project>/app/cv_matches.db``.
    We walk a few candidate locations so the database stays in the same
    place regardless of where the script is launched from.
    """
    # 1) explicit override
    env = os.environ.get("CV_MATCHES_DB")
    if env:
        return Path(env).expanduser().resolve()

    here = Path(__file__).resolve().parent  # .../app
    primary = here / "cv_matches.db"

    # 2) If launched from project root, ``app/cv_matches.db`` resolves the
    #    same way as ``<project>/app/cv_matches.db``. Either way we end up
    #    with the file next to this module.
    cwd_candidate = Path.cwd() / "app" / "cv_matches.db"

    # Prefer a file that already exists; otherwise default to next-to-module.
    for candidate in (primary, cwd_candidate):
        if candidate.exists():
            return candidate.resolve()

    # Make sure the parent directory exists for the default location
    primary.parent.mkdir(parents=True, exist_ok=True)
    return primary


DB_PATH: Path = _resolve_db_path()
DB_URL: str = f"sqlite:///{DB_PATH.as_posix()}"

# ``check_same_thread=False`` so this works under FastAPI/uvicorn workers.
engine = create_engine(
    DB_URL,
    echo=False,
    future=True,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
    future=True,
)

Base = declarative_base()


# ---------------------------------------------------------------------------
# ORM model
# ---------------------------------------------------------------------------
class Match(Base):
    """One row per CV/Job match the engine has produced."""

    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    cv_text = Column(Text, nullable=True)            # truncated to 2000 chars
    job_text = Column(Text, nullable=True)           # truncated to 1000 chars

    total_score = Column(Float, nullable=True)
    semantic_score = Column(Float, nullable=True)
    skill_proximity_score = Column(Float, nullable=True)
    tfidf_score = Column(Float, nullable=True)
    url_boost = Column(Float, nullable=True)

    matched_skills = Column(Text, nullable=True)     # JSON-encoded list
    missing_skills = Column(Text, nullable=True)     # JSON-encoded list

    language_detected = Column(String(10), nullable=True)
    model_used = Column(String(100), nullable=True)
    explanation = Column(Text, nullable=True)

    def to_dict(self) -> Dict[str, Any]:
        """Return a JSON-serialisable view of this row."""
        return {
            "id": self.id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "cv_text": self.cv_text,
            "job_text": self.job_text,
            "total_score": self.total_score,
            "semantic_score": self.semantic_score,
            "skill_proximity_score": self.skill_proximity_score,
            "tfidf_score": self.tfidf_score,
            "url_boost": self.url_boost,
            "matched_skills": _safe_json_loads(self.matched_skills, []),
            "missing_skills": _safe_json_loads(self.missing_skills, []),
            "language_detected": self.language_detected,
            "model_used": self.model_used,
            "explanation": self.explanation,
        }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _safe_json_dumps(value: Any) -> Optional[str]:
    """Best-effort JSON serialisation. Returns None on failure or empty."""
    if value is None:
        return None
    try:
        return json.dumps(value, ensure_ascii=False, default=str)
    except (TypeError, ValueError) as e:
        logger.warning("Could not JSON-encode value: %s", e)
        return None


def _safe_json_loads(value: Optional[str], default: Any) -> Any:
    """Best-effort JSON parsing. Returns *default* on failure."""
    if not value:
        return default
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default


def _truncate(value: Optional[str], limit: int) -> Optional[str]:
    """Truncate string to *limit* characters (preserves None)."""
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    if len(value) <= limit:
        return value
    return value[:limit]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def init_db() -> None:
    """Create the schema if it does not exist yet (idempotent)."""
    logger.info("Initialising database at %s", DB_PATH)
    Base.metadata.create_all(bind=engine)


def save_match(match_data: Dict[str, Any]) -> int:
    """Persist a match dict to the database.

    Parameters
    ----------
    match_data:
        Dict with any subset of the columns. ``cv_text`` is truncated to
        the first 2000 characters and ``job_text`` to the first 1000.
        ``matched_skills`` / ``missing_skills`` are JSON-encoded.

    Returns
    -------
    int
        The primary key of the newly inserted row.
    """
    if not isinstance(match_data, dict):
        raise TypeError("save_match expects a dict, got %r" % type(match_data))

    init_db()  # cheap & idempotent; protects against fresh DBs

    record = Match(
        cv_text=_truncate(match_data.get("cv_text"), 2000),
        job_text=_truncate(match_data.get("job_text"), 1000),
        total_score=_to_float(match_data.get("total_score")),
        semantic_score=_to_float(match_data.get("semantic_score")),
        skill_proximity_score=_to_float(match_data.get("skill_proximity_score")),
        tfidf_score=_to_float(match_data.get("tfidf_score")),
        url_boost=_to_float(match_data.get("url_boost")),
        matched_skills=_safe_json_dumps(match_data.get("matched_skills")),
        missing_skills=_safe_json_dumps(match_data.get("missing_skills")),
        language_detected=_truncate(match_data.get("language_detected"), 10),
        model_used=_truncate(match_data.get("model_used"), 100),
        explanation=match_data.get("explanation"),
    )

    session = SessionLocal()
    try:
        session.add(record)
        session.commit()
        session.refresh(record)
        return int(record.id)
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_history(limit: int = 20) -> List[Dict[str, Any]]:
    """Return the *limit* most recent matches, newest first."""
    if limit is None or limit <= 0:
        limit = 20

    init_db()

    session = SessionLocal()
    try:
        rows = (
            session.query(Match)
            .order_by(Match.created_at.desc(), Match.id.desc())
            .limit(int(limit))
            .all()
        )
        return [row.to_dict() for row in rows]
    finally:
        session.close()


def get_stats() -> Dict[str, Any]:
    """Aggregate statistics across all stored matches.

    Returns
    -------
    dict
        ``{
            "total_matches": int,
            "avg_score":     float | None,
            "min_score":     float | None,
            "max_score":     float | None,
            "model_versions": [str, ...]
        }``
    """
    init_db()

    session = SessionLocal()
    try:
        total = session.query(func.count(Match.id)).scalar() or 0
        if total == 0:
            return {
                "total_matches": 0,
                "avg_score": None,
                "min_score": None,
                "max_score": None,
                "model_versions": [],
            }

        avg_score = session.query(func.avg(Match.total_score)).scalar()
        min_score = session.query(func.min(Match.total_score)).scalar()
        max_score = session.query(func.max(Match.total_score)).scalar()

        model_rows = (
            session.query(Match.model_used)
            .filter(Match.model_used.isnot(None))
            .distinct()
            .all()
        )
        model_versions = sorted({row[0] for row in model_rows if row and row[0]})

        return {
            "total_matches": int(total),
            "avg_score": round(float(avg_score), 2) if avg_score is not None else None,
            "min_score": round(float(min_score), 2) if min_score is not None else None,
            "max_score": round(float(max_score), 2) if max_score is not None else None,
            "model_versions": model_versions,
        }
    finally:
        session.close()


def _to_float(value: Any) -> Optional[float]:
    """Coerce *value* to float, returning None on failure."""
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


__all__ = [
    "Base",
    "Match",
    "engine",
    "SessionLocal",
    "DB_PATH",
    "DB_URL",
    "init_db",
    "save_match",
    "get_history",
    "get_stats",
]


if __name__ == "__main__":  # pragma: no cover - manual smoke test
    logging.basicConfig(level=logging.INFO)
    init_db()
    sample = {
        "cv_text": "Python developer with FastAPI and Docker experience.",
        "job_text": "Looking for a Python backend engineer.",
        "total_score": 82.5,
        "semantic_score": 78.0,
        "skill_proximity_score": 85.0,
        "tfidf_score": 70.0,
        "url_boost": 5.0,
        "matched_skills": ["Python", "FastAPI"],
        "missing_skills": ["AWS"],
        "language_detected": "en",
        "model_used": "BAAI/bge-large-en-v1.5",
        "explanation": "Strong overall match with one missing cloud skill.",
    }
    new_id = save_match(sample)
    print("Inserted row id:", new_id)
    print("Stats:", get_stats())
    print("History (latest 3):")
    for row in get_history(3):
        print(" -", row["id"], row["total_score"], row["model_used"])
