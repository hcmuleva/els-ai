"""Deterministic, offline extraction using linguistic heuristics.

No network, no API key, fully reproducible. This is the default backend and the
baseline the LLM backends are expected to improve upon.
"""
from __future__ import annotations

import re
from collections import Counter

from ..utils import dedupe_preserve, normalize_ws, sentences, slugify, words
from .base import KnowledgeExtractor

# Subject keyword lexicon -> (subject, domain)
_SUBJECT_LEXICON: dict[str, tuple[str, str]] = {
    "physics": ("Physics", "STEM"),
    "force": ("Physics", "STEM"),
    "velocity": ("Physics", "STEM"),
    "chemistry": ("Chemistry", "STEM"),
    "molecule": ("Chemistry", "STEM"),
    "reaction": ("Chemistry", "STEM"),
    "biology": ("Biology", "STEM"),
    "cell": ("Biology", "STEM"),
    "organism": ("Biology", "STEM"),
    "algebra": ("Mathematics", "STEM"),
    "theorem": ("Mathematics", "STEM"),
    "equation": ("Mathematics", "STEM"),
    "calculus": ("Mathematics", "STEM"),
    "algorithm": ("Computer Science", "STEM"),
    "software": ("Computer Science", "STEM"),
    "database": ("Computer Science", "STEM"),
    "network": ("Computer Science", "STEM"),
    "economics": ("Economics", "Social Sciences"),
    "market": ("Economics", "Social Sciences"),
    "demand": ("Economics", "Social Sciences"),
    "management": ("Business Management", "Business"),
    "strategy": ("Business Management", "Business"),
    "marketing": ("Marketing", "Business"),
    "accounting": ("Accounting", "Business"),
    "history": ("History", "Humanities"),
    "civilization": ("History", "Humanities"),
    "philosophy": ("Philosophy", "Humanities"),
    "psychology": ("Psychology", "Social Sciences"),
    "geography": ("Geography", "Social Sciences"),
}

_DEFINITION_MARKERS = [
    r"\bis defined as\b",
    r"\bis a\b",
    r"\bare a\b",
    r"\brefers to\b",
    r"\bis the\b",
    r"\bmeans\b",
    r"\bdescribes\b",
    r"\bis known as\b",
]
_DEF_RE = re.compile("|".join(_DEFINITION_MARKERS), re.IGNORECASE)
_EXAMPLE_RE = re.compile(r"\b(for example|for instance|e\.g\.|such as|consider the case)\b", re.IGNORECASE)
_FORMULA_RE = re.compile(r"[A-Za-z0-9\)\]]\s*=\s*[A-Za-z0-9\(\-]|[∑∫√±×÷≈≤≥→∆πθ]")
_PROCESS_RE = re.compile(r"\b(step\s*\d+|first,|second,|third,|finally,|the process of|procedure|methodology|framework)\b", re.IGNORECASE)
_LAW_RE = re.compile(r"\b(law of|principle of|theorem|theory of|rule of|axiom|postulate)\b", re.IGNORECASE)
_OBJECTIVE_RE = re.compile(r"\b(learning objective|by the end of this|you will be able to|students will)\b", re.IGNORECASE)
_CASE_RE = re.compile(r"\b(case study|in practice|real[- ]world|application:)\b", re.IGNORECASE)
_QUESTION_START_RE = re.compile(
    r"^\s*(?:\d+\s*[.)]|what\b|which\b|find\b|solve\b|prove\b|calculate\b|determine\b)",
    re.IGNORECASE,
)

_LOW_VALUE_PATTERNS = {
    "copyright": re.compile(r"\b(copyright|all rights reserved|©|isbn|first edition|printed in)\b", re.IGNORECASE),
    "references": re.compile(r"\b(bibliography|references|works cited|further reading)\b", re.IGNORECASE),
    "acknowledgements": re.compile(r"\b(acknowledg(e)?ments?|we (would like to )?thank|dedicated to)\b", re.IGNORECASE),
    "publisher": re.compile(r"\b(published by|publisher|press ltd|imprint|distribution)\b", re.IGNORECASE),
    "marketing": re.compile(r"\b(bestseller|order now|available at|visit our website|about the author)\b", re.IGNORECASE),
}

_STOPWORDS = {
    "the", "and", "for", "that", "this", "with", "from", "which", "these", "those",
    "have", "has", "was", "were", "are", "will", "can", "may", "such", "when", "what",
    "into", "also", "been", "their", "there", "here", "very", "more", "most", "some",
}


