"""
Core unit tests for the CV-matching platform.

These cover the pure, deterministic logic — password hashing, JWT tokens, and
the AI explanation generator — without loading the (heavy) ML matching engine,
so they run in well under a second.

    python -m pytest -q
"""

from __future__ import annotations

import os
import sys

import pytest

# Make `app` importable when running pytest from the project root.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_token,
)
from app.platform_routes import _generate_explanation


# ── Auth ───────────────────────────────────────────────────────────────────

def test_password_hash_roundtrip():
    hashed = hash_password("S3cret!pass")
    assert hashed != "S3cret!pass"          # never stored in plaintext
    assert verify_password("S3cret!pass", hashed) is True
    assert verify_password("wrong", hashed) is False


def test_jwt_roundtrip_carries_claims():
    token = create_access_token({"sub": "42", "role": "recruiter"})
    payload = decode_token(token)
    assert payload is not None
    assert payload["sub"] == "42"
    assert payload["role"] == "recruiter"
    assert "exp" in payload


def test_decode_rejects_garbage():
    assert decode_token("not.a.real.token") is None


# ── Explanation generator ────────────────────────────────────────────────────

class _Job:
    """Minimal stand-in for a JobOffer (only `.title` is used)."""
    title = "Senior Backend Engineer"


def _explain(score, matched, missing, semantic=None, tfidf=None):
    result = {
        "total_score": score,
        "matched_skills": matched,
        "missing_skills": missing,
    }
    if semantic is not None:
        result["semantic_score"] = semantic
    if tfidf is not None:
        result["tfidf_score"] = tfidf
    return _generate_explanation("some cv text", _Job(), result)


def test_explanation_has_full_shape():
    exp = _explain(78, ["Python", "FastAPI", "Docker", "AWS"], ["Kubernetes"])
    for key in (
        "overall_score", "overall_label", "why_hire", "why_not_hire",
        "metric_breakdown", "matched_skills", "missing_skills",
        "strengths", "weaknesses", "candidate_message",
    ):
        assert key in exp, f"missing key: {key}"

    # metric breakdown always has the four signals
    assert set(exp["metric_breakdown"]) == {
        "semantic_match", "skill_coverage", "tfidf_lexical", "composite",
    }

    # candidate-facing message is fully populated
    cm = exp["candidate_message"]
    assert cm["headline"] and cm["feedback"] and cm["encouragement"]
    assert isinstance(cm["improvement_areas"], list) and len(cm["improvement_areas"]) >= 1


@pytest.mark.parametrize(
    "score,expected_label",
    [
        (90, "Exceptional Match"),
        (74, "Strong Match"),
        (60, "Moderate Match"),
        (45, "Weak Match"),
        (20, "Insufficient Match"),
    ],
)
def test_label_tiers(score, expected_label):
    exp = _explain(score, ["Python"], ["Go"])
    assert exp["overall_label"] == expected_label
    assert exp["overall_score"] == pytest.approx(score, abs=0.05)


def test_weak_match_surfaces_concerns_and_improvements():
    exp = _explain(30, [], ["Python", "FastAPI", "AWS", "Docker"], semantic=28)
    # A weak match must give the recruiter concerns…
    assert exp["why_not_hire"].strip() != ""
    assert len(exp["weaknesses"]) >= 1
    # …and the candidate actionable improvement areas built from the missing skills.
    titles = [a["title"] for a in exp["candidate_message"]["improvement_areas"]]
    assert any("Develop" in t for t in titles)


def test_strong_match_lists_matched_skills_as_strengths():
    exp = _explain(85, ["Python", "FastAPI", "Docker", "AWS", "PostgreSQL"], [], semantic=84)
    assert exp["matched_skills"]
    # composite metric explanation should reference the score
    assert "%" in exp["metric_breakdown"]["composite"]["explanation"]


def test_bilingual_block_present_and_differs():
    exp = _explain(78, ["Python", "FastAPI", "Docker"], ["Kubernetes"], semantic=80, tfidf=40)
    assert "i18n" in exp and {"en", "fr"} <= set(exp["i18n"])
    en, fr = exp["i18n"]["en"], exp["i18n"]["fr"]
    # both languages carry the full structure
    for block in (en, fr):
        for key in ("why_hire", "why_not_hire", "metric_breakdown", "candidate_message",
                    "recommended_action", "why_score", "ramp_up"):
            assert key in block and block[key]
    # and they're actually translated (not identical English)
    assert en["why_hire"] != fr["why_hire"]
    assert en["recommended_action"] != fr["recommended_action"]
    # French metric label is localized
    assert fr["metric_breakdown"]["semantic_match"]["label"] == "Alignement sémantique"


def test_score_math_and_probes():
    exp = _explain(78, ["Python", "FastAPI", "Docker"], ["Kubernetes", "Terraform"], semantic=80, tfidf=40)
    sm = exp["score_math"]
    for key in ("semantic", "skill", "tfidf", "sem_pts", "skill_pts", "tfidf_pts", "points_to_next"):
        assert key in sm
    # weighted points reflect the documented 40/30/15 model
    assert sm["sem_pts"] == pytest.approx(80 * 0.40, abs=0.1)
    # interview probes surface the missing skills
    assert "Kubernetes" in exp["interview_probes"]
