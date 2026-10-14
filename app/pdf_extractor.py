"""
PDF text extraction utilities.

Primary backend is `pdfplumber`. If pdfplumber fails (or isn't available
for a particular file), we fall back to a basic byte-level parser that
recovers any embedded plain text. Functions never raise on a bad PDF —
they always return a string and log a warning.
"""

from __future__ import annotations

import io
import logging
import re
import unicodedata
from pathlib import Path
from typing import Dict, Union

logger = logging.getLogger(__name__)

try:
    import pdfplumber  # type: ignore
    _HAS_PDFPLUMBER = True
except Exception as _e:  # pragma: no cover - import-time guard
    pdfplumber = None  # type: ignore
    _HAS_PDFPLUMBER = False
    logger.warning("pdfplumber not available: %s", _e)


# ---------------------------------------------------------------------------
# Section header keywords
# ---------------------------------------------------------------------------
SECTION_KEYWORDS: Dict[str, list] = {
    "summary": [
        "summary",
        "professional summary",
        "profile",
        "about me",
        "objective",
        "career objective",
    ],
    "experience": [
        "experience",
        "work experience",
        "professional experience",
        "work history",
        "employment",
        "employment history",
        "career history",
    ],
    "education": [
        "education",
        "academic background",
        "academic qualifications",
        "qualifications",
        "studies",
    ],
    "skills": [
        "skills",
        "technical skills",
        "core competencies",
        "competencies",
        "technologies",
        "tech stack",
        "expertise",
    ],
    "projects": [
        "projects",
        "personal projects",
        "side projects",
        "portfolio",
        "selected projects",
    ],
}

# Other common headers we should treat as section breaks even though we
# don't return them. Helps stop a recognised section eating downstream text.
OTHER_HEADERS: list = [
    "certifications",
    "certificates",
    "publications",
    "awards",
    "languages",
    "interests",
    "hobbies",
    "references",
    "volunteer",
    "volunteering",
    "achievements",
    "contact",
]


# ---------------------------------------------------------------------------
# Public functions
# ---------------------------------------------------------------------------
def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    """Extract all text from PDF bytes. Returns "" on failure."""
    if not pdf_bytes:
        logger.warning("extract_text_from_pdf_bytes: empty input")
        return ""

    if _HAS_PDFPLUMBER:
        try:
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                pages_text = []
                for page in pdf.pages:
                    try:
                        page_text = page.extract_text() or ""
                    except Exception as page_err:  # pragma: no cover
                        logger.warning(
                            "Failed to extract page text: %s", page_err
                        )
                        page_text = ""
                    pages_text.append(page_text)
                text = "\n".join(pages_text)
                if text.strip():
                    return clean_text(text)
                logger.warning(
                    "pdfplumber returned empty text, falling back to raw parser"
                )
        except Exception as e:
            logger.warning("pdfplumber failed (%s); using fallback parser", e)

    # Fallback: raw byte-level recovery
    fallback = _fallback_text_from_bytes(pdf_bytes)
    if not fallback:
        logger.warning("Fallback parser produced no text")
    return clean_text(fallback)


def extract_text_from_pdf_path(pdf_path: str) -> str:
    """Extract text from a PDF file path. Returns "" on failure."""
    try:
        path = Path(pdf_path)
        if not path.exists():
            logger.warning("PDF not found: %s", pdf_path)
            return ""
        with open(path, "rb") as f:
            data = f.read()
        return extract_text_from_pdf_bytes(data)
    except Exception as e:
        logger.warning("extract_text_from_pdf_path failed for %s: %s", pdf_path, e)
        return ""


def clean_text(text: str) -> str:
    """Normalise unicode, fix common encoding issues, collapse whitespace."""
    if not text:
        return ""

    try:
        # Normalise unicode (compose accents, fold compatibility forms)
        text = unicodedata.normalize("NFKC", text)
    except Exception:
        pass

    # Common mojibake / ligature fixes
    replacements = {
        " ": " ",     # non-breaking space
        "–": "-",     # en dash
        "—": "-",     # em dash
        "‘": "'",     # left single quote
        "’": "'",     # right single quote
        "“": '"',     # left double quote
        "”": '"',     # right double quote
        "•": "-",     # bullet
        "·": "-",     # middle dot
        "ﬀ": "ff",    # ligatures
        "ﬁ": "fi",
        "ﬂ": "fl",
        "ﬃ": "ffi",
        "ﬄ": "ffl",
        " ": "\n",
        " ": "\n\n",
        "\r\n": "\n",
        "\r": "\n",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)

    # Drop control characters except tab/newline
    text = "".join(
        ch for ch in text
        if ch in ("\n", "\t") or unicodedata.category(ch)[0] != "C"
    )

    # Collapse runs of spaces/tabs (preserve newlines)
    text = re.sub(r"[ \t]+", " ", text)
    # Trim spaces around newlines
    text = re.sub(r" *\n *", "\n", text)
    # Collapse 3+ newlines into a paragraph break
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


