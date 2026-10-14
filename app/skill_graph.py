"""
Skill Graph / Proximity Engine
==============================

A skill proximity graph and cluster system for the CV-Job Matching Engine.

This module exposes a :class:`SkillGraph` that:

- Knows a comprehensive catalog of technical skills grouped into clusters
  (OOP languages, Frontend, JS Frameworks, Backend Frameworks, Databases,
  Cloud, DevOps, Data/ML, Mobile, Testing, Version Control, ...).
- Extracts skills from arbitrary CV / job-description text using
  case-insensitive regex matching.
- Computes a proximity score in ``[0.0, 1.0]`` between any two skills,
  based on a sub-cluster (nested) proximity model.
- Compares a CV skill list against a job's required skill list and produces
  a structured report with matched / partial / missing skills and an
  overall proximity score (0-100).
- Provides a single ``score_cv_against_job`` entry point that runs the
  whole pipeline directly from raw text.
"""

from __future__ import annotations

import re
from typing import Dict, Iterable, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Skill catalog
# ---------------------------------------------------------------------------

# Top-level clusters. The canonical (display) form of every skill is the
# value stored here; matching is case-insensitive and tolerant to common
# punctuation / spacing differences.
SKILL_CLUSTERS: Dict[str, List[str]] = {
    "OOP Languages": [
        "Python", "Java", "PHP", "C++", "C#", "Ruby", "Kotlin", "Swift", "Go",
    ],
    "Frontend": [
        "HTML", "CSS", "Bootstrap", "Tailwind", "SASS", "LESS", "PostCSS",
    ],
    "JS Frameworks": [
        "React", "Vue", "Angular", "Next.js", "Nuxt", "Svelte", "SolidJS",
    ],
    "Backend Frameworks": [
        "Django", "Flask", "FastAPI", "Spring", "Laravel", "Express",
        "Rails", "ASP.NET",
    ],
    "Databases": [
        "MySQL", "PostgreSQL", "MongoDB", "SQLite", "Redis", "Oracle",
        "Cassandra", "DynamoDB",
    ],
    "Cloud": [
        "AWS", "Azure", "GCP", "DigitalOcean", "Heroku", "Vercel",
        "Netlify", "Cloudflare",
    ],
    "DevOps": [
        "Docker", "Kubernetes", "CI/CD", "GitHub Actions", "Jenkins",
        "Terraform", "Ansible",
    ],
    "Data/ML": [
        "TensorFlow", "PyTorch", "Scikit-learn", "Pandas", "NumPy",
        "Keras", "XGBoost", "NLTK", "SpaCy", "HuggingFace",
    ],
    "Mobile": [
        "Android", "iOS", "React Native", "Flutter", "Xamarin",
        "Swift", "Kotlin",
    ],
    "Testing": [
        "Jest", "Pytest", "Mocha", "Selenium", "Cypress", "JUnit",
    ],
    "Version Control": [
        "Git", "GitHub", "GitLab", "Bitbucket",
    ],
}


# Sub-clusters: skills inside the same sub-cluster are considered very
# close (high proximity). Skills in the same top-level cluster but in
# different sub-clusters are still related, but less so.
#
# Each entry maps a top-level cluster name -> list of sub-cluster groups,
# where each group is a list of canonical skill names.
SUB_CLUSTERS: Dict[str, List[List[str]]] = {
    "OOP Languages": [
        ["Python", "Ruby"],                       # dynamic / scripting
        ["Java", "Kotlin", "Swift", "C#"],        # statically typed, JVM/.NET-ish
        ["C++", "Go"],                            # systems-leaning
        ["PHP"],                                  # web-server scripting
    ],
    "Frontend": [
        ["CSS", "Bootstrap", "Tailwind", "SASS", "LESS", "PostCSS"],  # styling
        ["HTML"],                                                      # markup
    ],
    "JS Frameworks": [
        ["React", "Next.js"],
        ["Vue", "Nuxt"],
        ["Angular"],
        ["Svelte", "SolidJS"],
    ],
    "Backend Frameworks": [
        ["Django", "Flask", "FastAPI"],          # Python
        ["Spring"],                              # Java
        ["Laravel"],                             # PHP
        ["Express"],                             # Node
        ["Rails"],                               # Ruby
        ["ASP.NET"],                             # .NET
    ],
    "Databases": [
        ["MySQL", "PostgreSQL", "SQLite", "Oracle"],   # relational
        ["MongoDB", "Cassandra", "DynamoDB"],          # NoSQL document/wide
        ["Redis"],                                     # in-memory KV
    ],
    "Cloud": [
        ["AWS", "Azure", "GCP"],                                     # hyperscalers
        ["DigitalOcean", "Heroku"],                                  # PaaS-ish
        ["Vercel", "Netlify"],                                       # frontend hosting
        ["Cloudflare"],                                              # edge / CDN
    ],
    "DevOps": [
        ["Docker", "Kubernetes"],                                    # containers
        ["CI/CD", "GitHub Actions", "Jenkins"],                      # pipelines
        ["Terraform", "Ansible"],                                    # IaC
    ],
    "Data/ML": [
        ["TensorFlow", "PyTorch", "Keras"],                          # deep learning
        ["Scikit-learn", "XGBoost"],                                 # classical ML
        ["Pandas", "NumPy"],                                         # data wrangling
        ["NLTK", "SpaCy", "HuggingFace"],                            # NLP
    ],
    "Mobile": [
        ["Android", "Kotlin"],
        ["iOS", "Swift"],
        ["React Native", "Flutter", "Xamarin"],                      # cross-platform
    ],
    "Testing": [
        ["Pytest", "JUnit"],                                         # unit (server)
        ["Jest", "Mocha"],                                           # unit (JS)
        ["Selenium", "Cypress"],                                     # e2e / browser
    ],
    "Version Control": [
        ["Git"],
        ["GitHub", "GitLab", "Bitbucket"],                           # hosted platforms
    ],
}


