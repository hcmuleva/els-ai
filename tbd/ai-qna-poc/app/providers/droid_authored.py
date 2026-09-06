"""The Droid provider: the offline "LLM" for this POC.

It composes questions from the curated bank in ``app.data.authored_bank`` and
tops up the requested count with parametrised numerical generators (physics &
mathematics) so any ``count`` can be satisfied while staying book-formatted.
Questions are independent of the source paper's raw text (the paper only informs
topic detection / provenance), so output stays clean and book-formatted. The
seed is randomized per request unless the caller supplies one, giving variety
across calls while remaining reproducible for a fixed seed.
"""
from __future__ import annotations

import random
from typing import Callable, List, Optional

from app.data.authored_bank import BANK, sc, steps
from app.providers.base import GenerationContext, LLMProvider, RawQuestion
from app.schemas import Difficulty, QuestionType


def _norm_topic(topic: Optional[str]) -> Optional[str]:
    if not topic:
        return None
    return topic.strip().lower().replace(" ", "_").replace("-", "_")


# --------------------------------------------------------------------------
# Parametrised generators (return book-format single_choice / true_false)
# --------------------------------------------------------------------------
def _g_series(rng: random.Random, difficulty: Difficulty) -> RawQuestion:
    r1 = rng.randint(2, 9)
    r2 = rng.choice([x for x in range(2, 10) if x != r1])  # distinct -> no degenerate distractors
    req = r1 + r2
    return sc(difficulty.value, "current_electricity",
              rf"Two resistors $R_1 = {r1}\,\Omega$ and $R_2 = {r2}\,\Omega$ are connected in **series**. "
              r"The equivalent resistance $R_{eq}$ is:",
              [(rf"${req}\,\Omega$", True),
               (rf"${round(r1*r2/req, 2)}\,\Omega$", False),
               (rf"${abs(r1-r2)}\,\Omega$", False),
               (rf"${r1*r2}\,\Omega$", False)],
              steps(
                  rf"**Given.** $R_1 = {r1}\,\Omega$ and $R_2 = {r2}\,\Omega$, connected in series.",
                  r"**The idea.** In series there is a single path, so the same current flows through both resistors and their resistances add up.",
                  r"**Step 1 — Series rule.** $$R_{eq} = R_1 + R_2.$$",
                  rf"**Step 2 — Substitute the values.** $$R_{{eq}} = {r1} + {r2} = {req}\,\Omega.$$",
                  rf"**Answer.** $R_{{eq}} = {req}\,\Omega$.",
              ),
              "CBSE Class 12 Physics, Current Electricity (parametrised numerical)",
              {"kind": "numeric", "expression": f"{r1}+{r2}", "expected": req,
               "exact_label": rf"${req}\,\Omega$"})


def _g_parallel(rng: random.Random, difficulty: Difficulty) -> RawQuestion:
    r1 = rng.choice([2, 3, 4, 6])
    r2 = rng.choice([x for x in (2, 3, 4, 6) if x != r1])  # distinct branches
    prod = r1 * r2
    summ = r1 + r2
    req = round(prod / summ, 2)
    return sc(difficulty.value, "current_electricity",
              rf"Two resistors $R_1 = {r1}\,\Omega$ and $R_2 = {r2}\,\Omega$ are connected in **parallel**. "
              r"The equivalent resistance $R_{eq}$ is:",
              [(rf"${req}\,\Omega$", True),
               (rf"${summ}\,\Omega$", False),
               (rf"${prod}\,\Omega$", False),
               (rf"${abs(r1-r2)}\,\Omega$", False)],
              steps(
                  rf"**Given.** $R_1 = {r1}\,\Omega$ and $R_2 = {r2}\,\Omega$, connected in parallel.",
                  r"**The idea.** Parallel branches give the current extra paths, so the combined resistance comes out smaller than either branch.",
                  r"**Step 1 — Parallel rule.** $$\dfrac{1}{R_{eq}} = \dfrac{1}{R_1} + \dfrac{1}{R_2}.$$",
                  r"**Step 2 — Combine into one fraction.** $$R_{eq} = \dfrac{R_1 R_2}{R_1 + R_2}.$$",
                  rf"**Step 3 — Substitute the values.** $$R_{{eq}} = \dfrac{{{prod}}}{{{summ}}} = {req}\,\Omega.$$",
                  rf"**Answer.** $R_{{eq}} = {req}\,\Omega$.",
              ),
              "CBSE Class 12 Physics, Current Electricity (parametrised numerical)",
              {"kind": "numeric", "expression": f"({r1}*{r2})/({r1}+{r2})", "expected": req,
               "tol": 0.01, "exact_label": rf"${req}\,\Omega$"})


