"""Feature extraction from controlled DiagramSpec objects."""
from __future__ import annotations

import re
from typing import Any

from ..diagram.dsl import (
    AngleMark,
    Arrow,
    Axes,
    Circle,
    DiagramSpec,
    FunctionPlot,
    Label,
    Polygon,
    Segment,
)
from .common import diagram_spec


def inspect_diagram(question: dict[str, Any]) -> dict[str, Any]:
    raw = diagram_spec(question)
    if not raw:
        return {"kind": None, "objects": set(), "labels": [], "axes": []}
    try:
        spec = DiagramSpec.model_validate(raw)
    except Exception:
        return {
            "kind": str(raw.get("kind") or ""),
            "objects": set(),
            "labels": [],
            "axes": [],
        }

    kind = spec.kind.casefold()
    objects: set[str] = set()
    labels: list[str] = [spec.title] if spec.title else []
    axes: list[tuple[str, str]] = []
    circles = 0
    segments = 0

    for element in spec.elements:
        role = getattr(element, "role", None)
        if role:
            objects.add(str(role))
        label = getattr(element, "label", None)
        if label:
            labels.append(str(label))
        if isinstance(element, Label):
            labels.append(element.text)
        elif isinstance(element, Axes):
            axes.append((element.x_label, element.y_label))
            labels.extend([element.x_label, element.y_label])
            x_label = element.x_label.casefold()
            y_label = element.y_label.casefold()
            if re.search(r"(?:^|[^a-z])t(?:[^a-z]|$)|time", x_label):
                objects.add("time_axis")
            if re.search(r"(?:^|[^a-z])i(?:[^a-z]|$)|current", y_label):
                objects.add("current_axis")
            if x_label.strip() == "x":
                objects.add("math_x_axis")
            if y_label.strip() == "y":
                objects.add("math_y_axis")
        elif isinstance(element, FunctionPlot):
            objects.add("function_curve")
            expression = element.expr.replace(" ", "").casefold()
            if "exp(" in expression or "e**" in expression:
                objects.add("exponential_growth_curve")
        elif isinstance(element, Arrow):
            label_token = (element.label or "").casefold()
            if re.search(r"(?:^|[^a-z])b(?:[^a-z]|$)|magnetic", label_token):
                objects.add("magnetic_field_vector")
            if label_token in {"n", "normal"} or "normal" in label_token:
                objects.add("normal_vector")
            if "mg" in label_token or "weight" in label_token:
                objects.add("gravity_vector")
            if label_token == "n" or "normal force" in label_token:
                objects.add("normal_force_vector")
            if label_token == "f" or "friction" in label_token:
                objects.add("friction_vector")
            if "incident" in label_token:
                objects.add("incident_ray")
            if "refracted" in label_token:
                objects.add("refracted_ray")
        elif isinstance(element, AngleMark):
            objects.add("angle_marker")
        elif isinstance(element, Polygon):
            if kind == "physics-magnetic-flux":
                objects.add("conducting_loop")
            if kind == "physics-free-body":
                objects.update({"inclined_plane", "block"})
        elif isinstance(element, Circle):
            circles += 1
        elif isinstance(element, Segment):
            segments += 1

    joined = " ".join(labels).casefold()
    if re.search(r"(?:^|\W)a\s*(?:=|\b)|\barea\b", joined):
        objects.add("loop_area")
    if kind == "physics-lr-circuit":
        if re.search(r"\b(?:dc|source|battery)\b", joined):
            objects.add("dc_source")
        if re.search(r"(?:^|\W)r\s*=", joined) or "resistor" in joined:
            objects.add("resistor")
        if re.search(r"(?:^|\W)l\s*=", joined) or "inductor" in joined:
            objects.add("inductor")
    if kind == "physics-transformer":
        if re.search(r"\bnp\b|n_p", joined):
            objects.add("primary_coil")
        if re.search(r"\bns\b|n_s", joined):
            objects.add("secondary_coil")
        if "core" in joined:
            objects.add("magnetic_core")
        if re.search(r"\bac\b|\bvp\b|v_p", joined):
            objects.add("ac_source")
        if re.search(r"(?:^|\W)r\s*=", joined) or "resistor" in joined:
            objects.add("load_resistor")
        if re.search(r"(?:^|\W)l\s*=", joined) or "inductor" in joined:
            objects.add("load_inductor")
    if kind == "physics-coupled-coils":
        if re.search(r"\bl1\b|l_1", joined):
            objects.add("coil_1")
        if re.search(r"\bl2\b|l_2", joined):
            objects.add("coil_2")
        if re.search(r"(?:^|\W)k\s*=", joined) or "coupling" in joined:
            objects.add("coupling_indicator")
        if re.search(r"\bi1\b|i_1|changing current", joined):
            objects.add("changing_current")
        if "ε2" in joined or r"\epsilon_2" in joined or "emf" in joined:
            objects.add("induced_emf")
    if kind == "physics-refraction":
        if "boundary" in joined:
            objects.add("boundary")
        if "normal" in joined or re.search(r"(?:^|\W)n(?:\W|$)", joined):
            objects.add("normal_line")
        if "incident" in joined:
            objects.add("incident_ray")
        if "refracted" in joined:
            objects.add("refracted_ray")
        if re.search(r"(?:^|\W)i(?:\W|$)|incidence", joined):
            objects.add("angle_of_incidence")
        if re.search(r"(?:^|\W)r(?:\W|$)|refraction", joined):
            objects.add("angle_of_refraction")
    if kind == "chemical-reaction":
        if "reactant" in joined:
            objects.add("reactants")
        if "product" in joined:
            objects.add("products")
        if any(isinstance(element, Arrow) for element in spec.elements):
            objects.add("reaction_arrow")

    return {
        "kind": spec.kind,
        "objects": objects,
        "labels": [label for label in labels if label],
        "axes": axes,
        "circle_count": circles,
        "segment_count": segments,
    }
