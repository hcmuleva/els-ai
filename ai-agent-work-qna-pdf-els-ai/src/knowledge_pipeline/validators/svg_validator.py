"""SVG and controlled DiagramSpec schema validation."""
from __future__ import annotations

import xml.etree.ElementTree as ET
from collections import Counter
from typing import Any

from ..assessment.validation import validate_svg
from ..diagram.dsl import DiagramSpec
from ..diagram.validation import validate_spec_semantics
from ..rendering.svg import render_svg
from .common import ConceptMatch, diagram_spec, normalize_token, result, unwrap_question
from .rules import CONCEPT_RULES


def _spec_labels(spec: DiagramSpec) -> list[str]:
    labels = [spec.title] if spec.title else []
    for element in spec.elements:
        label = getattr(element, "label", None)
        if label:
            labels.append(str(label))
        text = getattr(element, "text", None)
        if text:
            labels.append(str(text))
        if element.type == "axes":
            labels.extend([element.x_label, element.y_label])
    return [label for label in labels if label]


def _render_consistency(
    spec: DiagramSpec,
    root: ET.Element,
    svg_labels: list[str],
    concept: ConceptMatch,
) -> tuple[list[str], dict[str, Any]]:
    issues: list[str] = []
    source_render_consistent = True
    rendered_kind = root.attrib.get("data-diagram-kind")
    if rendered_kind != spec.kind:
        source_render_consistent = False
        issues.append(
            f"rendered SVG kind {rendered_kind!r} does not match spec kind {spec.kind!r}"
        )

    groups = {
        element.attrib["data-spec-index"]: element
        for element in root
        if element.tag.split("}")[-1] == "g"
        and "data-spec-index" in element.attrib
    }
    expected_indices = {str(index) for index in range(len(spec.elements))}
    missing_indices = sorted(expected_indices - set(groups))
    extra_indices = sorted(set(groups) - expected_indices)
    if missing_indices or extra_indices:
        source_render_consistent = False
        issues.append(
            "rendered SVG element groups do not match DiagramSpec indices"
        )

    expected_roles: Counter[str] = Counter()
    rendered_roles: Counter[str] = Counter()
    empty_groups: list[str] = []
    type_mismatches: list[str] = []
    role_mismatches: list[str] = []
    for index, element in enumerate(spec.elements):
        role = getattr(element, "role", None)
        if role:
            expected_roles[role] += 1
        group = groups.get(str(index))
        if group is None:
            continue
        if not list(group):
            empty_groups.append(str(index))
        rendered_type = group.attrib.get("data-element-type")
        if rendered_type != element.type:
            type_mismatches.append(
                f"{index}:{rendered_type!r}!={element.type!r}"
            )
        rendered_role = group.attrib.get("data-semantic-role")
        if rendered_role:
            rendered_roles[rendered_role] += 1
        if rendered_role != role:
            role_mismatches.append(
                f"{index}:{rendered_role!r}!={role!r}"
            )
    if empty_groups:
        source_render_consistent = False
        issues.append(
            "renderer produced empty SVG groups for spec indices: "
            + ", ".join(empty_groups)
        )
    if type_mismatches:
        source_render_consistent = False
        issues.append(
            "rendered SVG element types differ from the spec: "
            + ", ".join(type_mismatches)
        )
    if role_mismatches or expected_roles != rendered_roles:
        source_render_consistent = False
        issues.append("rendered SVG semantic roles differ from the DiagramSpec")

    normalized_svg_labels = {
        normalize_token(label) for label in svg_labels if normalize_token(label)
    }
    missing_labels = [
        label
        for label in _spec_labels(spec)
        if normalize_token(label) not in normalized_svg_labels
    ]
    if missing_labels:
        source_render_consistent = False
        issues.append(
            "DiagramSpec labels missing from rendered SVG: "
            + ", ".join(missing_labels)
        )

    rule = CONCEPT_RULES.get(concept.concept, {})
    required_roles = set(rule.get("rendered_required_all", set()))
    missing_required_roles = sorted(required_roles - set(rendered_roles))
    required_any = tuple(
        set(group) for group in rule.get("rendered_required_any", ())
    )
    alternatives_satisfied = not required_any or any(
        group <= set(rendered_roles) for group in required_any
    )
    if required_any and not alternatives_satisfied:
        smallest_gap = min(
            (group - set(rendered_roles) for group in required_any),
            key=lambda values: (len(values), sorted(values)),
        )
        missing_required_roles.extend(sorted(smallest_gap))
        missing_required_roles = sorted(set(missing_required_roles))
    if missing_required_roles:
        issues.append(
            "rendered SVG is missing required semantic object(s): "
            + ", ".join(missing_required_roles)
        )

    role_names = set(rendered_roles)
    rendered_object_counts = {
        "coil_count": sum(
            role in role_names
            for role in ("coil_1", "coil_2", "primary_coil", "secondary_coil")
        ),
        "transformer_core_count": int("magnetic_core" in role_names),
        "resistor_count": sum(
            role in role_names for role in ("resistor", "load_resistor")
        ),
        "inductor_count": sum(
            role in role_names for role in ("inductor", "load_inductor")
        ),
        "field_vector_count": int("magnetic_field_vector" in role_names),
        "loop_count": int("conducting_loop" in role_names),
        "angle_marker_count": sum(
            rendered_roles[role]
            for role in (
                "angle_marker",
                "angle_of_incidence",
                "angle_of_refraction",
            )
        ),
    }
    return issues, {
        "source_element_count": len(spec.elements),
        "rendered_element_count": len(groups),
        "source_role_counts": dict(sorted(expected_roles.items())),
        "rendered_role_counts": dict(sorted(rendered_roles.items())),
        "missing_rendered_labels": missing_labels,
        "missing_rendered_objects": missing_required_roles,
        "rendered_alternatives_satisfied": alternatives_satisfied,
        "source_render_consistent": source_render_consistent,
        "rendered_object_counts": rendered_object_counts,
    }


