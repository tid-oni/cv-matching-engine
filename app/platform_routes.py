"""Platform API routes: auth, users, jobs, applications, admin."""
from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

try:
    from app.auth import create_access_token, hash_password, verify_password, decode_token
    from app.platform_db import Application, CVFile, JobOffer, User, get_db, init_platform_db
except ImportError:
    from auth import create_access_token, hash_password, verify_password, decode_token  # type: ignore
    from platform_db import Application, CVFile, JobOffer, User, get_db, init_platform_db  # type: ignore

logger = logging.getLogger(__name__)
router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# Lazy singleton — loaded once, reused for every scoring call
_engine = None

# Simple TTL cache for match scores: (cv_hash, job_id) -> (score, matched_skills, expires_at)
_score_cache: Dict = {}
_SCORE_CACHE_TTL = 300  # seconds


def _cached_match(eng, cv_text: str, job_id: int, job_text: str) -> tuple:
    cv_hash = hashlib.md5(cv_text.encode(), usedforsecurity=False).hexdigest()[:16]
    key = (cv_hash, job_id)
    now = time.monotonic()
    if key in _score_cache:
        score, matched, expires_at = _score_cache[key]
        if now < expires_at:
            return score, matched
    r = eng.match(cv_text, job_text)
    score = round(float(r.get("total_score") or r.get("score") or 0), 1)
    matched = r.get("matched_skills", [])
    _score_cache[key] = (score, matched, now + _SCORE_CACHE_TTL)
    return score, matched

def _get_engine():
    global _engine
    if _engine is None:
        try:
            from app.matching import MatchingEngine
        except ImportError:
            from matching import MatchingEngine  # type: ignore
        _engine = MatchingEngine()
    return _engine

UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# ── Schemas ───────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str  # candidate | recruiter | admin
    company: Optional[str] = None
    location: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]


class JobCreateRequest(BaseModel):
    title: str
    company: str
    location: Optional[str] = None
    job_type: Optional[str] = None
    experience_level: Optional[str] = None
    description: str
    requirements: Optional[str] = None
    skills_required: Optional[List[str]] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None


class ApplicationStatusUpdate(BaseModel):
    status: str
    recruiter_notes: Optional[str] = None


# ── Auth helpers ─────────────────────────────────────────────────────────────

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.query(User).filter(User.id == int(payload.get("sub", 0))).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_role(*roles: str):
    def dep(user: User = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user
    return dep


# ── Auth routes ───────────────────────────────────────────────────────────────

@router.post("/auth/register", tags=["auth"])
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    init_platform_db()
    if payload.role not in ("candidate", "recruiter", "admin"):
        raise HTTPException(status_code=400, detail="role must be candidate, recruiter, or admin")
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        company=payload.company,
        location=payload.location,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"access_token": token, "token_type": "bearer", "user": user.to_dict()}


@router.post("/auth/login", tags=["auth"])
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    init_platform_db()
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"access_token": token, "token_type": "bearer", "user": user.to_dict()}


@router.get("/auth/me", tags=["auth"])
def me(user: User = Depends(get_current_user)):
    return user.to_dict()


# ── CV upload ─────────────────────────────────────────────────────────────────

