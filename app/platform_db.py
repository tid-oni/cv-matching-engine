"""Platform database models: Users, JobOffers, Applications."""
from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    Boolean, Column, DateTime, Float, Integer, String, Text,
    ForeignKey, create_engine, func,
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

logger = logging.getLogger(__name__)

here = Path(__file__).resolve().parent
DB_URL = f"sqlite:///{(here / 'platform.db').as_posix()}"

engine = create_engine(DB_URL, echo=False, future=True, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    company = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)

    job_offers = relationship("JobOffer", back_populates="recruiter", cascade="all, delete-orphan")
    applications = relationship("Application", back_populates="candidate", cascade="all, delete-orphan")
    cv_files = relationship("CVFile", back_populates="owner", cascade="all, delete-orphan")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "email": self.email,
            "full_name": self.full_name,
            "role": self.role,
            "is_active": self.is_active,
            "company": self.company,
            "location": self.location,
        }


class JobOffer(Base):
    __tablename__ = "job_offers"
    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    recruiter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    company = Column(String(255), nullable=False)
    location = Column(String(255), nullable=True)
    job_type = Column(String(50), nullable=True)
    experience_level = Column(String(50), nullable=True)
    description = Column(Text, nullable=False)
    requirements = Column(Text, nullable=True)
    skills_required = Column(Text, nullable=True)
    salary_min = Column(Integer, nullable=True)
    salary_max = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_flagged = Column(Boolean, default=False, nullable=False)
    application_count = Column(Integer, default=0, nullable=False)

    recruiter = relationship("User", back_populates="job_offers")
    applications = relationship("Application", back_populates="job_offer", cascade="all, delete-orphan")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "recruiter_id": self.recruiter_id,
            "recruiter_name": self.recruiter.full_name if self.recruiter else None,
            "company": self.company,
            "title": self.title,
            "location": self.location,
            "job_type": self.job_type,
            "experience_level": self.experience_level,
            "description": self.description,
            "requirements": self.requirements,
            "skills_required": json.loads(self.skills_required) if self.skills_required else [],
            "salary_min": self.salary_min,
            "salary_max": self.salary_max,
            "is_active": self.is_active,
            "is_flagged": self.is_flagged,
            "application_count": self.application_count,
        }


class CVFile(Base):
    __tablename__ = "cv_files"
    id = Column(Integer, primary_key=True, autoincrement=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    cv_text = Column(Text, nullable=True)
    file_path = Column(String(512), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    owner = relationship("User", back_populates="cv_files")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "uploaded_at": self.uploaded_at.isoformat() if self.uploaded_at else None,
            "owner_id": self.owner_id,
            "filename": self.filename,
            "has_text": bool(self.cv_text),
            "is_active": self.is_active,
        }


class Application(Base):
    __tablename__ = "applications"
    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    candidate_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    job_offer_id = Column(Integer, ForeignKey("job_offers.id"), nullable=False)
    cv_file_id = Column(Integer, ForeignKey("cv_files.id"), nullable=True)
    status = Column(String(30), default="pending", nullable=False)
    match_score = Column(Float, nullable=True)
    matched_skills = Column(Text, nullable=True)
    missing_skills = Column(Text, nullable=True)
    cover_letter = Column(Text, nullable=True)
    recruiter_notes = Column(Text, nullable=True)
    # AI explanation fields (added via migration)
    explanation = Column(Text, nullable=True)       # JSON: full AI explanation
    score_breakdown = Column(Text, nullable=True)   # JSON: per-metric scores
    is_ai_scored = Column(Boolean, default=False, nullable=False)

    candidate = relationship("User", back_populates="applications")
    job_offer = relationship("JobOffer", back_populates="applications")

    def to_dict(self) -> Dict[str, Any]:
        expl = None
        if self.explanation:
            try:
                expl = json.loads(self.explanation)
            except Exception:
                pass
        breakdown = None
        if self.score_breakdown:
            try:
                breakdown = json.loads(self.score_breakdown)
            except Exception:
                pass
        return {
            "id": self.id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "candidate_id": self.candidate_id,
            "candidate_name": self.candidate.full_name if self.candidate else None,
            "candidate_email": self.candidate.email if self.candidate else None,
            "job_offer_id": self.job_offer_id,
            "job_title": self.job_offer.title if self.job_offer else None,
            "job_company": self.job_offer.company if self.job_offer else None,
            "cv_file_id": self.cv_file_id,
            "status": self.status,
            "match_score": self.match_score,
            "matched_skills": json.loads(self.matched_skills) if self.matched_skills else [],
            "missing_skills": json.loads(self.missing_skills) if self.missing_skills else [],
            "cover_letter": self.cover_letter,
            "recruiter_notes": self.recruiter_notes,
            "explanation": expl,
            "score_breakdown": breakdown,
            "is_ai_scored": bool(self.is_ai_scored),
        }


def init_platform_db() -> None:
    Base.metadata.create_all(bind=engine)
    _migrate()


def _migrate() -> None:
    """Add new columns to existing databases that predate them."""
    from sqlalchemy import text
    new_cols = [
        ("applications", "explanation", "TEXT"),
        ("applications", "score_breakdown", "TEXT"),
        ("applications", "is_ai_scored", "BOOLEAN DEFAULT 0"),
    ]
    with engine.connect() as conn:
        for table, col, coltype in new_cols:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {coltype}"))
                conn.commit()
            except Exception:
                pass  # Column already exists


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