# Proximity tiers
PROX_SAME = 1.0           # identical skill
PROX_SUB_CLUSTER = 0.85   # same sub-cluster (very close, e.g. CSS vs Bootstrap)
PROX_CLUSTER = 0.65       # same top-level cluster, different sub-cluster
PROX_RELATED = 0.25       # cross-cluster but logically related (curated pairs)
PROX_NONE = 0.0           # unrelated


# Curated cross-cluster relations (still small but non-zero proximity).
# This is intentionally conservative.
CROSS_CLUSTER_RELATIONS: Dict[Tuple[str, str], float] = {
    # python ecosystem
    ("Python", "Django"): 0.30,
    ("Python", "Flask"): 0.30,
    ("Python", "FastAPI"): 0.30,
    ("Python", "Pandas"): 0.30,
    ("Python", "NumPy"): 0.30,
    ("Python", "Pytest"): 0.30,
    # JS ecosystem
    ("JavaScript", "React"): 0.30,  # JavaScript isn't catalogued, but kept for safety
    ("React", "Jest"): 0.25,
    ("Vue", "Jest"): 0.20,
    ("Express", "Jest"): 0.25,
    # mobile <-> language
    ("Android", "Java"): 0.30,
    ("iOS", "Swift"): 0.30,
    # cloud <-> devops
    ("AWS", "Docker"): 0.25,
    ("AWS", "Kubernetes"): 0.25,
    ("Azure", "Docker"): 0.25,
    ("GCP", "Kubernetes"): 0.25,
    # version control <-> ci/cd
    ("GitHub", "GitHub Actions"): 0.30,
    ("GitLab", "CI/CD"): 0.25,
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_canonical_index() -> Tuple[Dict[str, str], Dict[str, str], Dict[str, Tuple[int, int]]]:
    """Build several lookup maps from the cluster definitions.

    Returns a tuple:

    - ``norm_to_canonical``  : lower-cased skill -> canonical name
    - ``canonical_to_cluster``: canonical name  -> top-level cluster name
    - ``canonical_to_sub``   : canonical name  -> (cluster_idx, sub_idx)
    """
    norm_to_canonical: Dict[str, str] = {}
    canonical_to_cluster: Dict[str, str] = {}
    canonical_to_sub: Dict[str, Tuple[int, int]] = {}

    for cluster_idx, (cluster_name, skills) in enumerate(SKILL_CLUSTERS.items()):
        for skill in skills:
            norm_to_canonical[skill.lower()] = skill
            canonical_to_cluster[skill] = cluster_name

        sub_groups = SUB_CLUSTERS.get(cluster_name, [])
        for sub_idx, group in enumerate(sub_groups):
            for skill in group:
                canonical_to_sub[skill] = (cluster_idx, sub_idx)

    # Common aliases / alternate spellings -> canonical
    aliases: Dict[str, str] = {
        "nodejs": "Express",        # rough mapping for Node-based tools
        "node.js": "Express",
        "node": "Express",
        "postgres": "PostgreSQL",
        "postgre": "PostgreSQL",
        "mongo": "MongoDB",
        "tf": "TensorFlow",
        "sklearn": "Scikit-learn",
        "scikit learn": "Scikit-learn",
        "hugging face": "HuggingFace",
        "hugging-face": "HuggingFace",
        "tailwindcss": "Tailwind",
        "next js": "Next.js",
        "nextjs": "Next.js",
        "nuxtjs": "Nuxt",
        "asp net": "ASP.NET",
        "aspnet": "ASP.NET",
        "k8s": "Kubernetes",
        "ci-cd": "CI/CD",
        "ci cd": "CI/CD",
        "gha": "GitHub Actions",
        "gh actions": "GitHub Actions",
        "py test": "Pytest",
        "py.test": "Pytest",
        "rn": "React Native",
        "react-native": "React Native",
    }
    for alias, canonical in aliases.items():
        norm_to_canonical.setdefault(alias.lower(), canonical)

    return norm_to_canonical, canonical_to_cluster, canonical_to_sub


_NORM_TO_CANONICAL, _CANONICAL_TO_CLUSTER, _CANONICAL_TO_SUB = _build_canonical_index()


def _regex_for(skill: str) -> re.Pattern:
    """Build a robust word-boundary regex for a skill literal.

    Handles things like ``C++``, ``C#``, ``Next.js``, ``ASP.NET`` and
    ``CI/CD`` whose characters break the default ``\\b`` boundaries.
    """
    escaped = re.escape(skill)
    # We require the match to NOT be embedded inside an alphanumeric token
    # on either side, but we cannot rely on \b because of '+', '#', '.', '/'.
    return re.compile(rf"(?<![A-Za-z0-9_]){escaped}(?![A-Za-z0-9_])", re.IGNORECASE)


# Pre-compile every skill (and alias) regex once for speed.
_SKILL_PATTERNS: List[Tuple[re.Pattern, str]] = []
_seen_canonicals_for_pattern: set = set()
for _norm, _canonical in _NORM_TO_CANONICAL.items():
    # Use the original (alias or canonical) literal for matching, but
    # normalize the result back to the canonical form.
    _SKILL_PATTERNS.append((_regex_for(_norm), _canonical))


# ---------------------------------------------------------------------------
# SkillGraph
# ---------------------------------------------------------------------------

class SkillGraph:
    """Skill catalog + proximity graph + scoring pipeline."""

    # expose constants for callers / tests
    SAME = PROX_SAME
    SUB_CLUSTER = PROX_SUB_CLUSTER
    CLUSTER = PROX_CLUSTER
    RELATED = PROX_RELATED
    NONE = PROX_NONE

    PARTIAL_THRESHOLD = 0.55  # below this, a skill is considered "missing"

    def __init__(self) -> None:
        self.clusters = SKILL_CLUSTERS
        self.sub_clusters = SUB_CLUSTERS

    # ------------------------------------------------------------------ #
    # Extraction
    # ------------------------------------------------------------------ #

    def extract_skills(self, text: str) -> List[str]:
        """Return the unique canonical skills mentioned in *text*.

        Matching is case-insensitive and respects token boundaries so that
        ``"Java"`` does not match inside ``"JavaScript"``. Order is
        preserved (first occurrence wins).
        """
        if not text:
            return []

        found: List[str] = []
        seen: set = set()
        for pattern, canonical in _SKILL_PATTERNS:
            if canonical in seen:
                continue
            if pattern.search(text):
                found.append(canonical)
                seen.add(canonical)
        return found

    # ------------------------------------------------------------------ #
    # Proximity
    # ------------------------------------------------------------------ #

    def _canonicalize(self, skill: str) -> Optional[str]:
        if not skill:
            return None
        return _NORM_TO_CANONICAL.get(skill.strip().lower())

    def get_proximity(self, skill1: str, skill2: str) -> float:
        """Return a proximity score in ``[0.0, 1.0]`` between two skills."""
        c1 = self._canonicalize(skill1)
        c2 = self._canonicalize(skill2)

        if not c1 or not c2:
            return PROX_NONE

        if c1 == c2:
            return PROX_SAME

        sub1 = _CANONICAL_TO_SUB.get(c1)
        sub2 = _CANONICAL_TO_SUB.get(c2)
        cl1 = _CANONICAL_TO_CLUSTER.get(c1)
        cl2 = _CANONICAL_TO_CLUSTER.get(c2)

        # Same sub-cluster -> very close
        if sub1 is not None and sub2 is not None and sub1 == sub2:
            return PROX_SUB_CLUSTER

        # Same top-level cluster -> close-ish
        if cl1 is not None and cl2 is not None and cl1 == cl2:
            return PROX_CLUSTER

        # Curated cross-cluster relations (try both orderings)
        related = CROSS_CLUSTER_RELATIONS.get((c1, c2))
        if related is None:
            related = CROSS_CLUSTER_RELATIONS.get((c2, c1))
        if related is not None:
            return related

        return PROX_NONE

    # ------------------------------------------------------------------ #
    # Matching
    # ------------------------------------------------------------------ #

    def compute_skill_match(
        self,
        cv_skills: Iterable[str],
        job_skills: Iterable[str],
    ) -> Dict:
        """Compare a CV's skills against a job's required skills.

        Returns a dict of the form::

            {
              "matched_skills":   ["Python", "FastAPI", ...],
              "partial_skills":   [{"skill": "CSS", "matched_via": "Bootstrap",
                                    "similarity": 0.85}, ...],
              "missing_skills":   ["AWS", "Docker", ...],
              "skill_proximity_score": 78.5     # 0..100
            }
        """
        # Canonicalize and de-duplicate while preserving order
        def _clean(items: Iterable[str]) -> List[str]:
            seen: set = set()
            out: List[str] = []
            for raw in items:
                c = self._canonicalize(raw) or (raw.strip() if raw else "")
                if not c or c in seen:
                    continue
                seen.add(c)
                out.append(c)
            return out

        cv_list = _clean(cv_skills)
        job_list = _clean(job_skills)

        matched: List[str] = []
        partial: List[Dict] = []
        missing: List[str] = []

        if not job_list:
            return {
                "matched_skills": [],
                "partial_skills": [],
                "missing_skills": [],
                "skill_proximity_score": 0.0,
            }

        cv_set = set(cv_list)
        per_job_scores: List[float] = []

        for js in job_list:
            if js in cv_set:
                matched.append(js)
                per_job_scores.append(PROX_SAME)
                continue

            # Find the closest CV skill to this required job skill
            best_skill: Optional[str] = None
            best_score: float = 0.0
            for cs in cv_list:
                score = self.get_proximity(js, cs)
                if score > best_score:
                    best_score = score
                    best_skill = cs

            if best_skill is not None and best_score >= self.PARTIAL_THRESHOLD:
                partial.append({
                    "skill": js,
                    "matched_via": best_skill,
                    "similarity": round(best_score, 2),
                })
                per_job_scores.append(best_score)
            else:
                missing.append(js)
                per_job_scores.append(best_score)  # may still be > 0 (weak related)

        proximity_score = (
            round((sum(per_job_scores) / len(per_job_scores)) * 100, 2)
            if per_job_scores else 0.0
        )

        return {
            "matched_skills": matched,
            "partial_skills": partial,
            "missing_skills": missing,
            "skill_proximity_score": proximity_score,
        }

    # ------------------------------------------------------------------ #
    # End-to-end pipeline
    # ------------------------------------------------------------------ #

    def score_cv_against_job(self, cv_text: str, job_text: str) -> Dict:
        """Run the full pipeline: extract -> match -> score.

        Returns a dict with the extracted skill lists plus the result of
        :meth:`compute_skill_match`.
        """
        cv_skills = self.extract_skills(cv_text or "")
        job_skills = self.extract_skills(job_text or "")
        match_report = self.compute_skill_match(cv_skills, job_skills)

        return {
            "cv_skills": cv_skills,
            "job_skills": job_skills,
            **match_report,
        }


# ---------------------------------------------------------------------------
# Convenience module-level singleton
# ---------------------------------------------------------------------------

_default_graph: Optional[SkillGraph] = None


def default_graph() -> SkillGraph:
    """Return a process-wide :class:`SkillGraph` singleton."""
    global _default_graph
    if _default_graph is None:
        _default_graph = SkillGraph()
    return _default_graph


__all__ = [
    "SkillGraph",
    "SKILL_CLUSTERS",
    "SUB_CLUSTERS",
    "default_graph",
]


if __name__ == "__main__":  # pragma: no cover - manual smoke test
    sg = SkillGraph()
    cv = (
        "Experienced Python developer with FastAPI, Django, PostgreSQL, "
        "Docker, GitHub Actions and React on the frontend. "
        "Used Tailwind and SASS for styling."
    )
    job = (
        "Looking for a backend engineer fluent in Python, FastAPI, AWS, "
        "Kubernetes, CSS and PostgreSQL."
    )
    from pprint import pprint
    pprint(sg.score_cv_against_job(cv, job))
