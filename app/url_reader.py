"""
URL Reader / Analyzer
=====================

Extracts URLs from CV text and analyzes them to produce additional signal
for the CV-Job Matching Engine.

Supported URL types:

- **GitHub** profiles (``https://github.com/<username>``):
  hits the public GitHub REST API to gather repo count, languages,
  top repositories (by stars), total stars and bio.
- **LinkedIn** profiles: best-effort HTML scrape (LinkedIn is heavily
  protected; we degrade gracefully when the page is gated).
- **Portfolios / personal sites**: generic HTML scrape, looking for
  technical skills mentioned anywhere on the page.
- **Other**: classified but not deeply analyzed.

Each analyzer returns a numeric ``boost_score`` that callers can add to
the overall CV/job match score. The whole pipeline is wrapped by
:func:`analyze_urls`.

External dependencies:
- ``requests``
- ``beautifulsoup4`` (``bs4``)
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional
from urllib.parse import urlparse

import requests

try:
    from bs4 import BeautifulSoup  # type: ignore
except Exception:  # pragma: no cover - bs4 is a soft dep at import time
    BeautifulSoup = None  # type: ignore

# Local skill graph (used to extract skills from fetched pages so the
# analyzer can credit only skills that the engine actually knows about).
try:
    from .skill_graph import SkillGraph  # type: ignore
except Exception:  # allow running this file standalone
    from skill_graph import SkillGraph  # type: ignore

_skill_graph = SkillGraph()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REQUEST_TIMEOUT = 5  # seconds, per URL

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36 "
        "CV-Matching-Engine/2.0"
    ),
    "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

GITHUB_API_HEADERS = {
    "User-Agent": DEFAULT_HEADERS["User-Agent"],
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}

# Permissive URL regex that handles most things found in CVs, including
# bare ``github.com/foo`` style references (we'll prefix ``https://``).
URL_REGEX = re.compile(
    r"""(
            (?:https?://|www\.)?                # optional scheme / www
            (?:[A-Za-z0-9\-]+\.)+               # one or more labels
            [A-Za-z]{2,}                        # TLD
            (?:/[^\s,;<>()\[\]\"']*)?           # optional path
        )""",
    re.VERBOSE,
)


# ---------------------------------------------------------------------------
# URL extraction & classification
# ---------------------------------------------------------------------------

def _normalize_url(url: str) -> str:
    """Add a scheme if missing and strip trailing punctuation."""
    url = url.strip().rstrip(").,;:'\"")
    if not url:
        return url
    if not re.match(r"^https?://", url, re.IGNORECASE):
        url = "https://" + url
    return url


def extract_urls(text: str) -> List[str]:
    """Return all URLs found in *text*, normalized and de-duplicated."""
    if not text:
        return []

    seen: set = set()
    out: List[str] = []
    for match in URL_REGEX.finditer(text):
        raw = match.group(1)
        # Avoid bare TLDs / file-like fragments (must look like a domain)
        if "." not in raw:
            continue
        url = _normalize_url(raw)
        # urlparse sanity check
        parsed = urlparse(url)
        if not parsed.netloc or "." not in parsed.netloc:
            continue
        if url in seen:
            continue
        seen.add(url)
        out.append(url)
    return out


def classify_url(url: str) -> str:
    """Classify a URL as ``github``, ``linkedin``, ``portfolio`` or ``other``.

    GitHub and LinkedIn are recognized by their hostnames. Everything else
    that responds like a personal site (custom domain, ``.dev``, ``.io``,
    ``.me``, ``netlify.app``, ``vercel.app``, ``github.io``, etc.) is
    treated as a portfolio. Truly unknown hosts fall back to ``other``.
    """
    if not url:
        return "other"

    host = (urlparse(url).hostname or "").lower()
    if not host:
        return "other"

    if host == "github.com" or host.endswith(".github.com"):
        return "github"
    if host == "linkedin.com" or host.endswith(".linkedin.com"):
        return "linkedin"

    portfolio_hosts = (
        "github.io", "gitlab.io", "netlify.app", "vercel.app",
        "pages.dev", "fly.dev", "herokuapp.com", "now.sh",
    )
    if any(host.endswith(suf) for suf in portfolio_hosts):
        return "portfolio"

    portfolio_tlds = (".dev", ".io", ".me", ".tech", ".portfolio", ".sh", ".codes")
    if any(host.endswith(tld) for tld in portfolio_tlds):
        return "portfolio"

    # A personal-looking host (no obvious "service" subdomain) -> portfolio
    if host.count(".") <= 2 and not host.startswith(("www.google", "www.facebook",
                                                     "www.twitter", "www.youtube",
                                                     "twitter.com", "facebook.com",
                                                     "youtube.com", "x.com",
                                                     "instagram.com", "medium.com",
                                                     "stackoverflow.com")):
        return "portfolio"

    return "other"


# ---------------------------------------------------------------------------
# Low-level fetch helper
# ---------------------------------------------------------------------------

def _safe_get(url: str, headers: Optional[Dict[str, str]] = None) -> Optional[requests.Response]:
    """GET *url* with our standard timeout / headers, swallowing errors."""
    try:
        resp = requests.get(
            url,
            headers=headers or DEFAULT_HEADERS,
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
        )
        return resp
    except requests.RequestException:
        return None
    except Exception:
        return None


def _html_to_text(html: str) -> str:
    """Convert HTML to plain text, falling back to a regex strip if bs4 is absent."""
    if not html:
        return ""
    if BeautifulSoup is not None:
        try:
            soup = BeautifulSoup(html, "html.parser")
            for tag in soup(["script", "style", "noscript"]):
                tag.decompose()
            return soup.get_text(separator=" ", strip=True)
        except Exception:
            pass
    # Fallback: naive tag strip
    return re.sub(r"<[^>]+>", " ", html)


# ---------------------------------------------------------------------------
# GitHub
# ---------------------------------------------------------------------------

def _github_username(url: str) -> Optional[str]:
    parsed = urlparse(url)
    if (parsed.hostname or "").lower() not in ("github.com", "www.github.com"):
        return None
    parts = [p for p in parsed.path.split("/") if p]
    if not parts:
        return None
    user = parts[0]
    # Reserved/non-user paths
    if user.lower() in {"orgs", "topics", "marketplace", "explore", "settings",
                        "notifications", "pulls", "issues", "search"}:
        return None
    return user


def analyze_github(url: str) -> Dict:
    """Analyze a GitHub user URL via the public REST API.

    Returns a dict containing extracted languages, total stars,
    a top-repos list and a numeric boost score.
    """
    result: Dict = {
        "url": url,
        "username": None,
        "bio": None,
        "repo_count": 0,
        "languages": [],
        "top_repos": [],
        "total_stars": 0,
        "extracted_skills": [],
        "boost_score": 0.0,
        "summary": "",
        "error": None,
    }

    username = _github_username(url)
    if not username:
        result["error"] = "Not a GitHub user URL"
        return result
    result["username"] = username

    # User profile (for bio)
    user_resp = _safe_get(
        f"https://api.github.com/users/{username}",
        headers=GITHUB_API_HEADERS,
    )
    if user_resp is not None and user_resp.status_code == 200:
        try:
            user_data = user_resp.json()
            result["bio"] = (user_data.get("bio") or "").strip() or None
        except ValueError:
            pass

    # Repos
    repos_resp = _safe_get(
        f"https://api.github.com/users/{username}/repos?per_page=100&sort=updated",
        headers=GITHUB_API_HEADERS,
    )
    if repos_resp is None or repos_resp.status_code != 200:
        result["error"] = (
            f"GitHub API returned {repos_resp.status_code}"
            if repos_resp is not None else "GitHub API unreachable"
        )
        return result

    try:
        repos = repos_resp.json()
    except ValueError:
        result["error"] = "Invalid JSON from GitHub API"
        return result

    if not isinstance(repos, list):
        result["error"] = "Unexpected GitHub API response"
        return result

    languages: Dict[str, int] = {}
    total_stars = 0
    enriched: List[Dict] = []

    for repo in repos:
        if not isinstance(repo, dict) or repo.get("fork"):
            continue
        lang = repo.get("language")
        if lang:
            languages[lang] = languages.get(lang, 0) + 1
        stars = int(repo.get("stargazers_count") or 0)
        total_stars += stars
        enriched.append({
            "name": repo.get("name"),
            "full_name": repo.get("full_name"),
            "description": (repo.get("description") or "").strip(),
            "language": lang,
            "stars": stars,
            "url": repo.get("html_url"),
        })

    enriched.sort(key=lambda r: r.get("stars", 0), reverse=True)
    top_repos = enriched[:5]

    result["repo_count"] = len(enriched)
    result["languages"] = sorted(languages.keys(), key=lambda k: languages[k], reverse=True)
    result["top_repos"] = top_repos
    result["total_stars"] = total_stars

    # Skill extraction from bio + repo descriptions + languages
    sg = _skill_graph
    blob_parts: List[str] = []
    if result["bio"]:
        blob_parts.append(result["bio"])
    blob_parts.extend(result["languages"])
    for repo in enriched:
        if repo.get("description"):
            blob_parts.append(repo["description"])
        if repo.get("name"):
            blob_parts.append(repo["name"].replace("-", " ").replace("_", " "))
    extracted = sg.extract_skills(" ".join(blob_parts))
    result["extracted_skills"] = extracted

    # Scoring: +2 per repo (max 20) + +5 per matched skill
    repo_boost = min(result["repo_count"] * 2.0, 20.0)
    skill_boost = len(extracted) * 5.0
    star_boost = min(total_stars * 0.5, 10.0)  # small extra for popularity
    result["boost_score"] = round(repo_boost + skill_boost + star_boost, 2)

    skills_preview = ", ".join(extracted[:5]) if extracted else "no recognized skills"
    result["summary"] = (
        f"GitHub @{username}: {result['repo_count']} repos, "
        f"{total_stars} stars, top languages: "
        f"{', '.join(result['languages'][:3]) or 'n/a'}; skills: {skills_preview}"
    )
    return result


# ---------------------------------------------------------------------------
# LinkedIn
# ---------------------------------------------------------------------------

# Common job-title keywords used to surface roles from a LinkedIn page text.
_JOB_TITLE_KEYWORDS = [
    "engineer", "developer", "scientist", "analyst", "designer",
    "architect", "manager", "consultant", "intern", "lead", "researcher",
    "founder", "cto", "ceo", "specialist", "administrator", "devops",
]


def _extract_job_titles(text: str) -> List[str]:
    """Best-effort extraction of plausible job titles from free text."""
    titles: List[str] = []
    seen: set = set()
    for line in re.split(r"[\n\.\|•·\-–—]", text):
        line = line.strip()
        if not (5 <= len(line) <= 80):
            continue
        low = line.lower()
        if any(kw in low for kw in _JOB_TITLE_KEYWORDS):
            if low in seen:
                continue
            seen.add(low)
            titles.append(line)
        if len(titles) >= 8:
            break
    return titles


def analyze_linkedin(url: str) -> Dict:
    """Best-effort LinkedIn scrape.

    LinkedIn aggressively blocks unauthenticated scraping; we therefore
    treat any non-200 response as a soft failure and still return a small
    "we trust the link exists" boost.
    """
    result: Dict = {
        "url": url,
        "job_titles": [],
        "extracted_skills": [],
        "text_length": 0,
        "boost_score": 0.0,
        "summary": "",
        "error": None,
    }

    resp = _safe_get(url)
    if resp is None:
        result["error"] = "LinkedIn unreachable"
        result["boost_score"] = 5.0  # baseline for having a LinkedIn link
        result["summary"] = "LinkedIn link present (page not fetched)"
        return result

    if resp.status_code != 200:
        result["error"] = f"LinkedIn returned HTTP {resp.status_code}"
        result["boost_score"] = 5.0
        result["summary"] = (
            f"LinkedIn link present (HTTP {resp.status_code}, content gated)"
        )
        return result

    text = _html_to_text(resp.text)
    result["text_length"] = len(text)

    titles = _extract_job_titles(text)
    result["job_titles"] = titles

    sg = _skill_graph
    skills = sg.extract_skills(text)
    result["extracted_skills"] = skills

    # Scoring: 5 baseline, +1 per job title (cap 5), +1 per skill (cap 5)
    base = 5.0
    title_bonus = min(len(titles), 5) * 1.0
    skill_bonus = min(len(skills), 5) * 1.0
    boost = base + title_bonus + skill_bonus
    boost = max(5.0, min(boost, 15.0))
    result["boost_score"] = round(boost, 2)

    result["summary"] = (
        f"LinkedIn page parsed: {len(titles)} role(s), "
        f"{len(skills)} known skill(s) detected"
    )
    return result


# ---------------------------------------------------------------------------
# Portfolios / generic sites
# ---------------------------------------------------------------------------

def analyze_portfolio(url: str) -> Dict:
    """Fetch a personal site / portfolio and look for known skills."""
    result: Dict = {
        "url": url,
        "title": None,
        "extracted_skills": [],
        "text_length": 0,
        "boost_score": 0.0,
        "summary": "",
        "error": None,
    }

    resp = _safe_get(url)
    if resp is None:
        result["error"] = "Portfolio unreachable"
        result["boost_score"] = 3.0  # baseline credit for listing it
        result["summary"] = "Portfolio link present (page not fetched)"
        return result

    if resp.status_code != 200:
        result["error"] = f"Portfolio returned HTTP {resp.status_code}"
        result["boost_score"] = 3.0
        result["summary"] = f"Portfolio link present (HTTP {resp.status_code})"
        return result

    html = resp.text or ""
    text = _html_to_text(html)
    result["text_length"] = len(text)

    if BeautifulSoup is not None:
        try:
            soup = BeautifulSoup(html, "html.parser")
            if soup.title and soup.title.string:
                result["title"] = soup.title.string.strip()[:200]
        except Exception:
            pass

    sg = _skill_graph
    skills = sg.extract_skills(text)
    result["extracted_skills"] = skills

    # 3 baseline + 1 per skill, capped at 10
    boost = 3.0 + len(skills) * 1.0
    boost = max(3.0, min(boost, 10.0))
    result["boost_score"] = round(boost, 2)

    title_part = f" titled '{result['title']}'" if result["title"] else ""
    result["summary"] = (
        f"Portfolio{title_part}: {len(skills)} known skill(s) detected"
    )
    return result


def _analyze_other(url: str) -> Dict:
    """Lightweight handler for unrecognized URLs."""
    return {
        "url": url,
        "extracted_skills": [],
        "boost_score": 0.0,
        "summary": "Unrecognized URL type (no boost applied)",
        "error": None,
    }


# ---------------------------------------------------------------------------
# Top-level pipeline
# ---------------------------------------------------------------------------

def analyze_urls(text: str, job_skills: Optional[List[str]] = None) -> Dict:
    """End-to-end URL analysis.

    Parameters
    ----------
    text:
        The raw CV text. URLs will be discovered automatically.
    job_skills:
        Optional list of skills required by the job. When provided, the
        per-URL boost is amplified slightly when the URL evidences one of
        those skills (helps prioritise relevant evidence).

    Returns
    -------
    dict
        ``{"urls_found": [...], "url_signals": [...], "total_boost": float,
        "details": [...]}``.
    """
    urls = extract_urls(text or "")
    details: List[Dict] = []
    signals: List[str] = []
    total_boost = 0.0

    job_skill_set = {
        s.strip().lower() for s in (job_skills or []) if s and isinstance(s, str)
    }

    for url in urls:
        kind = classify_url(url)
        try:
            if kind == "github":
                analysis = analyze_github(url)
            elif kind == "linkedin":
                analysis = analyze_linkedin(url)
            elif kind == "portfolio":
                analysis = analyze_portfolio(url)
            else:
                analysis = _analyze_other(url)
        except Exception as exc:  # pragma: no cover - belt-and-braces
            analysis = {
                "url": url,
                "extracted_skills": [],
                "boost_score": 0.0,
                "summary": f"Analyzer crashed: {exc!r}",
                "error": str(exc),
            }

        extracted = analysis.get("extracted_skills") or []

        # Relevance amplifier: if the URL surfaces a job-required skill,
        # add up to +5 more (capped) to its boost.
        if job_skill_set and extracted:
            relevant = [s for s in extracted if s.lower() in job_skill_set]
            if relevant:
                bonus = min(len(relevant), 5) * 1.0
                analysis["boost_score"] = round(
                    float(analysis.get("boost_score") or 0.0) + bonus, 2
                )
                analysis["summary"] = (
                    f"{analysis.get('summary', '')} | +{bonus} for "
                    f"job-relevant skills: {', '.join(relevant[:5])}"
                ).strip(" |")

        detail = {
            "url": url,
            "type": kind,
            "extracted_skills": extracted,
            "boost_score": float(analysis.get("boost_score") or 0.0),
            "summary": analysis.get("summary") or "",
        }
        # Pass through any extra fields without losing them
        for key, value in analysis.items():
            if key not in detail:
                detail[key] = value

        details.append(detail)
        total_boost += detail["boost_score"]

        signals.append(
            f"{kind}:{url} (+{detail['boost_score']})"
        )

    return {
        "urls_found": urls,
        "url_signals": signals,
        "total_boost": round(total_boost, 2),
        "details": details,
    }


__all__ = [
    "extract_urls",
    "classify_url",
    "analyze_github",
    "analyze_linkedin",
    "analyze_portfolio",
    "analyze_urls",
]


if __name__ == "__main__":  # pragma: no cover - manual smoke test
    sample = (
        "Find my work at https://github.com/torvalds and "
        "linkedin.com/in/someone . Portfolio: example.dev"
    )
    from pprint import pprint
    pprint(analyze_urls(sample, job_skills=["Python", "C"]))