def _g_ohm_current(rng: random.Random, difficulty: Difficulty) -> RawQuestion:
    r = rng.randint(2, 10)
    i = rng.randint(2, 6)  # i>=2 keeps every distractor distinct from the answer
    v = r * i
    return sc(difficulty.value, "current_electricity",
              rf"A resistor of $R = {r}\,\Omega$ has a potential difference of $V = {v}\,\text{{V}}$ across it. "
              r"The current through it is:",
              [(rf"${i}\,\text{{A}}$", True),
               (rf"${v*r}\,\text{{A}}$", False),
               (rf"${round(r/v, 2)}\,\text{{A}}$", False),
               (rf"${v+r}\,\text{{A}}$", False)],
              steps(
                  rf"**Given.** $R = {r}\,\Omega$ with $V = {v}\,\text{{V}}$ across it.",
                  r"**Step 1 — Ohm's law.** $$V = IR.$$",
                  r"**Step 2 — Make the current $I$ the subject.** $$I = \dfrac{V}{R}.$$",
                  rf"**Step 3 — Substitute the values.** $$I = \dfrac{{{v}}}{{{r}}} = {i}\,\text{{A}}.$$",
                  rf"**Answer.** $I = {i}\,\text{{A}}$.",
              ),
              "CBSE Class 10/12 Physics, Electricity (parametrised numerical)",
              {"kind": "numeric", "expression": f"{v}/{r}", "expected": i,
               "exact_label": rf"${i}\,\text{{A}}$"})


def _g_power(rng: random.Random, difficulty: Difficulty) -> RawQuestion:
    v = rng.choice([5, 10, 12, 20])
    i = rng.randint(2, 5)  # i>=2 keeps the "$V$" distractor distinct from the answer
    p = v * i
    return sc(difficulty.value, "current_electricity",
              rf"A device operates at $V = {v}\,\text{{V}}$ and draws a current $I = {i}\,\text{{A}}$. "
              r"The electrical power consumed is:",
              [(rf"${p}\,\text{{W}}$", True),
               (rf"${round(v/i, 2)}\,\text{{W}}$", False),
               (rf"${v+i}\,\text{{W}}$", False),
               (rf"${v}\,\text{{W}}$", False)],
              steps(
                  rf"**Given.** $V = {v}\,\text{{V}}$ and $I = {i}\,\text{{A}}$.",
                  r"**Step 1 — Power relation.** Electrical power is $$P = VI.$$",
                  rf"**Step 2 — Substitute the values.** $$P = {v} \times {i} = {p}\,\text{{W}}.$$",
                  rf"**Answer.** $P = {p}\,\text{{W}}$.",
              ),
              "CBSE Class 10/12 Physics, Electricity (parametrised numerical)",
              {"kind": "numeric", "expression": f"{v}*{i}", "expected": p,
               "exact_label": rf"${p}\,\text{{W}}$"})


def _g_derivative(rng: random.Random, difficulty: Difficulty) -> RawQuestion:
    a = rng.randint(2, 6)
    n = rng.randint(2, 5)
    coeff = a * n
    pw = n - 1
    deriv_str = rf"{coeff}x^{{{pw}}}" if pw != 1 else rf"{coeff}x"
    correct = rf"${deriv_str}$"
    return sc(difficulty.value, "calculus",
              rf"Differentiate $f(x) = {a}x^{{{n}}}$ with respect to $x$.",
              [(correct, True),
               (rf"${a}x^{{{pw}}}$", False),     # coefficient not multiplied
               (rf"${coeff}x^{{{n}}}$", False),  # power not reduced
               (rf"${a}x^{{{n}}}$", False)],      # neither rule applied
              steps(
                  rf"**Given.** $f(x) = {a}x^{{{n}}}$.",
                  r"**Rule — the power rule.** $$\dfrac{d}{dx}x^n = n\,x^{n-1}.$$",
                  rf"**Step 1 — Bring the power down as a multiplier.** Multiply the coefficient by $n = {n}$: $\;{a}\times{n} = {coeff}$.",
                  rf"**Step 2 — Reduce the power by one.** The exponent becomes ${n} - 1 = {pw}$, giving $$f'(x) = {deriv_str}.$$",
                  rf"**Answer.** $f'(x) = {deriv_str}$.",
              ),
              "CBSE Class 12 Mathematics, Differentiation (parametrised)",
              {"kind": "symbolic_derivative", "func": f"{a}*x**{n}",
               "expected": f"{coeff}*x**{pw}", "exact_label": correct})


