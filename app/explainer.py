"""
Rule-based explanation generator for CV-Job match results.

Pure Python logic: no LLM/AI calls. Produces human-readable, structured
explanations from a match-result dictionary.
"""

from __future__ import annotations

from typing import Any, Dict, List


class Explainer:
    """Generate human-readable explanations for CV-Job match results."""

    # ------------------------------------------------------------------
    # Rating tiers
    # ------------------------------------------------------------------
    RATING_EXCELLENT = "Excellent"
    RATING_STRONG = "Strong"
    RATING_MODERATE = "Moderate"
    RATING_WEAK = "Weak"

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def get_rating(self, score: float) -> str:
        """Return the tier label for a numeric score."""
        try:
            s = float(score)
        except (TypeError, ValueError):
            s = 0.0

        if s >= 85:
            return self.RATING_EXCELLENT
        if s >= 70:
            return self.RATING_STRONG
        if s >= 50:
            return self.RATING_MODERATE
        return self.RATING_WEAK

    def generate_short(self, match_result: Dict[str, Any]) -> str:
        """Return a 2-3 sentence summary of the match."""
        score = self._safe_float(match_result.get("total_score", 0))
        rating = self.get_rating(score)
        matched = match_result.get("matched_skills") or []
        missing = match_result.get("missing_skills") or []

        rounded = round(score, 1)

        if rating == self.RATING_EXCELLENT:
            top = ", ".join(matched[:3]) if matched else "your core skills"
            return (
                f"You scored {rounded}/100 — an excellent match. "
                f"Your strengths in {top} align well with this role. "
                f"Apply with confidence and lead with concrete results."
            )
        if rating == self.RATING_STRONG:
            top = ", ".join(matched[:2]) if matched else "your existing skills"
            gap = missing[0] if missing else "secondary requirements"
            return (
                f"You scored {rounded}/100 — a strong match worth pursuing. "
                f"Lean on {top} and be prepared to address {gap}."
            )
        if rating == self.RATING_MODERATE:
            top = matched[0] if matched else "transferable experience"
            gap = missing[0] if missing else "advanced requirements"
            return (
                f"You scored {rounded}/100 — a moderate match. "
                f"You bring {top}, but expect to discuss {gap} during interviews."
            )
        # Weak
        gap = missing[0] if missing else "the core technical stack"
        return (
            f"You scored {rounded}/100 — a weak match. "
            f"Significant gaps remain in {gap}; consider building experience "
            f"before applying."
        )

    def generate(self, match_result: Dict[str, Any]) -> str:
        """Generate the full structured explanation."""
        if not isinstance(match_result, dict):
            match_result = {}

        score = self._safe_float(match_result.get("total_score", 0))
        rounded_score = round(score, 1)

        matched_skills: List[str] = list(match_result.get("matched_skills") or [])
        missing_skills: List[str] = list(match_result.get("missing_skills") or [])
        partial_skills: List[Dict[str, Any]] = list(
            match_result.get("partial_skills") or []
        )
        url_signals: List[str] = list(match_result.get("url_signals") or [])
        url_boost = self._safe_float(match_result.get("url_boost", 0))

        sections = match_result.get("matching_sections") or {}
        if not isinstance(sections, dict):
            sections = {}

        rating_statement = self._rating_statement(score, missing_skills)

        # Strong matches block
        strong_lines: List[str] = []
        if matched_skills:
            for idx, skill in enumerate(matched_skills[:8]):
                if idx == 0:
                    strong_lines.append(f"- {skill}: exactly what this role needs")
                elif idx == 1:
                    strong_lines.append(f"- {skill}: strong requirement match")
                else:
                    strong_lines.append(f"- {skill}: aligns with role expectations")
        else:
            strong_lines.append("- No exact skill matches found")

        # Partial matches block
        partial_lines: List[str] = []
        if partial_skills:
            for entry in partial_skills:
                if not isinstance(entry, dict):
                    continue
                skill = entry.get("skill", "unknown skill")
                required = entry.get("matched_via", "a required skill")
                # Coverage from similarity or weight (assume 0..1 range)
                coverage_raw = entry.get("similarity")
                if coverage_raw is None:
                    coverage_raw = entry.get("weight", 0.5)
                coverage = self._safe_float(coverage_raw)
                if 0 <= coverage <= 1:
                    pct = int(round(coverage * 100))
                else:
                    # Already a percentage
                    pct = int(round(coverage))
                pct = max(0, min(100, pct))
                partial_lines.append(
                    f"- {skill} (related to {required}): "
                    f"covers approximately {pct}% of the requirement"
                )
        if not partial_lines:
            partial_lines.append("- No partial matches")

        # Missing skills block
        missing_lines: List[str] = []
        if missing_skills:
            for idx, skill in enumerate(missing_skills[:8]):
                if idx == 0:
                    missing_lines.append(
                        f"- {skill}: required but not found in your profile"
                    )
                elif idx == 1:
                    missing_lines.append(f"- {skill}: important for this role")
                else:
                    missing_lines.append(f"- {skill}: listed in role requirements")
        else:
            missing_lines.append("- No significant gaps found")

        # Profile signals block
        signal_lines: List[str] = []
        if url_signals:
            for signal in url_signals:
                signal_lines.append(f"- {signal}")
        else:
            signal_lines.append("- No external profile URLs detected")

        # Section breakdown
        experience_score = self._format_section_pct(sections.get("experience", 0))
        skills_score = self._format_section_pct(sections.get("skills", 0))
        education_score = self._format_section_pct(sections.get("education", 0))
        projects_score = self._format_section_pct(sections.get("projects", 0))

        # Recommendation + next steps
        recommendation = self._recommendation(
            score, matched_skills, missing_skills, url_boost
        )
        next_steps = self._next_steps(score, matched_skills, missing_skills)

        # Assemble
        parts: List[str] = []
        parts.append(f"You scored {rounded_score}/100 for this position.")
        parts.append("")
        parts.append(rating_statement)
        parts.append("")
        parts.append("✅ Strong matches:")
        parts.extend(strong_lines)
        parts.append("")
        parts.append("\U0001f517 Partial matches:")
        parts.extend(partial_lines)
        parts.append("")
        parts.append("❌ Missing skills:")
        parts.extend(missing_lines)
        parts.append("")
        parts.append("\U0001f517 Profile signals:")
        parts.extend(signal_lines)
        parts.append("")
        parts.append("\U0001f4ca Section breakdown:")
        parts.append(f"- Experience relevance: {experience_score}%")
        parts.append(f"- Skills alignment: {skills_score}%")
        parts.append(f"- Education fit: {education_score}%")
        parts.append(f"- Projects portfolio: {projects_score}%")
        parts.append("")
        parts.append("\U0001f4a1 Recommendation:")
        parts.append(recommendation)
        parts.append("")
        parts.append(f"\U0001f680 Next steps: {next_steps}")

        return "\n".join(parts)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _rating_statement(self, score: float, missing_skills: List[str]) -> str:
        """Return the rating sentence based on the score tier."""
        top_gap = missing_skills[0] if missing_skills else "any remaining gaps"

        if score >= 85:
            return (
                "Excellent match — you meet most core requirements. "
                "This role is a great fit for your profile."
            )
        if score >= 70:
            return (
                "Strong match with some gaps — definitely apply. "
                f"Address {top_gap} in your cover letter."
            )
        if score >= 50:
            return (
                "Moderate match — worth applying with preparation. "
                f"Be ready to discuss {top_gap}."
            )
        return (
            "Weak match — significant skill gaps exist. "
            f"Consider building experience in {top_gap} before applying."
        )

    def _recommendation(
        self,
        score: float,
        matched_skills: List[str],
        missing_skills: List[str],
        url_boost: float,
    ) -> str:
        """Return actionable advice tied to the score and gaps."""
        top_matched_3 = ", ".join(matched_skills[:3]) if matched_skills else "your strongest skills"
        top_matched_2 = ", ".join(matched_skills[:2]) if matched_skills else "your strongest skills"
        top_missing_1 = missing_skills[0] if missing_skills else "secondary requirements"
        top_missing_2 = ", ".join(missing_skills[:2]) if missing_skills else "weaker areas"
        all_matched = ", ".join(matched_skills) if matched_skills else "your current skill set"

        if score >= 85 and url_boost > 5:
            return (
                "Your profile signals (GitHub/portfolio) strengthen this "
                "application. Lead with your strongest projects."
            )
        if score >= 85:
            return (
                f"Tailor your cover letter to highlight {top_matched_3}. "
                "You have a competitive profile."
            )
        if score >= 70:
            return (
                f"Emphasize {top_matched_2} in your application. "
                f"Mention you're learning {top_missing_1} if applicable."
            )
        if score >= 50:
            return (
                f"You have a foundation with {top_matched_2}. "
                f"Work on {top_missing_2} to improve competitiveness."
            )
        return (
            "This role needs skills significantly different from your current "
            f"profile. Consider roles requiring {all_matched} instead."
        )

    def _next_steps(
        self,
        score: float,
        matched_skills: List[str],
        missing_skills: List[str],
    ) -> str:
        """Return concrete next-step advice."""
        if score >= 85:
            return (
                "polish your CV for ATS, prepare 2-3 STAR-format stories about "
                "your top achievements, and submit your application this week."
            )
        if score >= 70:
            top_gap = missing_skills[0] if missing_skills else "any gap area"
            return (
                f"customize your cover letter, study {top_gap} fundamentals, "
                "and apply within the next 7 days."
            )
        if score >= 50:
            top_gap = missing_skills[0] if missing_skills else "the main gap area"
            return (
                f"spend 1-2 weeks practising {top_gap} (build a small project), "
                "then apply with a tailored cover letter."
            )
        # Weak
        focus = missing_skills[0] if missing_skills else "the core stack"
        return (
            f"build a structured learning plan around {focus}, ship a portfolio "
            "project, and revisit similar roles in 1-3 months."
        )

    @staticmethod
    def _safe_float(value: Any) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    @classmethod
    def _format_section_pct(cls, value: Any) -> str:
        """Normalise a section value into an integer percentage string."""
        v = cls._safe_float(value)
        if 0 <= v <= 1:
            v *= 100
        v = max(0.0, min(100.0, v))
        return str(int(round(v)))


__all__ = ["Explainer"]