# ---------------------------------------------------------------------------
# PDFExtractor class
# ---------------------------------------------------------------------------
class PDFExtractor:
    """Smart dispatcher around the extract_* functions."""

    def __init__(self) -> None:
        self.logger = logger

    # -- main entry point ------------------------------------------------
    def extract(self, source: Union[bytes, str, Path]) -> str:
        """Dispatch to the right backend based on the input type."""
        try:
            if isinstance(source, (bytes, bytearray)):
                return extract_text_from_pdf_bytes(bytes(source))
            if isinstance(source, Path):
                return extract_text_from_pdf_path(str(source))
            if isinstance(source, str):
                # If it looks like a file path that exists, treat as path.
                # Otherwise, fall back to assuming raw text.
                p = Path(source)
                if p.exists() and p.is_file():
                    return extract_text_from_pdf_path(source)
                # Heuristic: if it starts with "%PDF" it's PDF data as str
                if source.startswith("%PDF"):
                    return extract_text_from_pdf_bytes(
                        source.encode("latin-1", errors="ignore")
                    )
                self.logger.warning(
                    "PDFExtractor.extract received string that is neither "
                    "a path nor PDF data; returning cleaned text as-is."
                )
                return clean_text(source)
            self.logger.warning(
                "Unsupported source type for PDFExtractor.extract: %s",
                type(source).__name__,
            )
            return ""
        except Exception as e:
            self.logger.warning("PDFExtractor.extract failed: %s", e)
            return ""

    # -- section detection ----------------------------------------------
    def extract_sections(self, text: str) -> Dict[str, str]:
        """Split text into common CV sections via keyword detection.

        Returns a dict with keys: summary, experience, education, skills,
        projects. Missing sections map to "".
        """
        result: Dict[str, str] = {
            "summary": "",
            "experience": "",
            "education": "",
            "skills": "",
            "projects": "",
        }

        if not text:
            return result

        lines = text.splitlines()

        # Build canonical->keywords lookup (lowered)
        canonical_keywords: Dict[str, list] = {
            name: [kw.lower() for kw in kws]
            for name, kws in SECTION_KEYWORDS.items()
        }
        other_lower = [kw.lower() for kw in OTHER_HEADERS]

        # Identify section header positions
        # header_hits: list of tuples (line_index, canonical_name_or_None)
        header_hits = []
        for idx, raw_line in enumerate(lines):
            label = self._classify_header(
                raw_line, canonical_keywords, other_lower
            )
            if label is not None:
                header_hits.append((idx, label))

        if not header_hits:
            # No detectable headers — try to put everything into summary
            result["summary"] = text.strip()
            return result

        # Walk hits and slice out the body of each known section
        for i, (start_idx, label) in enumerate(header_hits):
            end_idx = (
                header_hits[i + 1][0] if i + 1 < len(header_hits) else len(lines)
            )
            body_lines = lines[start_idx + 1 : end_idx]
            body = "\n".join(body_lines).strip()
            if label in result and body:
                # If the section already has content (duplicate header), append
                if result[label]:
                    result[label] = result[label] + "\n\n" + body
                else:
                    result[label] = body

        # Anything before the first known header could be a summary
        first_known_idx = next(
            (idx for idx, lbl in header_hits if lbl in result),
            None,
        )
        if first_known_idx is not None and first_known_idx > 0 and not result["summary"]:
            preamble = "\n".join(lines[:first_known_idx]).strip()
            # Skip likely contact-info-only preamble (very short)
            if preamble and len(preamble.split()) > 10:
                result["summary"] = preamble

        return result

    # -- helpers --------------------------------------------------------
    @staticmethod
    def _classify_header(
        line: str,
        canonical_keywords: Dict[str, list],
        other_lower: list,
    ) -> Union[str, None]:
        """Return the canonical section name if `line` is a header, else None.

        For "other" headers we return a sentinel string that isn't in the
        result dict — that way the slicer still treats it as a boundary.
        """
        if not line:
            return None

        stripped = line.strip()
        if not stripped:
            return None

        # Reject very long lines (likely paragraphs, not headers)
        if len(stripped) > 60:
            return None

        # Strip trailing punctuation/colons
        cleaned = re.sub(r"[\s:\-_=*]+$", "", stripped)
        cleaned_lower = cleaned.lower().strip()

        if not cleaned_lower:
            return None

        # Heuristic: headers are usually mostly letters/spaces, possibly
        # all-caps or title-case.
        letters = re.findall(r"[A-Za-z]", cleaned)
        if not letters:
            return None
        non_letter_chars = [c for c in cleaned if not c.isspace() and not c.isalpha()]
        if len(non_letter_chars) > 4:
            # too many digits/symbols to be a header
            return None

        # Match canonical sections
        for canonical, keywords in canonical_keywords.items():
            for kw in keywords:
                if cleaned_lower == kw:
                    return canonical
            # Allow header to start with the keyword followed by a separator
            for kw in keywords:
                if cleaned_lower.startswith(kw):
                    rest = cleaned_lower[len(kw):].strip(" :-_=")
                    if rest == "" or len(rest) <= 10:
                        return canonical

        # Match "other" headers (boundary only)
        for kw in other_lower:
            if cleaned_lower == kw or cleaned_lower.startswith(kw + " "):
                return f"__other:{kw}"

        return None