@router.post("/cv/upload", tags=["cv"])
async def upload_cv(
    cv_pdf: UploadFile = File(...),
    user: User = Depends(require_role("candidate")),
    db: Session = Depends(get_db),
):
    if not cv_pdf.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    pdf_bytes = await cv_pdf.read()

    if len(pdf_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10 MB.")

    safe_name = Path(cv_pdf.filename).name  # strip any directory components
    file_path = UPLOAD_DIR / f"cv_{user.id}_{safe_name}"
    file_path.write_bytes(pdf_bytes)

    # Extract text
    cv_text = None
    try:
        try:
            from app.pdf_extractor import PDFExtractor
        except ImportError:
            from pdf_extractor import PDFExtractor  # type: ignore
        extractor = PDFExtractor()
        cv_text = extractor.extract(pdf_bytes) if hasattr(extractor, "extract") else extractor.extract_text(pdf_bytes)
    except Exception as e:
        logger.warning("PDF extraction failed: %s", e)

    # Deactivate previous CVs
    db.query(CVFile).filter(CVFile.owner_id == user.id).update({"is_active": False})

    cv_file = CVFile(
        owner_id=user.id,
        filename=cv_pdf.filename,
        cv_text=cv_text,
        file_path=str(file_path),
        is_active=True,
    )
    db.add(cv_file)
    db.commit()
    db.refresh(cv_file)
    return {"message": "CV uploaded", "cv": cv_file.to_dict(), "text_extracted": bool(cv_text)}


@router.get("/cv/mine", tags=["cv"])
def my_cv(user: User = Depends(require_role("candidate")), db: Session = Depends(get_db)):
    cv = db.query(CVFile).filter(CVFile.owner_id == user.id, CVFile.is_active == True).first()
    if not cv:
        return None
    return cv.to_dict()


# ── Job offers ────────────────────────────────────────────────────────────────

@router.get("/jobs", tags=["jobs"])
def list_jobs(
    skip: int = 0, limit: int = 50, search: Optional[str] = None,
    location: Optional[str] = None, job_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    init_platform_db()
    q = db.query(JobOffer).filter(JobOffer.is_active == True, JobOffer.is_flagged == False)
    if search:
        q = q.filter(
            JobOffer.title.ilike(f"%{search}%") | JobOffer.description.ilike(f"%{search}%")
        )
    if location:
        q = q.filter(JobOffer.location.ilike(f"%{location}%"))
    if job_type:
        q = q.filter(JobOffer.job_type == job_type)
    total = q.count()
    jobs = q.order_by(JobOffer.created_at.desc()).offset(skip).limit(limit).all()
    return {"total": total, "jobs": [j.to_dict() for j in jobs]}


@router.get("/jobs/{job_id}", tags=["jobs"])
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(JobOffer).filter(JobOffer.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job.to_dict()


@router.post("/jobs", tags=["jobs"])
def create_job(
    payload: JobCreateRequest,
    user: User = Depends(require_role("recruiter", "admin")),
    db: Session = Depends(get_db),
):
    job = JobOffer(
        recruiter_id=user.id,
        title=payload.title,
        company=payload.company or user.company or "",
        location=payload.location,
        job_type=payload.job_type,
        experience_level=payload.experience_level,
        description=payload.description,
        requirements=payload.requirements,
        skills_required=json.dumps(payload.skills_required or []),
        salary_min=payload.salary_min,
        salary_max=payload.salary_max,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job.to_dict()


@router.put("/jobs/{job_id}", tags=["jobs"])
def update_job(
    job_id: int,
    payload: JobCreateRequest,
    user: User = Depends(require_role("recruiter", "admin")),
    db: Session = Depends(get_db),
):
    job = db.query(JobOffer).filter(JobOffer.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.recruiter_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not your job offer")
    for field, val in payload.dict(exclude_none=True).items():
        if field == "skills_required":
            setattr(job, field, json.dumps(val or []))
        else:
            setattr(job, field, val)
    db.commit()
    db.refresh(job)
    return job.to_dict()


@router.delete("/jobs/{job_id}", tags=["jobs"])
def delete_job(
    job_id: int,
    user: User = Depends(require_role("recruiter", "admin")),
    db: Session = Depends(get_db),
):
    job = db.query(JobOffer).filter(JobOffer.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.recruiter_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not your job offer")
    job.is_active = False
    db.commit()
    return {"message": "Job deactivated"}


@router.get("/recruiter/jobs", tags=["recruiter"])
def recruiter_jobs(user: User = Depends(require_role("recruiter", "admin")), db: Session = Depends(get_db)):
    jobs = db.query(JobOffer).filter(JobOffer.recruiter_id == user.id).order_by(JobOffer.created_at.desc()).all()
    return [j.to_dict() for j in jobs]


# ── Applications ──────────────────────────────────────────────────────────────

@router.post("/jobs/{job_id}/apply", tags=["applications"])
def apply_to_job(
    job_id: int,
    cover_letter: Optional[str] = None,
    user: User = Depends(require_role("candidate")),
    db: Session = Depends(get_db),
):
    job = db.query(JobOffer).filter(JobOffer.id == job_id, JobOffer.is_active == True).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    existing = db.query(Application).filter(
        Application.candidate_id == user.id,
        Application.job_offer_id == job_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already applied to this job")

    # Get active CV
    cv = db.query(CVFile).filter(CVFile.owner_id == user.id, CVFile.is_active == True).first()

    # Run matching if CV text available
    match_score = None
    matched_skills: List[str] = []
    missing_skills: List[str] = []

    if cv and cv.cv_text:
        try:
            eng = _get_engine()
            result = eng.match(cv.cv_text, job.description + " " + (job.requirements or ""))
            match_score = float(result.get("total_score") or result.get("score") or 0)
            matched_skills = result.get("matched_skills", []) or []
            missing_skills = result.get("missing_skills", []) or []
        except Exception as e:
            logger.warning("Matching failed during apply: %s", e)

    app_obj = Application(
        candidate_id=user.id,
        job_offer_id=job_id,
        cv_file_id=cv.id if cv else None,
        cover_letter=cover_letter,
        match_score=match_score,
        matched_skills=json.dumps(matched_skills),
        missing_skills=json.dumps(missing_skills),
    )
    db.add(app_obj)
    job.application_count = (job.application_count or 0) + 1
    db.commit()
    db.refresh(app_obj)
    return app_obj.to_dict()


@router.get("/candidate/applications", tags=["applications"])
def my_applications(user: User = Depends(require_role("candidate")), db: Session = Depends(get_db)):
    apps = (
        db.query(Application)
        .filter(Application.candidate_id == user.id)
        .order_by(Application.created_at.desc())
        .all()
    )
    return [a.to_dict() for a in apps]


@router.get("/jobs/{job_id}/candidates", tags=["recruiter"])
def job_candidates(
    job_id: int,
    user: User = Depends(require_role("recruiter", "admin")),
    db: Session = Depends(get_db),
):
    job = db.query(JobOffer).filter(JobOffer.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.recruiter_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not your job offer")

    apps = (
        db.query(Application)
        .filter(Application.job_offer_id == job_id)
        .order_by(Application.match_score.desc().nullslast())
        .all()
    )

    # Scores stay hidden from the recruiter until they explicitly run AI Analysis.
    # A match_score may exist from apply-time matching, but we only surface it
    # (and the explanation/skills) once `is_ai_scored` is True.
    result = []
    for a in apps:
        d = a.to_dict()
        if not d.get("is_ai_scored"):
            d["match_score"] = None
            d["matched_skills"] = []
            d["missing_skills"] = []
            d["explanation"] = None
            d["score_breakdown"] = None
        result.append(d)
    return result


@router.get("/applications/{app_id}/cv", tags=["recruiter"])
def get_application_cv(
    app_id: int,
    user: User = Depends(require_role("recruiter", "admin")),
    db: Session = Depends(get_db),
):
    """Return the extracted CV text + metadata for a candidate who applied to the
    recruiter's job. Access is restricted to the job owner (or admin)."""
    app_obj = db.query(Application).filter(Application.id == app_id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")

    job = db.query(JobOffer).filter(JobOffer.id == app_obj.job_offer_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.recruiter_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not your job offer")

    # Prefer the CV attached to the application; fall back to candidate's active CV
    cv = None
    if app_obj.cv_file_id:
        cv = db.query(CVFile).filter(CVFile.id == app_obj.cv_file_id).first()
    if not cv:
        cv = db.query(CVFile).filter(
            CVFile.owner_id == app_obj.candidate_id, CVFile.is_active == True
        ).first()

    if not cv:
        raise HTTPException(status_code=404, detail="No CV on file for this candidate")

    has_file = bool(cv.file_path and Path(cv.file_path).exists())
    return {
        "cv_file_id":     cv.id,
        "filename":       cv.filename,
        "cv_text":        cv.cv_text or "",
        "has_text":       bool(cv.cv_text),
        "has_file":       has_file,
        "candidate_name": app_obj.candidate.full_name if app_obj.candidate else None,
        "uploaded_at":    cv.uploaded_at.isoformat() if cv.uploaded_at else None,
    }


@router.get("/applications/{app_id}/cv/file", tags=["recruiter"])
def download_application_cv(
    app_id: int,
    user: User = Depends(require_role("recruiter", "admin")),
    db: Session = Depends(get_db),
):
    """Serve the candidate's original CV PDF to the job owner (or admin)."""
    from fastapi.responses import FileResponse

    app_obj = db.query(Application).filter(Application.id == app_id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")

    job = db.query(JobOffer).filter(JobOffer.id == app_obj.job_offer_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.recruiter_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not your job offer")

    cv = None
    if app_obj.cv_file_id:
        cv = db.query(CVFile).filter(CVFile.id == app_obj.cv_file_id).first()
    if not cv:
        cv = db.query(CVFile).filter(
            CVFile.owner_id == app_obj.candidate_id, CVFile.is_active == True
        ).first()

    if not cv or not cv.file_path or not Path(cv.file_path).exists():
        raise HTTPException(status_code=404, detail="CV file not available")

    return FileResponse(cv.file_path, media_type="application/pdf", filename=cv.filename)


@router.put("/applications/{app_id}/status", tags=["recruiter"])
def update_application_status(
    app_id: int,
    payload: ApplicationStatusUpdate,
    user: User = Depends(require_role("recruiter", "admin")),
    db: Session = Depends(get_db),
):
    valid_statuses = {"pending", "reviewed", "shortlisted", "rejected", "hired"}
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")

    app_obj = db.query(Application).filter(Application.id == app_id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")

    app_obj.status = payload.status
    if payload.recruiter_notes:
        app_obj.recruiter_notes = payload.recruiter_notes
    db.commit()
    db.refresh(app_obj)
    return app_obj.to_dict()


# ── Jobs with match scores for candidate ─────────────────────────────────────

@router.get("/candidate/recommended-jobs", tags=["candidate"])
def recommended_jobs(user: User = Depends(require_role("candidate")), db: Session = Depends(get_db)):
    """Return active jobs, with match score if user has a CV."""
    jobs = db.query(JobOffer).filter(JobOffer.is_active == True).order_by(JobOffer.created_at.desc()).limit(50).all()
    cv = db.query(CVFile).filter(CVFile.owner_id == user.id, CVFile.is_active == True).first()

    applied_ids = {
        a.job_offer_id
        for a in db.query(Application).filter(Application.candidate_id == user.id).all()
    }

    # Load engine once outside the loop — not per-job
    eng = None
    if cv and cv.cv_text:
        try:
            eng = _get_engine()
        except Exception as e:
            logger.warning("Engine unavailable: %s", e)

    results = []
    for job in jobs:
        d = job.to_dict()
        d["already_applied"] = job.id in applied_ids
        d["match_score"] = None
        d["matched_skills"] = []
        if eng and cv and cv.cv_text:
            try:
                job_text = job.description + " " + (job.requirements or "")
                score, matched = _cached_match(eng, cv.cv_text, job.id, job_text)
                d["match_score"] = score
                d["matched_skills"] = matched
            except Exception:
                pass
        results.append(d)

    results.sort(key=lambda x: x["match_score"] or 0, reverse=True)
    return results


# ── Admin ─────────────────────────────────────────────────────────────────────

# ── AI Explanation Generator ──────────────────────────────────────────────────

def _generate_explanation(cv_text: str, job: JobOffer, result: dict) -> dict:
    """Generate a rich, BILINGUAL (EN + FR), personalized explanation for both the
    recruiter and the candidate views.

    The returned dict keeps English flat fields for back-compat and adds an
    `i18n` block ({en, fr}) plus language-agnostic numbers (`score_math`,
    `interview_probes`). The frontend renders `i18n[lang]` and falls back to
    `i18n.en` / the flat fields.
    """
    score    = float(result.get("total_score") or result.get("score") or 0)
    matched  = result.get("matched_skills", []) or []
    missing  = result.get("missing_skills", []) or []
    semantic = float(result.get("semantic_score") or score * 0.95)
    tfidf    = float(result.get("tfidf_score")    or score * 0.80)
    skill_px = float(result.get("skill_proximity_score") or result.get("skill_score") or 0)
    url_raw  = float(result.get("url_boost") or 0)

    skill_total = len(matched) + len(missing)
    skill_pct   = round(len(matched) / max(skill_total, 1) * 100, 1)
    if not skill_px:
        skill_px = skill_pct
    job_title   = job.title or "this role"

    # ── Weighted score arithmetic (the "why this score") ──────────────────
    sem_pts   = round(semantic * 0.40, 1)
    skill_pts = round(skill_px * 0.30, 1)
    tfidf_pts = round(tfidf * 0.15, 1)
    url_pts   = round(min(url_raw, 15), 1)
    url_absent = url_raw <= 0

    # ── Tier + points-to-next-tier ────────────────────────────────────────
    label = (
        "Exceptional Match" if score >= 82 else
        "Strong Match"      if score >= 70 else
        "Moderate Match"    if score >= 55 else
        "Weak Match"        if score >= 40 else
        "Insufficient Match"
    )
    _next = next((th for th in (40, 55, 70, 82) if th > score), None)
    points_to_next = round(_next - score, 1) if _next else 0.0
    next_label_en = {40: "Weak Match", 55: "Moderate Match", 70: "Strong Match", 82: "Exceptional Match"}.get(_next or 0, "")
    next_label_fr = {
        "Weak Match": "Faible correspondance", "Moderate Match": "Correspondance modérée",
        "Strong Match": "Forte correspondance", "Exceptional Match": "Correspondance exceptionnelle",
    }.get(next_label_en, "")

    # Interview probe areas = the named missing skills (else validate matched depth)
    probes = missing[:3] if missing else matched[:2]

    def _prose(fr: bool) -> dict:
        join = ", "
        # ── Recruiter: why hire ──
        _m3 = (join.join(matched[:3]) + ("…" if len(matched) > 3 else "")) if matched else ""
        wh = []
        if score >= 82:
            wh.append(
                f"Profil exceptionnel pour {job_title} — l'un des plus forts du vivier ({score:.1f}% de score composite). "
                f"Trois raisons le justifient : ils maîtrisent {_m3 or 'les compétences clés'} (le cœur du poste), "
                f"leur parcours s'aligne sémantiquement à {semantic:.0f}% avec la fiche, et ils couvrent {skill_pct:.0f}% des compétences requises — "
                f"contribution attendue quasi immédiate." if fr else
                f"Exceptional fit for {job_title} — one of the strongest profiles in the pipeline ({score:.1f}% composite). "
                f"Three reasons stand out: they bring {_m3 or 'the key skills'} (the core of the role), "
                f"their background aligns semantically at {semantic:.0f}% with the description, and they cover {skill_pct:.0f}% of required skills — "
                f"contribution should be near-immediate."
            )
        elif score >= 70:
            wh.append(
                f"Candidat sérieux pour {job_title} ({score:.1f}% composite). Concrètement, ils apportent {_m3 or 'les compétences clés du poste'}, "
                f"leur expérience recoupe les exigences principales sur le fond (sémantique {semantic:.0f}%), "
                f"et {skill_pct:.0f}% des compétences requises sont présentes — un socle solide pour démarrer vite." if fr else
                f"Strong contender for {job_title} ({score:.1f}% composite). Concretely, they bring {_m3 or 'the key skills'}, "
                f"their experience overlaps the core requirements at a substance level (semantic {semantic:.0f}%), "
                f"and {skill_pct:.0f}% of required skills are present — a solid base to start fast."
            )
        elif score >= 55:
            wh.append(
                f"Correspondance modérée pour {job_title}. Le signal est réel ({score:.1f}% composite) "
                f"mais une intégration sérieuse serait nécessaire avant une pleine contribution." if fr else
                f"Moderate fit for {job_title}. There is real signal ({score:.1f}% composite) but the "
                f"candidate would need meaningful onboarding before contributing at full pace."
            )
        elif score >= 40:
            wh.append(
                f"Alignement limité avec {job_title} ({score:.1f}% composite) — recoupement partiel ; "
                f"à considérer surtout si le vivier est mince ou pour une valeur de domaine adjacent." if fr else
                f"Limited alignment with {job_title} ({score:.1f}% composite) — partial overlap; worth a "
                f"look mainly if the pipeline is thin or for adjacent-domain value."
            )
        else:
            wh.append(
                f"Très faible correspondance pour {job_title} ({score:.1f}% composite). Le CV ne montre pas "
                f"l'expérience clé exigée. Privilégier d'abord des candidats plus forts." if fr else
                f"Very weak match for {job_title} ({score:.1f}% composite). The CV doesn't show the core "
                f"experience this role demands. Prioritize stronger applicants first."
            )
        if semantic >= 72:
            wh.append(
                f"Similarité sémantique de {semantic:.0f}% : forte cohérence entre leur parcours et la fiche de poste." if fr else
                f"Semantic similarity is {semantic:.0f}% — deep language-level alignment between their narrative and the job."
            )
        if len(matched) >= 4:
            sample = join.join(matched[:4])
            wh.append(
                f"Ils démontrent {len(matched)} compétences requises ({sample}{', et plus' if len(matched) > 4 else ''}) — le cœur de la stack." if fr else
                f"They demonstrate {len(matched)} required skills ({sample}{', and more' if len(matched) > 4 else ''}) — the core of the stack."
            )
        elif len(matched) >= 1:
            wh.append(
                f"Ils maîtrisent {join.join(matched)} — couverture partielle mais réelle de la stack." if fr else
                f"They demonstrate {join.join(matched)} — partial but real coverage of the stack."
            )
        if skill_pct >= 70:
            wh.append(
                f"Avec {skill_pct:.0f}% de couverture, contribution quasi immédiate." if fr else
                f"With {skill_pct:.0f}% skill coverage, near-immediate contribution."
            )
        if len(matched) >= 6:
            wh.append(
                f"Grande étendue technique : {len(matched)} compétences requises distinctes — polyvalence au-delà d'une seule niche." if fr else
                f"Broad technical footprint: {len(matched)} distinct required skills — versatility beyond a single niche."
            )
        if 60 <= semantic < 72:
            wh.append(
                f"Profil adjacent au poste (sémantique {semantic:.0f}%) : socle transférable qui se convertit en général rapidement." if fr else
                f"Reads adjacent to the role (semantic {semantic:.0f}%) — a transferable foundation that usually converts quickly."
            )
        if tfidf >= 68:
            wh.append(
                f"Fort recouvrement terminologique (lexical {tfidf:.0f}%) : le CV emploie littéralement le vocabulaire du poste, ce qui aide aussi au filtrage ATS." if fr else
                f"Strong terminology overlap (lexical {tfidf:.0f}%) — the CV literally uses the role's vocabulary, which also helps ATS/keyword screens."
            )
        if len(missing) == 0 and skill_total > 0:
            wh.append(
                "Aucune compétence requise manquante — recrutement à faible risque côté couverture." if fr else
                "No required skill is missing — a low-risk hire from a coverage standpoint."
            )
        if score >= 82:
            wh.append(
                "À traiter en priorité absolue : les profils de ce niveau sont rares et reçoivent souvent des offres concurrentes — agissez vite." if fr else
                "Treat as top priority — profiles at this level are rare and often field competing offers, so move fast."
            )

        # ── Recruiter: concerns ──
        wn = []
        if len(missing) >= 3:
            sample = join.join(missing[:4])
            wn.append(
                f"{len(missing)} compétences requises absentes ({sample}{f', et {len(missing)-4} de plus' if len(missing) > 4 else ''}) — investissement d'intégration à prévoir." if fr else
                f"Missing {len(missing)} required skills ({sample}{f', and {len(missing)-4} more' if len(missing) > 4 else ''}) — onboarding investment to expect."
            )
        elif len(missing) >= 1:
            wn.append(
                f"Compétences non détectées sur le CV : {join.join(missing)}. Pourrait ralentir les débuts." if fr else
                f"Skills not detected on the CV: {join.join(missing)}. Could slow initial contributions."
            )
        if semantic < 55:
            wn.append(
                f"Alignement sémantique faible ({semantic:.0f}%) : domaine/langage différent de ce qu'exige {job_title} (souvent une reconversion)." if fr else
                f"Low semantic alignment ({semantic:.0f}%): domain/language differs from what {job_title} demands (often a career shift)."
            )
        elif semantic < 70:
            wn.append(
                f"Alignement sémantique présent mais modéré ({semantic:.0f}%) : CV adjacent au poste plutôt que central." if fr else
                f"Semantic alignment present but moderate ({semantic:.0f}%): CV reads adjacent to the role rather than central."
            )
        if skill_pct < 40 and skill_total > 0:
            wn.append(
                f"Seulement {skill_pct:.0f}% des compétences requises ({len(matched)}/{skill_total}) — forte montée en compétence attendue." if fr else
                f"Only {skill_pct:.0f}% of required skills ({len(matched)}/{skill_total}) — a significant ramp-up should be expected."
            )
        if url_absent:
            wn.append(
                "Aucun signal externe (GitHub/LinkedIn/portfolio) détecté — le score n'inclut donc aucun bonus URL ; ce n'est pas une pénalité." if fr else
                "No external signals (GitHub/LinkedIn/portfolio) detected — the score includes no URL bonus; this is not a penalty."
            )
        if tfidf < 50 and skill_total > 0:
            wn.append(
                f"Recouvrement lexical faible ({tfidf:.0f}%) : même si le sens est proche, le CV sous-représente peut-être l'outillage exact — confirmer la pratique réelle." if fr else
                f"Thin lexical overlap ({tfidf:.0f}%): even if the semantics are close, the CV may under-index on the exact tooling — confirm hands-on use."
            )
        if 1 <= len(matched) <= 2 and missing:
            wn.append(
                "Peu de compétences requises ressortent — valider la profondeur réelle plutôt qu'une simple familiarité." if fr else
                "Only a couple of required skills surfaced — validate real depth rather than passing familiarity."
            )
        if score < 55:
            wn.append(
                "Signaux de séniorité/portée limités pour le niveau du poste — sonder la propriété des sujets et l'échelle des systèmes gérés." if fr else
                "Limited seniority/scope signals for this role's level — probe ownership and the scale of systems handled."
            )
        if not wn:
            wn.append(
                "Aucun facteur disqualifiant majeur — à compléter par votre jugement (culture, communication, séniorité)." if fr else
                "No major disqualifying factors — pair with your judgement on culture, communication, and seniority."
            )

        # ── Score math + recommendation (recruiter) ──
        if fr:
            why_score = (
                f"Sémantique {semantic:.0f}×0,40 = {sem_pts} pts · Graphe de compétences {skill_px:.0f}×0,30 = {skill_pts} pts · "
                f"Lexical {tfidf:.0f}×0,15 = {tfidf_pts} pts · URL +{url_pts:.0f} → score {score:.1f}."
            )
            action = (
                "Entretien prioritaire" if score >= 82 else
                "Présélectionner"       if score >= 70 else
                "Entretien si le pipeline le permet" if score >= 55 else
                "Garder en réserve"     if score >= 40 else "Écarter"
            )
            ramp = (
                "Opérationnel immédiatement." if len(missing) == 0 else
                "≈1–2 semaines d'intégration." if len(missing) <= 2 else
                "≈3–5 semaines d'intégration." if len(missing) <= 4 else
                "Montée en compétence importante (6+ semaines)."
            )
            probe_line = (
                f"À sonder en entretien : {join.join(probes)}." if probes else
                "Valider la profondeur d'expérience en entretien."
            )
        else:
            why_score = (
                f"Semantic {semantic:.0f}×0.40 = {sem_pts} pts · Skill-graph {skill_px:.0f}×0.30 = {skill_pts} pts · "
                f"Lexical {tfidf:.0f}×0.15 = {tfidf_pts} pts · URL +{url_pts:.0f} → composite {score:.1f}."
            )
            action = (
                "Fast-track to interview" if score >= 82 else
                "Shortlist"               if score >= 70 else
                "Interview if pipeline allows" if score >= 55 else
                "Hold as backup"          if score >= 40 else "Pass"
            )
            ramp = (
                "Ready to contribute immediately." if len(missing) == 0 else
                "~1–2 weeks onboarding." if len(missing) <= 2 else
                "~3–5 weeks onboarding." if len(missing) <= 4 else
                "Significant ramp-up (6+ weeks)."
            )
            probe_line = (
                f"Probe in interview: {join.join(probes)}." if probes else
                "Validate depth of experience in the interview."
            )

        # ── Recruiter: suggested interview questions (concrete, role-specific) ──
        iq = []
        if missing:
            top = missing[:2]
            iq.append(
                f"Comment monteriez-vous en compétence sur {' et '.join(top)} ? Avez-vous utilisé quelque chose d'adjacent en production ?" if fr else
                f"How would you ramp up on {' and '.join(top)}? Have you used anything adjacent in production?"
            )
        if matched:
            iq.append(
                f"Décrivez un projet concret où vous avez utilisé {matched[0]} : la décision technique la plus difficile et le compromis retenu." if fr else
                f"Walk me through a real project where you used {matched[0]} — the hardest technical decision and the trade-off you made."
            )
        if score >= 70:
            iq.append(
                "Racontez le système le plus complexe que vous ayez conçu de bout en bout : votre rôle, l'échelle et ce que vous changeriez aujourd'hui." if fr else
                "Tell me about the most complex system you designed end-to-end — your role, the scale, and what you'd change today."
            )
        else:
            iq.append(
                "Donnez un exemple où vous avez appris une technologie inconnue sous contrainte de délai : votre méthode et le résultat." if fr else
                "Give an example where you learned an unfamiliar technology under deadline — your approach and the outcome."
            )
        iq.append(
            "Décrivez une situation où vous avez piloté une fonctionnalité de bout en bout : gestion de l'ambiguïté et façon de vous débloquer." if fr else
            "Describe a time you owned a feature end-to-end — how you handled ambiguity and unblocked yourself."
        )

        # ── Candidate message — a rich, specific explanation of WHY this match landed ──
        mlist    = (join.join(matched[:3]) + ("…" if len(matched) > 3 else "")) if matched else ""
        misslist = join.join(missing[:3]) if missing else ""
        if score >= 82:
            c_head = f"Profil idéal pour {job_title}" if fr else f"Outstanding fit for {job_title}"
            c_fb = (
                f"Vous êtes un match de premier rang pour {job_title} ({score:.1f}%), et voici précisément pourquoi. "
                f"D'abord, vous démontrez {mlist or 'les compétences attendues'} — le cœur même de ce que le poste exige. "
                f"Ensuite, votre expérience présente une similarité sémantique de {semantic:.0f}% avec la fiche de poste : le modèle lit votre parcours comme réellement pertinent sur le fond, et pas un simple chevauchement de mots-clés. "
                f"Enfin, vous couvrez {skill_pct:.0f}% des compétences requises ({len(matched)}/{skill_total or '—'}). Les profils de ce niveau sont rares." if fr else
                f"You're a top-tier match for {job_title} ({score:.1f}%), and here's exactly why. "
                f"First, you demonstrate {mlist or 'the expected skills'} — the very core of what this role needs. "
                f"Second, your experience aligns semantically at {semantic:.0f}% with the job description: the model reads your background as genuinely on-topic, not just keyword overlap. "
                f"Third, you cover {skill_pct:.0f}% of the required skills ({len(matched)}/{skill_total or '—'}). Profiles at this level are rare."
            )
            c_enc = ("Profitez de cette dynamique — un profil qui se remarque. Postulez à des postes similaires en confiance." if fr else
                     "Lean into this momentum — a profile that gets noticed. Apply to similar roles confidently.")
        elif score >= 70:
            c_head = f"Forte correspondance pour {job_title}" if fr else f"Strong match for {job_title}"
            c_fb = (
                f"Vous avez obtenu {score:.1f}% — une forte correspondance pour {job_title}, et plusieurs éléments l'expliquent. "
                f"Vous apportez {mlist or 'les compétences clés du poste'}, votre expérience est jugée pertinente sur le fond (similarité sémantique de {semantic:.0f}%, au-delà des seuls mots-clés), "
                f"et vous couvrez {skill_pct:.0f}% des compétences requises ({len(matched)}/{skill_total or '—'}). C'est cette combinaison qui vous place dans ce palier." if fr else
                f"You scored {score:.1f}% — a strong match for {job_title}, and several things drive it. "
                f"You bring {mlist or 'the key skills'}, your experience reads as genuinely on-topic ({semantic:.0f}% semantic similarity, beyond keywords alone), "
                f"and you cover {skill_pct:.0f}% of the required skills ({len(matched)}/{skill_total or '—'}). That combination is what places you in this tier."
            )
            c_enc = ("Profil compétitif. Mettez en avant les projets concrets où vous avez utilisé ces compétences." if fr else
                     "Competitive profile. Highlight the concrete projects where you used these skills.")
        elif score >= 55:
            c_head = f"Correspondance modérée pour {job_title}" if fr else f"Moderate match for {job_title}"
            c_fb = (
                f"Votre score est {score:.1f}% — une correspondance modérée, fondée sur un signal réel. "
                f"Vous correspondez sur {mlist or 'certaines compétences'} et votre profil recoupe le poste à {semantic:.0f}% de similarité sémantique. "
                f"L'écart avec un palier supérieur vient surtout de {misslist or 'la profondeur attendue sur les domaines clés'}." if fr else
                f"Your score is {score:.1f}% — a moderate match built on real signal. "
                f"You match on {mlist or 'some skills'} and your profile overlaps the role at {semantic:.0f}% semantic similarity. "
                f"The gap to a higher tier comes mainly from {misslist or 'expected depth in the core areas'}."
            )
            c_enc = ("Vous êtes plus proche que vous ne le pensez — les axes ci-dessous vous font franchir un palier." if fr else
                     "You're closer than you think — the areas below move you up a tier.")
        elif score >= 40:
            c_head = f"Correspondance limitée pour {job_title}" if fr else f"Limited match for {job_title}"
            c_fb = (
                f"Vous avez {score:.1f}% — un alignement partiel. "
                f"{('Vous correspondez bien sur ' + mlist + ', mais ') if mlist else ''}votre CV apparaît adjacent à {job_title} plutôt que central "
                f"(similarité sémantique de {semantic:.0f}%), et des compétences clés requises n'ont pas été détectées{(' : ' + misslist) if misslist else ''}." if fr else
                f"You scored {score:.1f}% — partial alignment. "
                f"{('You matched well on ' + mlist + ', but ') if mlist else ''}your CV reads adjacent to {job_title} rather than central "
                f"({semantic:.0f}% semantic similarity), and key required skills weren't detected{(': ' + misslist) if misslist else ''}."
            )
            c_enc = ("Visez des postes plus proches de votre expertise, ou investissez dans les compétences ci-dessous." if fr else
                     "Target roles closer to your expertise, or invest in the skills below.")
        else:
            c_head = f"Pas adapté à {job_title} — mais des pistes utiles" if fr else f"Not a fit for {job_title} — but useful feedback"
            c_fb = (
                f"Votre score était {score:.1f}%. L'IA n'a pas trouvé l'expérience clé qu'exige {job_title} : "
                f"l'alignement sémantique n'était que de {semantic:.0f}% et aucune des compétences requises n'est ressortie. "
                f"Ce n'est pas un jugement sur votre valeur — ce poste et votre CV pointent simplement dans des directions différentes." if fr else
                f"Your score was {score:.1f}%. The AI didn't find the core experience {job_title} requires: "
                f"semantic alignment was only {semantic:.0f}% and none of the required skills surfaced. "
                f"This isn't a judgement of your ability — this role and your CV simply point in different directions."
            )
            c_enc = ("Cherchez des postes correspondant à votre expertise réelle — votre score y sera bien plus élevé." if fr else
                     "Look for roles matching your real expertise — your score there will be far higher.")

        # next-tier nudge
        if points_to_next and points_to_next <= 25:
            nl = next_label_fr if fr else next_label_en
            c_fb += (f" Il vous manque {points_to_next:.0f} points pour atteindre « {nl} »." if fr
                     else f" You're {points_to_next:.0f} points from a {nl}.")

        # Actionable areas are only for candidates who weren't a strong match —
        # for strong/exceptional fits the "why you were chosen" explanation stands alone.
        areas = []
        if score < 70:
            if missing:
                areas.append({
                    "title": "Compétences à développer" if fr else "Develop these skills",
                    "items": missing[:6],
                    "detail": (
                        f"Ce sont les {len(missing)} compétences requises non détectées sur votre CV. Pour chacune, réalisez un petit projet ou suivez un cours ciblé, puis ajoutez-la à votre CV." if fr else
                        f"These are the {len(missing)} required skills not detected on your CV. For each, build a small project or take a focused course, then add it to your CV."
                    ),
                })
            if semantic < 60 and skill_total > 0:
                areas.append({
                    "title": "Reformulez le vocabulaire de votre CV" if fr else "Reframe your CV language",
                    "items": [],
                    "detail": (
                        f"Similarité sémantique de {semantic:.0f}% : vous employez sans doute un vocabulaire différent de celui du poste. Relisez la fiche et reprenez ses termes là où ils décrivent fidèlement votre travail." if fr else
                        f"Semantic similarity was {semantic:.0f}%: you likely use different vocabulary than the role. Re-read the description and mirror its terms where they accurately describe your work."
                    ),
                })
            if matched:
                areas.append({
                    "title": "Valorisez vos atouts" if fr else "Highlight what you matched",
                    "items": matched[:5],
                    "detail": (
                        "Rendez ces compétences visibles dans le premier tiers de votre CV, avec des résultats concrets (chiffres, échelle, impact)." if fr else
                        "Make these skills visible in the first third of your CV, with concrete outcomes (numbers, scale, impact)."
                    ),
                })

        # ── Metric breakdown (localized label + explanation) ──
        if fr:
            bd = {
                "semantic_match": {
                    "score": round(semantic, 1), "label": "Alignement sémantique",
                    "color": "emerald" if semantic >= 70 else "amber" if semantic >= 50 else "red",
                    "explanation": f"Le modèle BAAI/bge a calculé {semantic:.0f}% de similarité sémantique entre ce CV et la fiche de poste — au-delà des simples mots-clés.",
                },
                "skill_coverage": {
                    "score": round(skill_pct, 1), "label": "Couverture des compétences",
                    "color": "emerald" if skill_pct >= 70 else "amber" if skill_pct >= 40 else "red",
                    "explanation": f"Le graphe de compétences a détecté {len(matched)} compétences sur {skill_total} requises ({skill_pct:.0f}%)."
                                   + (f" Présentes : {join.join(matched[:5])}." if matched else "")
                                   + (f" Manquantes : {join.join(missing[:5])}." if missing else ""),
                },
                "tfidf_lexical": {
                    "score": round(tfidf, 1), "label": "Pertinence lexicale",
                    "color": "emerald" if tfidf >= 65 else "amber" if tfidf >= 45 else "red",
                    "explanation": f"L'analyse TF-IDF du chevauchement de vocabulaire donne {tfidf:.0f}% — un filet de sécurité pour la terminologie spécialisée.",
                },
                "composite": {
                    "score": round(score, 1), "label": "Score composite",
                    "color": "emerald" if score >= 70 else "amber" if score >= 50 else "red",
                    "explanation": f"Score final {score:.1f}% = sémantique (40%) + graphe de compétences (30%) + lexical (15%) + signaux URL (≤15 pts). {why_score}",
                },
            }
        else:
            bd = {
                "semantic_match": {
                    "score": round(semantic, 1), "label": "Semantic Alignment",
                    "color": "emerald" if semantic >= 70 else "amber" if semantic >= 50 else "red",
                    "explanation": f"The fine-tuned BAAI/bge model computed {semantic:.0f}% semantic similarity between this CV and the job description — far beyond keyword matching.",
                },
                "skill_coverage": {
                    "score": round(skill_pct, 1), "label": "Skill Coverage",
                    "color": "emerald" if skill_pct >= 70 else "amber" if skill_pct >= 40 else "red",
                    "explanation": f"The skill graph detected {len(matched)} of {skill_total} required skills ({skill_pct:.0f}%)."
                                   + (f" Matched: {join.join(matched[:5])}." if matched else "")
                                   + (f" Missing: {join.join(missing[:5])}." if missing else ""),
                },
                "tfidf_lexical": {
                    "score": round(tfidf, 1), "label": "Lexical Relevance",
                    "color": "emerald" if tfidf >= 65 else "amber" if tfidf >= 45 else "red",
                    "explanation": f"TF-IDF vocabulary-overlap analysis yielded {tfidf:.0f}% — a backstop for domain-specific terminology.",
                },
                "composite": {
                    "score": round(score, 1), "label": "Composite Score",
                    "color": "emerald" if score >= 70 else "amber" if score >= 50 else "red",
                    "explanation": f"Final {score:.1f}% = semantic (40%) + skill-graph (30%) + lexical (15%) + URL signals (≤15 pts). {why_score}",
                },
            }

        return {
            "why_hire": " ".join(wh),
            "why_not_hire": " ".join(wn),
            "strengths": wh[1:],
            "weaknesses": wn,
            "why_score": why_score,
            "recommended_action": action,
            "ramp_up": ramp,
            "interview_probe_line": probe_line,
            "interview_questions": iq,
            "metric_breakdown": bd,
            "candidate_message": {
                "headline": c_head,
                "feedback": c_fb,
                "improvement_areas": areas,
                "encouragement": c_enc,
            },
        }

    en = _prose(False)
    fr = _prose(True)

    return {
        "overall_score":   round(score, 1),
        "overall_label":   label,
        "matched_skills":  matched,
        "missing_skills":  missing,
        "interview_probes": probes,
        "score_math": {
            "semantic": round(semantic, 1), "skill": round(skill_px, 1),
            "tfidf": round(tfidf, 1), "url_boost": url_pts,
            "sem_pts": sem_pts, "skill_pts": skill_pts, "tfidf_pts": tfidf_pts,
            "points_to_next": points_to_next, "next_label": next_label_en,
            "url_absent": url_absent,
        },
        # English flat fields (back-compat with any previously stored scores)
        "why_hire":          en["why_hire"],
        "why_not_hire":      en["why_not_hire"],
        "strengths":         en["strengths"],
        "weaknesses":        en["weaknesses"],
        "why_score":         en["why_score"],
        "recommended_action": en["recommended_action"],
        "ramp_up":           en["ramp_up"],
        "interview_probe_line": en["interview_probe_line"],
        "interview_questions": en["interview_questions"],
        "metric_breakdown":  en["metric_breakdown"],
        "candidate_message": en["candidate_message"],
        # Localized blocks — frontend renders i18n[lang]
        "i18n": {"en": en, "fr": fr},
    }


@router.post("/jobs/{job_id}/score-all", tags=["recruiter"])
def score_all_applications(
    job_id: int,
    user: User = Depends(require_role("recruiter", "admin")),
    db: Session = Depends(get_db),
):
    """Run AI scoring on every application for a job and return ranked results with explanations."""
    job = db.query(JobOffer).filter(JobOffer.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.recruiter_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not your job offer")

    apps = db.query(Application).filter(Application.job_offer_id == job_id).all()
    if not apps:
        return []

    eng = None
    try:
        eng = _get_engine()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"AI engine unavailable: {e}")

    job_text = job.description + " " + (job.requirements or "")
    results = []

    for app_obj in apps:
        cv = db.query(CVFile).filter(
            CVFile.id == app_obj.cv_file_id, CVFile.is_active == True
        ).first() if app_obj.cv_file_id else None

        if not cv:
            cv = db.query(CVFile).filter(
                CVFile.owner_id == app_obj.candidate_id, CVFile.is_active == True
            ).first()

        if not cv or not cv.cv_text:
            results.append({**app_obj.to_dict(), "explanation": None, "score_breakdown": None})
            continue

        try:
            raw = eng.match(cv.cv_text, job_text)
            score = float(raw.get("total_score") or raw.get("score") or 0)
            matched = raw.get("matched_skills", []) or []
            missing = raw.get("missing_skills", []) or []
            expl = _generate_explanation(cv.cv_text, job, raw)

            app_obj.match_score = score
            app_obj.matched_skills = json.dumps(matched)
            app_obj.missing_skills = json.dumps(missing)
            app_obj.explanation = json.dumps(expl)
            app_obj.score_breakdown = json.dumps(expl["metric_breakdown"])
            app_obj.is_ai_scored = True
            if app_obj.status == "pending":
                app_obj.status = "reviewed"
            db.add(app_obj)

            results.append({**app_obj.to_dict(), "explanation": expl})
        except Exception as e:
            logger.warning("Scoring failed for app %s: %s", app_obj.id, e)
            results.append(app_obj.to_dict())

    db.commit()
    results.sort(key=lambda x: x.get("match_score") or 0, reverse=True)
    return results


@router.get("/admin/stats", tags=["admin"])
def admin_stats(user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    total_users = db.query(User).count()
    total_candidates = db.query(User).filter(User.role == "candidate").count()
    total_recruiters = db.query(User).filter(User.role == "recruiter").count()
    total_jobs = db.query(JobOffer).count()
    active_jobs = db.query(JobOffer).filter(JobOffer.is_active == True).count()
    total_applications = db.query(Application).count()
    flagged_jobs = db.query(JobOffer).filter(JobOffer.is_flagged == True).count()

    avg_score_row = db.query(Application).filter(Application.match_score.isnot(None)).all()
    avg_score = (
        sum(a.match_score for a in avg_score_row) / len(avg_score_row)
        if avg_score_row else None
    )

    return {
        "total_users": total_users,
        "total_candidates": total_candidates,
        "total_recruiters": total_recruiters,
        "total_jobs": total_jobs,
        "active_jobs": active_jobs,
        "total_applications": total_applications,
        "flagged_jobs": flagged_jobs,
        "avg_match_score": round(avg_score, 1) if avg_score else None,
    }


@router.get("/admin/users", tags=["admin"])
def admin_list_users(
    skip: int = 0, limit: int = 100,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    users = db.query(User).offset(skip).limit(limit).all()
    return [u.to_dict() for u in users]


@router.put("/admin/users/{user_id}/toggle", tags=["admin"])
def toggle_user(
    user_id: int,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    target.is_active = not target.is_active
    db.commit()
    return {"is_active": target.is_active}


@router.put("/admin/jobs/{job_id}/flag", tags=["admin"])
def flag_job(
    job_id: int,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    job = db.query(JobOffer).filter(JobOffer.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.is_flagged = not job.is_flagged
    db.commit()
    return {"is_flagged": job.is_flagged}
