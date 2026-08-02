"""Actionable repair instructions derived from deterministic validation failures."""
from __future__ import annotations

from typing import Any

from .common import ConceptMatch

_BASE_REPAIRS = {
    "lr_current_growth": (
        "Use a static LR circuit or an annotated current-time graph.",
        "For a graph, label the axes t (s) and I (A), draw exponential growth, "
        "and mark any percentage stated in the question.",
    ),
    "transformer_ac_load": (
        "Replace the diagram with a static transformer circuit.",
        "Show an AC source, primary and secondary coils, magnetic core, connection "
        "wires, and the secondary R-L load.",
        "Label Np, Ns, Vp, Vs, R, L, and the turns ratio using only values from the question.",
    ),
    "magnetic_flux_loop": (
        "Replace angle-only geometry with a static magnetic-flux loop diagram.",
        "Draw a conducting loop, its area A, normal vector n, magnetic field vector B, "
        "and the angle arc between B and n.",
    ),
    "mutual_induction": (
        "Replace generic geometry with a static coupled-coils diagram.",
        "Draw two coils and label L1, L2, k, changing current i1, and induced emf ε2.",
    ),
    "free_body_incline": (
        "Draw the body and contact surface with force vectors from the body.",
        "Keep mg vertical, N perpendicular to the surface, and friction parallel to it.",
    ),
    "optics_refraction": (
        "Draw the boundary, normal, incident ray, refracted ray, and both angle markers.",
    ),
    "chemical_reaction": (
        "Use a static chemical equation with reactants, reaction arrow, and products.",
        "Preserve subscripts, charges, coefficients, and states from the question.",
    ),
}


def generate_repair_instructions(
    concept: ConceptMatch,
    checks: dict[str, Any],
) -> list[str]:
    instructions: list[str] = []
    metadata = checks.get("metadata", {})
    if metadata.get("status") == "fail":
        expected = metadata.get("expected_subject")
        if expected:
            instructions.append(
                f"Set question.subject and question_data._meta.subject to {expected!r}."
            )

    answer = checks.get("answer_key_consistency", {})
    if answer.get("status") == "fail":
        expected = answer.get("expected_from_explanation")
        if expected:
            instructions.append(
                f"Mark the option matching the derived result {expected} as correct and "
                "update conflicting rationales."
            )
        else:
            instructions.append(
                "Recompute the answer and make exactly one correct option agree with the explanation."
            )

    for instruction in _BASE_REPAIRS.get(concept.concept, ()):
        if any(
            checks.get(name, {}).get("status") == "fail"
            for name in (
                "diagram_relevance",
                "diagram_required_objects",
                "diagram_labels",
                "graph_quality",
            )
        ):
            instructions.append(instruction)

    missing_objects = checks.get("diagram_required_objects", {}).get(
        "missing_objects", []
    )
    if missing_objects:
        instructions.append(
            "Add missing visual objects: " + ", ".join(missing_objects) + "."
        )
    missing_labels = checks.get("diagram_labels", {}).get("missing_labels", [])
    if missing_labels:
        instructions.append("Add missing labels: " + ", ".join(missing_labels) + ".")
    placeholders = checks.get("placeholder_detection", {}).get(
        "found_placeholders", []
    )
    if placeholders:
        instructions.append(
            "Remove placeholder labels: " + ", ".join(placeholders) + "."
        )
    if checks.get("layout_quality", {}).get("status") != "pass":
        instructions.append(
            "Reposition labels and objects so text is unclipped and non-overlapping."
        )
    if checks.get("svg_schema", {}).get("status") != "pass":
        instructions.append(
            "Regenerate the SVG from the controlled DiagramSpec and verify every "
            "spec element, semantic role, and required label appears in the rendered SVG."
        )
    return list(dict.fromkeys(instructions))