def _g_integral(rng: random.Random, difficulty: Difficulty) -> RawQuestion:
    b = rng.choice([3, 5, 6, 7])  # avoids b where b^2/2 collides with a distractor
    val = round(b * b / 2, 1)
    val_str = str(int(val)) if val == int(val) else str(val)
    return sc(difficulty.value, "calculus",
              rf"Evaluate the definite integral $$\int_0^{{{b}}} x \, dx.$$",
              [(rf"${val_str}$", True),
               (rf"${b}$", False),
               (rf"${b*b}$", False),
               (rf"${2*b}$", False)],
              steps(
                  rf"**Evaluate.** $$\int_0^{{{b}}} x \, dx.$$",
                  r"**Step 1 — Antiderivative.** $$\int x\,dx = \dfrac{x^2}{2}.$$",
                  rf"**Step 2 — Apply the limits $0$ to ${b}$.** $$\left[\dfrac{{x^2}}{{2}}\right]_0^{{{b}}} = \dfrac{{{b}^2}}{{2}} - \dfrac{{0^2}}{{2}}.$$",
                  rf"**Step 3 — Simplify.** $$= \dfrac{{{b}^2}}{{2}} = {val_str}.$$",
                  rf"**Answer.** ${val_str}$.",
              ),
              "CBSE Class 12 Mathematics, Definite Integrals (parametrised)",
              {"kind": "symbolic_integral_def", "integrand": "x", "lower": 0, "upper": b,
               "expected": float(val), "exact_label": rf"${val_str}$"})


def _g_quadratic(rng: random.Random, difficulty: Difficulty) -> RawQuestion:
    p = rng.randint(1, 6)
    q = rng.choice([x for x in range(1, 7) if x != p])  # distinct roots
    b = p + q
    c = p * q
    return sc(difficulty.value, "quadratic_equations",
              rf"Find the roots of the quadratic equation $x^2 - {b}x + {c} = 0$.",
              [(rf"${p}$ and ${q}$", True),
               (rf"$-{p}$ and $-{q}$", False),
               (rf"${b}$ and ${c}$", False),
               (rf"${p}$ and $-{q}$", False)],
              steps(
                  rf"**Equation.** $x^2 - {b}x + {c} = 0$.",
                  rf"**Step 1 — Split the middle term.** Find two numbers that **multiply to ${c}$** and **add to ${b}$**: these are ${p}$ and ${q}$.",
                  rf"**Step 2 — Factorise.** $$(x - {p})(x - {q}) = 0.$$",
                  rf"**Step 3 — Zero-product rule.** Set each factor to $0$: $x = {p}$ or $x = {q}$.",
                  rf"**Answer.** $x = {p}$ and $x = {q}$.",
              ),
              "CBSE Class 10 Mathematics, Quadratic Equations (parametrised)",
              {"kind": "roots", "poly": f"x**2 - {b}*x + {c}", "expected": [p, q],
               "exact_label": rf"${p}$ and ${q}$"})





# topic -> generators that produce items for that topic family
_PHYS_GENS: List[Callable[[random.Random, Difficulty], RawQuestion]] = [
    _g_series, _g_parallel, _g_ohm_current, _g_power,
]
_MATH_GENS_12: List[Callable[[random.Random, Difficulty], RawQuestion]] = [
    _g_derivative, _g_integral,
]
_MATH_GENS_10: List[Callable[[random.Random, Difficulty], RawQuestion]] = [
    _g_quadratic, _g_ohm_current,
]


