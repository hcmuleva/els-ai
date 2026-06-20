"""Parser agent.

Turns a retrieved source (PDF bytes or sample text) into clean text and a
best-guess topic, which conditions the generator.
"""
from __future__ import annotations

import io
from dataclasses import dataclass
from typing import Dict, List, Optional

from app.agents.retriever import RetrievedSource
from app.data.authored_bank import BANK, default_topic
from app.schemas import SourceInfo

# Keyword hints used to detect which bank topic a paper is closest to.
_TOPIC_KEYWORDS: Dict[str, List[str]] = {
    "current_electricity": ["resistance", "ohm", "current", "circuit", "kirchhoff", "resistor", "emf"],
    "electrostatics": ["charge", "coulomb", "electric field", "gauss", "capacitor", "potential"],
    "electricity": ["resistance", "ohm", "current", "circuit", "watt", "ampere"],
    "light": ["mirror", "lens", "refraction", "reflection", "focal", "dioptre"],
    "calculus": ["derivative", "integral", "differentiat", "limit", "maxima", "minima"],
    "matrices_determinants": ["matrix", "matrices", "determinant", "adjoint", "inverse"],
    "electrochemistry": ["electrode", "galvanic", "nernst", "cell potential", "electrolysis"],
    "chemical_kinetics": ["rate constant", "order of reaction", "half-life", "activation energy"],
    "genetics": ["mendel", "allele", "dominant", "recessive", "dihybrid", "inheritance"],
    "human_physiology": ["nephron", "blood", "heart", "kidney", "circulation"],
    "acids_bases_salts": ["acid", "base", "ph", "litmus", "neutralis"],
    "chemical_reactions": ["combination reaction", "displacement", "balanced equation", "oxidation"],
    "life_processes": ["photosynthesis", "respiration", "chlorophyll", "nutrition"],
    "quadratic_equations": ["quadratic", "discriminant", "roots", "factoris"],
    "trigonometry": ["sin", "cos", "tan", "trigonometr", "identity"],
}


@dataclass
class ParsedSource:
    text: str
    detected_topic: Optional[str]
    info: SourceInfo


def _extract_pdf_text(pdf_bytes: bytes, max_pages: int = 8) -> str:
    try:
        from pypdf import PdfReader
    except Exception:
        return ""
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        chunks: List[str] = []
        for page in reader.pages[:max_pages]:
            chunks.append(page.extract_text() or "")
        return "\n".join(chunks)
    except Exception:
        return ""


def _detect_topic(text: str, class_level: str, subject: str) -> Optional[str]:
    available = list(BANK.get((class_level, subject), {}).keys())
    if not available:
        return None
    lowered = text.lower()
    best, best_score = None, 0
    for topic in available:
        keywords = _TOPIC_KEYWORDS.get(topic, [topic.replace("_", " ")])
        score = sum(lowered.count(k) for k in keywords)
        if score > best_score:
            best, best_score = topic, score
    return best or default_topic(class_level, subject)


def parse(source: RetrievedSource, class_level: str, subject: str) -> ParsedSource:
    if source.pdf_bytes:
        text = _extract_pdf_text(source.pdf_bytes)
    else:
        text = source.sample_text or ""

    detected = _detect_topic(text, class_level, subject) if text else default_topic(class_level, subject)

    info = SourceInfo(
        mode=source.mode,
        dataset=source.dataset,
        pdf_path=source.pdf_path,
        pdf_url=source.pdf_url,
        detected_topic=detected,
        text_chars=len(text),
        note=source.note,
    )
    return ParsedSource(text=text, detected_topic=detected, info=info)