# ---------------------------------------------------------------------------
# Fallback parser
# ---------------------------------------------------------------------------
_PDF_TEXT_OP_RE = re.compile(rb"\((.*?)\)\s*Tj", re.DOTALL)
_PDF_TEXT_ARRAY_RE = re.compile(rb"\[(.*?)\]\s*TJ", re.DOTALL)
_PDF_STRING_LITERAL_RE = re.compile(rb"\((.*?)\)", re.DOTALL)


def _fallback_text_from_bytes(pdf_bytes: bytes) -> str:
    """Best-effort recovery of text using regex over raw PDF bytes.

    This will never match every PDF, but it can extract simple unencrypted
    `Tj` / `TJ` literal text strings — enough to keep downstream pipelines
    running when pdfplumber chokes on a malformed file.
    """
    if not pdf_bytes:
        return ""

    pieces = []

    try:
        for match in _PDF_TEXT_OP_RE.findall(pdf_bytes):
            pieces.append(_decode_pdf_string(match))
    except Exception as e:
        logger.warning("Fallback Tj scan failed: %s", e)

    try:
        for arr in _PDF_TEXT_ARRAY_RE.findall(pdf_bytes):
            for s in _PDF_STRING_LITERAL_RE.findall(arr):
                pieces.append(_decode_pdf_string(s))
    except Exception as e:
        logger.warning("Fallback TJ scan failed: %s", e)

    if not pieces:
        # Last resort: pull printable ASCII runs of length >= 4
        try:
            ascii_runs = re.findall(rb"[\x20-\x7e]{4,}", pdf_bytes)
            pieces = [r.decode("latin-1", errors="ignore") for r in ascii_runs]
        except Exception as e:
            logger.warning("ASCII-run fallback failed: %s", e)

    return "\n".join(p for p in pieces if p)


def _decode_pdf_string(raw: bytes) -> str:
    """Decode a PDF literal string handling common escape sequences."""
    if not raw:
        return ""
    # Resolve PDF backslash escapes
    out = bytearray()
    i = 0
    while i < len(raw):
        b = raw[i]
        if b == 0x5C and i + 1 < len(raw):  # backslash
            nxt = raw[i + 1]
            mapping = {
                ord("n"): ord("\n"),
                ord("r"): ord("\r"),
                ord("t"): ord("\t"),
                ord("b"): ord("\b"),
                ord("f"): ord("\f"),
                ord("("): ord("("),
                ord(")"): ord(")"),
                ord("\\"): ord("\\"),
            }
            if nxt in mapping:
                out.append(mapping[nxt])
                i += 2
                continue
            # Octal escape \ddd (1-3 digits)
            if 0x30 <= nxt <= 0x37:
                j = i + 1
                digits = bytearray()
                while j < len(raw) and len(digits) < 3 and 0x30 <= raw[j] <= 0x37:
                    digits.append(raw[j])
                    j += 1
                try:
                    out.append(int(digits.decode("ascii"), 8) & 0xFF)
                except Exception:
                    pass
                i = j
                continue
            # Unknown escape -> drop backslash
            out.append(nxt)
            i += 2
            continue
        out.append(b)
        i += 1

    # Try utf-8 first, then latin-1
    try:
        return out.decode("utf-8")
    except UnicodeDecodeError:
        return out.decode("latin-1", errors="ignore")


__all__ = [
    "PDFExtractor",
    "extract_text_from_pdf_bytes",
    "extract_text_from_pdf_path",
    "clean_text",
]