class HeuristicExtractor(KnowledgeExtractor):
    name = "heuristic"

    # ------------------------------------------------------------------ phase 1
    def classify_book(self, title: str, sample_text: str) -> dict:
        blob = f"{title} {sample_text}".lower()
        counts: Counter[tuple[str, str]] = Counter()
        for kw, (subject, domain) in _SUBJECT_LEXICON.items():
            hits = blob.count(kw)
            if hits:
                counts[(subject, domain)] += hits
        if counts:
            (subject, domain), _ = counts.most_common(1)[0]
        else:
            subject, domain = "General Studies", "General"

        curriculum = self._guess_curriculum(blob)
        return {"subject": subject, "curriculum": curriculum, "domain": domain}

    @staticmethod
    def _guess_curriculum(blob: str) -> str:
        if re.search(r"\b(grade|class \d|k-12|high school|elementary)\b", blob):
            return "K-12"
        if re.search(r"\b(undergraduate|semester|university|bachelor)\b", blob):
            return "Undergraduate"
        if re.search(r"\b(certification|professional|practitioner|industry)\b", blob):
            return "Professional"
        return "Higher Education"

    # ------------------------------------------------------------------ phase 2
    def page_value(self, text: str) -> dict:
        categories: list[str] = []
        noise: list[str] = []

        for reason, pat in _LOW_VALUE_PATTERNS.items():
            if pat.search(text):
                noise.append(reason)

        if _DEF_RE.search(text):
            categories.append("definition")
        if _FORMULA_RE.search(text):
            categories.append("formula")
        if _LAW_RE.search(text):
            categories.append("law_or_principle")
        if _PROCESS_RE.search(text):
            categories.append("process_or_framework")
        if _EXAMPLE_RE.search(text):
            categories.append("example")
        if _OBJECTIVE_RE.search(text):
            categories.append("learning_objective")
        if _CASE_RE.search(text):
            categories.append("case_study")

        alpha = sum(c.isalpha() for c in text)
        # Decide class: strong noise + little substance => LOW.
        if noise and (not categories or alpha < 400):
            value_class = "LOW"
        elif categories:
            value_class = "HIGH"
        elif alpha >= 250:
            value_class = "MEDIUM"
        else:
            value_class = "LOW"
            if not noise:
                noise.append("sparse_content")

        return {"value_class": value_class, "categories": categories, "noise_reasons": noise}

    # ------------------------------------------------------------------ phase 4
    def distill_units(
        self, book_id: str, chapter_index: int, chapter_title: str, text: str
    ) -> list[dict]:
        sents = sentences(text)
        units: list[dict] = []
        practice_batch = " practice pages " in chapter_title.lower()
        for sent in ([] if practice_batch else sents):
            if (
                not _DEF_RE.search(sent)
                or len(sent) < 30
                or sent.rstrip().endswith("?")
                or _QUESTION_START_RE.match(sent)
            ):
                continue
            concept = self._concept_from_definition(sent)
            concept = self._strip_topic_prefix(concept, chapter_title)
            if not concept:
                continue
            units.append(
                {
                    "topic": normalize_ws(chapter_title) or "General",
                    "subtopic": concept,
                    "concept": concept,
                    "definition": self._clean_definition(sent, concept, chapter_title),
                    "examples": [],
                    "frameworks": [],
                    "processes": [],
                    "formulae": [],
                    "case_studies": [],
                    "facts": [],
                }
            )

        # Fallback: if no definition sentences, treat the densest sentences as facts.
        if not units and sents:
            concept = normalize_ws(chapter_title) or (
                self._top_keyword(text) or slugify(chapter_title)
            ).title()
            definition = normalize_ws(" ".join(sents[:12]))[:1800]
            units.append(
                {
                    "topic": normalize_ws(chapter_title) or "General",
                    "subtopic": concept,
                    "concept": concept,
                    "definition": definition,
                    "examples": [],
                    "frameworks": [],
                    "processes": [],
                    "formulae": [],
                    "case_studies": [],
                    "facts": [],
                }
            )

        # Enrich each unit with nearby examples/formulae/facts from the chapter.
        for unit in units:
            self._enrich_unit(unit, sents)
        return units

    def _enrich_unit(self, unit: dict, sents: list[str]) -> None:
        concept_l = unit["concept"].lower()
        for sent in sents:
            if sent == unit["definition"]:
                continue
            related = concept_l in sent.lower()
            if _EXAMPLE_RE.search(sent) and (related or len(unit["examples"]) == 0):
                unit["examples"].append(normalize_ws(sent))
            elif _FORMULA_RE.search(sent) and related:
                unit["formulae"].append(normalize_ws(sent))
            elif _PROCESS_RE.search(sent) and related:
                unit["processes"].append(normalize_ws(sent))
            elif _CASE_RE.search(sent) and related:
                unit["case_studies"].append(normalize_ws(sent))
            elif related and len(unit["facts"]) < 4:
                unit["facts"].append(normalize_ws(sent))
        for key in ("examples", "formulae", "processes", "case_studies", "facts"):
            unit[key] = dedupe_preserve(unit[key])[:5]

    @staticmethod
    def _concept_from_definition(sentence: str) -> str:
        m = _DEF_RE.search(sentence)
        if not m:
            return ""
        head = sentence[: m.start()].strip(" ,;:-")
        # Drop any leading chapter/section/unit heading that ran into the sentence.
        head = re.sub(
            r"^(chapter|unit|section|module|lesson)\s+[0-9IVXLC]+\s*[:.\-]?\s*",
            "",
            head,
            flags=re.IGNORECASE,
        )
        # If a heading colon remains (e.g. "Kinematics: Displacement"), keep the tail.
        if ":" in head:
            head = head.rsplit(":", 1)[-1].strip()
        toks = head.split()
        if not toks or len(toks) > 8:
            toks = toks[-4:]
        candidate = " ".join(toks).strip(" ,;:-\"'()")
        candidate = re.sub(
            r"^(the|a|an|in|this|these|those|any|each|every)\s+",
            "",
            candidate,
            flags=re.IGNORECASE,
        )
        if len(candidate) < 3 or len(candidate) > 60:
            return ""
        return candidate[:1].upper() + candidate[1:]

    @staticmethod
    def _clean_definition(sentence: str, concept: str, chapter_title: str) -> str:
        """Drop a leading chapter heading that merged into the definition sentence."""
        text = normalize_ws(sentence)
        text = re.sub(
            r"^(chapter|unit|section|module|lesson)\s+[0-9IVXLC]+\s*[:.\-]?\s*",
            "",
            text,
            flags=re.IGNORECASE,
        )
        first = concept.split()[0] if concept else ""
        if first:
            idx = text.lower().find(first.lower())
            if 0 < idx <= 40:
                text = text[idx:]
        return text

    @staticmethod
    def _strip_topic_prefix(concept: str, chapter_title: str) -> str:
        """Remove a leading chapter-title prefix that merged into the concept name."""
        if not concept:
            return concept
        title = re.sub(
            r"^(chapter|unit|section|module|lesson)\s+[0-9IVXLC]+\s*[:.\-]?\s*",
            "",
            chapter_title,
            flags=re.IGNORECASE,
        ).strip()
        connectors = {"and", "of", "the", "to", "for"}
        title_tokens = {t for t in title.lower().split() if t not in connectors}
        if not title_tokens:
            return concept
        c_tokens = concept.split()
        i = 0
        while i < len(c_tokens) - 1 and (
            c_tokens[i].lower() in title_tokens or c_tokens[i].lower() in connectors
        ):
            i += 1
        # Do not leave a dangling leading connector (e.g. "and Energy").
        while i < len(c_tokens) - 1 and c_tokens[i].lower() in connectors:
            i += 1
        stripped = " ".join(c_tokens[i:]).strip()
        return stripped or concept

    @staticmethod
    def _top_keyword(text: str) -> str:
        freq = Counter(
            w.lower() for w in words(text) if len(w) > 4 and w.lower() not in _STOPWORDS
        )
        return freq.most_common(1)[0][0] if freq else ""

    # ------------------------------------------------ level assessment (offline)
    def assess_level(self, payload: dict) -> dict:
        # Level is a semantic judgment; without a model we do NOT fabricate one.
        return {
            "level_band": "unrated",
            "intrinsic_difficulty": "unknown",
            "reasoning_level": "",
            "steps_required": 0,
            "concepts_combined": 1,
            "confidence": 0.0,
            "rationale": "No LLM reachable; content level was not assessed.",
        }

    # --------------------------------------------- question generation (offline)
    def generate_question(self, spec: dict) -> dict | None:
        # Only a basic definition MCQ is safe to template offline. We never fake
        # competitive/expert items, and never invent a level for composites.
        band = spec.get("level_band", "unrated")
        if spec.get("composite") or band in {"jee_main", "jee_advanced", "expert"}:
            return None
        concepts = spec.get("concepts") or []
        if not concepts:
            return None
        main = concepts[0]
        definition = normalize_ws(main.get("definition", "")) or f"the meaning of {main['name']}"
        distractors = [d for d in (spec.get("misconceptions") or [])][:3]
        while len(distractors) < 3:
            distractors.append(f"An unrelated statement about {main['name']}.")
        return {
            "stem": f"Which of the following best describes {main['name']}?",
            "options": [definition] + distractors[:3],
            "correct_answer": definition,
            "distractors": distractors[:3],
            "worked_solution": (
                f"By definition, {main['name']} is: {definition} "
                "The distractors reflect common misconceptions."
            ),
            "source": "template_fallback",
        }

    # ------------------------------------------------------------------ phase 7
    def misconceptions(self, concept_name: str, definition: str) -> list[dict]:
        base = concept_name.strip()
        return [
            {
                "misconception": f"{base} is the same as a closely related term and can be used interchangeably.",
                "explanation": "Surface similarity leads learners to conflate distinct ideas, losing the specific meaning.",
                "correction": (
                    f"Anchor on the precise definition: {normalize_ws(definition)[:180]}"
                    if definition
                    else f"Return to the precise, textbook definition of {base} and contrast it with adjacent terms."
                ),
            },
            {
                "misconception": f"{base} always applies, regardless of context or assumptions.",
                "explanation": "Learners over-generalize a concept beyond the conditions under which it holds.",
                "correction": f"Identify the assumptions and boundary conditions that constrain when {base} is valid.",
            },
        ]
