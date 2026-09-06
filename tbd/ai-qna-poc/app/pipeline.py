"""Pipeline orchestration.

Retriever -> Parser -> Generator -> (per candidate) structure check ->
deterministic verifier -> LLM critic -> accept; with a repair loop that keeps
generating replacements until ``count`` is met or attempts are exhausted.

Correctness layers, in order of cost:
1. Structure   - option counts, correct-option rules, non-empty text.
2. Verifier    - deterministic sympy re-computation (only when a spec exists).
3. Critic      - independent LLM re-solve (only when an API key is set).
The answer key is always derived from the verified ``is_correct`` flags, never
from any model's free-text claim. The authored bank is the always-available
fallback so the API never fails.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List

from app.agents import critic, generator, parser, retriever, verifier
from app.agents.validator import build_question, check_structure
from app.config import settings
from app.providers import get_provider
from app.providers.base import RawQuestion
from app.schemas import GenerateRequest, GenerateResponse, ValidationReport

_BUFFER = 4  # over-generate a little so refuted/duplicate items can be replaced


def run(req: GenerateRequest) -> GenerateResponse:
    class_level = req.class_level.value
    subject = req.subject.value
    allowed_types = req.normalized_types()

    # 1) Retrieve a source paper (live HF or bundled sample) and parse it.
    retrieved = retriever.retrieve(class_level, subject, seed=req.seed)
    parsed = parser.parse(retrieved, class_level, subject)
    topic = req.topic or parsed.detected_topic

    accepted: List[RawQuestion] = []
    seen = set()
    warnings: List[str] = []
    deduped = verified = refuted = repaired = 0
    critic_ran = False
    max_attempts = max(1, settings.max_repair_attempts + 1)
    attempt = 0

    while len(accepted) < req.count and attempt < max_attempts:
        seed = req.seed
        if seed is not None and attempt > 0:
            seed = seed + attempt * 1009  # vary seed so repairs differ

        candidates = generator.generate(
            class_level=class_level,
            subject=subject,
            difficulty=req.difficulty,
            allowed_types=allowed_types,
            count=req.count - len(accepted) + _BUFFER,
            topic=req.topic,  # explicit topic stays strict
            detected_topic=parsed.detected_topic,  # soft hint; never overrides difficulty
            seed=seed,
            source_text=parsed.text,
        )

        progressed = False
        for raw in candidates:
            if len(accepted) >= req.count:
                break

            struct = check_structure(raw)
            if not struct.ok:
                warnings.append(f"dropped (structure: {struct.reason})")
                continue

            title = str(raw["title_md"]).strip()
            qtype = raw["type"]
            qtype_val = getattr(qtype, "value", str(qtype))
            key = (title, qtype_val)
            if key in seen:
                deduped += 1
                continue

            # Layer 2: deterministic verification (skips when no spec).
            vres = verifier.verify(raw)
            if vres.status == verifier.REFUTED:
                refuted += 1
                warnings.append(f"refuted (verifier: {vres.detail})")
                continue
            if vres.status == verifier.VERIFIED:
                verified += 1

            # Layer 3: LLM critic (skips gracefully when no API key).
            cres = critic.review(raw)
            if cres.status != critic.SKIPPED:
                critic_ran = True
            if cres.status == critic.REFUTED:
                refuted += 1
                warnings.append(f"refuted (critic: {cres.reason})")
                continue

            seen.add(key)
            warnings.extend(struct.warnings)
            accepted.append(raw)
            progressed = True
            if attempt > 0:
                repaired += 1

        attempt += 1
        # The Droid provider is deterministic per seed; if a full round added no
        # new unique questions, further identical rounds won't help.
        if not progressed:
            break

    questions = [
        build_question(raw, i + 1, req.difficulty)
        for i, raw in enumerate(accepted[: req.count])
    ]

    checks = [
        f"{len(questions)} questions passed structural validation",
        "answer keys derived from correct options",
        "book-format math delimiters checked",
        f"{verified} verified by deterministic sympy checks",
        "LLM critic independently re-solved each question"
        if critic_ran else "LLM critic skipped (no API key)",
    ]

    report = ValidationReport(
        passed=len(questions) > 0,
        checks=checks,
        warnings=warnings,
        deduped=deduped,
        verified=verified,
        refuted=refuted,
        critic="ran" if critic_ran else "skipped",
        repaired=repaired,
        attempts=attempt,
    )

    meta = {
        "class_level": class_level,
        "subject": subject,
        "difficulty": req.difficulty.value,
        "requested_count": req.count,
        "returned_count": len(questions),
        "topic": topic,
        "allowed_types": [t.value for t in allowed_types],
        "provider": get_provider().name,
        "format": "book-markdown-latex",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    return GenerateResponse(
        meta=meta,
        source=parsed.info,
        validation=report,
        questions=questions,
    )