def validate_svg_content(
    question: dict[str, Any],
    concept: ConceptMatch,
    *,
    required: bool = False,
) -> Any:
    raw = unwrap_question(question)
    spec_data = diagram_spec(question)
    svg = str(raw.get("question_svg") or "")
    issues: list[str] = []
    critical: list[str] = []
    spec_valid = True
    svg_valid = True
    spec: DiagramSpec | None = None
    consistency_details: dict[str, Any] = {}

    if required and (not spec_data or not svg.strip()):
        issues.append("required diagram is missing its structured spec or rendered SVG")
        critical.append("invalid_svg")
    if bool(spec_data) != bool(svg.strip()):
        issues.append("structured diagram and rendered SVG presence do not match")
        critical.append("invalid_svg")

    if spec_data:
        try:
            spec = DiagramSpec.model_validate(spec_data)
        except Exception as exc:
            spec_valid = False
            issues.append(f"invalid DiagramSpec schema: {exc}")
        else:
            spec_valid, semantic_issues = validate_spec_semantics(spec)
            issues.extend(semantic_issues)

    labels: list[str] = []
    if svg.strip():
        svg_valid, svg_issues = validate_svg(svg)
        issues.extend(svg_issues)
        if svg_valid:
            root = ET.fromstring(svg)
            if "width" not in root.attrib or "height" not in root.attrib:
                issues.append("SVG must declare width and height")
            if "viewBox" not in root.attrib:
                issues.append("SVG must declare a viewBox")
            for element in root.iter():
                tag = element.tag.split("}")[-1]
                if tag in {"script", "foreignObject", "iframe", "object", "embed"}:
                    issues.append(f"unsafe SVG element: {tag}")
                if tag == "text":
                    label = "".join(element.itertext()).strip()
                    labels.append(label)
                    if not label:
                        issues.append("SVG contains an empty text element")
            if spec is not None and spec_valid:
                try:
                    canonical_expected = ET.canonicalize(render_svg(spec))
                    canonical_actual = ET.canonicalize(svg)
                except Exception:
                    canonical_match = False
                else:
                    canonical_match = canonical_expected == canonical_actual
                if not canonical_match:
                    issues.append(
                        "rendered SVG does not match deterministic rendering of "
                        "the DiagramSpec"
                    )
                    critical.append("diagram_render_mismatch")
                render_issues, consistency_details = _render_consistency(
                    spec,
                    root,
                    labels,
                    concept,
                )
                issues.extend(render_issues)
                consistency_details["canonical_render_match"] = canonical_match
                if (
                    render_issues
                    and not consistency_details.get(
                        "source_render_consistent",
                        False,
                    )
                ):
                    critical.append("diagram_render_mismatch")

    if issues and (not spec_valid or not svg_valid):
        critical.append("invalid_svg")
    return result(
        issues=issues,
        critical_failures=critical,
        spec_valid=spec_valid,
        svg_valid=svg_valid,
        label_count=len(labels),
        **consistency_details,
    )