def _generators_for(class_level: str, subject: str) -> List[Callable[[random.Random, Difficulty], RawQuestion]]:
    if subject == "physics":
        return _PHYS_GENS
    if subject == "mathematics" and class_level == "12":
        return _MATH_GENS_12
    if subject == "mathematics" and class_level == "10":
        return _MATH_GENS_10
    return []


# Topic family each generator belongs to, so a topic-specific request is never
# padded with an off-topic family (e.g. a "semiconductors" ask must not pull in
# "current_electricity" filler).
_GEN_TOPIC: dict = {
    _g_series: "current_electricity",
    _g_parallel: "current_electricity",
    _g_ohm_current: "current_electricity",
    _g_power: "current_electricity",
    _g_derivative: "calculus",
    _g_integral: "calculus",
    _g_quadratic: "quadratic_equations",
}


def _gen_matches_topic(gen: Callable, wanted_topic: str) -> bool:
    family = _GEN_TOPIC.get(gen)
    if not family:
        return False
    return wanted_topic in family or family in wanted_topic


class DroidAuthoredProvider(LLMProvider):
    name = "droid-authored"

    def generate(self, ctx: GenerationContext) -> List[RawQuestion]:
        # Randomize per request unless an explicit seed is supplied (reproducible).
        rng = random.Random(ctx.seed) if ctx.seed is not None else random.Random()
        topics = BANK.get((ctx.class_level, ctx.subject), {})
        wanted_topic = _norm_topic(ctx.topic)            # explicit -> strict
        hint_topic = _norm_topic(ctx.detected_topic)     # detected -> soft preference

        # 1) gather static items, filtered to an EXPLICIT topic when it matches.
        #    A detected topic is never used to filter, so it can't shrink the
        #    pool and force a difficulty downgrade.
        static_pool: List[RawQuestion] = []
        topic_matched = False
        if wanted_topic:
            for topic_key, items in topics.items():
                if wanted_topic in topic_key or topic_key in wanted_topic:
                    static_pool.extend(items)
                    topic_matched = True
        if not static_pool:  # no explicit topic, or it did not match -> use everything
            for items in topics.values():
                static_pool.extend(items)

        allowed = set(ctx.allowed_types)

        def matches(item: RawQuestion, difficulty: Optional[Difficulty]) -> bool:
            if item["type"] not in allowed:
                return False
            if difficulty is not None and item["difficulty"] != difficulty:
                return False
            return True

        # 2) take static items at the requested difficulty first
        chosen: List[RawQuestion] = [i for i in static_pool if matches(i, ctx.difficulty)]
        rng.shuffle(chosen)
        seen_titles = {str(i["title_md"]) for i in chosen}

        # 3) top up with parametrised generators AT THE REQUESTED DIFFICULTY, so
        #    difficulty is honoured before we ever relax it. Generators are gated
        #    to an explicit topic so that request is never padded off-topic.
        gens = _generators_for(ctx.class_level, ctx.subject)
        if topic_matched and wanted_topic:
            gens = [g for g in gens if _gen_matches_topic(g, wanted_topic)]
        attempts = 0
        while len(chosen) < ctx.count and gens and attempts < ctx.count * 12:
            attempts += 1
            gen = rng.choice(gens)
            item = gen(rng, ctx.difficulty)
            if item["type"] not in allowed:
                continue
            title = str(item["title_md"])
            if title in seen_titles:
                continue
            seen_titles.add(title)
            chosen.append(item)

        # 4) only if still short, relax difficulty. Stay within an explicit topic;
        #    otherwise prefer the detected-topic items for relevance.
        if len(chosen) < ctx.count:
            extra = [i for i in static_pool
                     if matches(i, None) and str(i["title_md"]) not in seen_titles]
            rng.shuffle(extra)
            if not topic_matched and hint_topic:
                def _hint_first(it: RawQuestion) -> int:
                    tk = _norm_topic(str(it.get("topic", ""))) or ""
                    return 0 if (hint_topic in tk or tk in hint_topic) else 1
                extra.sort(key=_hint_first)
            for item in extra:
                if len(chosen) >= ctx.count:
                    break
                seen_titles.add(str(item["title_md"]))
                chosen.append(item)

        return chosen[: ctx.count]
