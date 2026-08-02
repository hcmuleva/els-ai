"""Maintainable concept-to-diagram validation rules."""
from __future__ import annotations

from typing import Any, Final

CONCEPT_RULES: Final[dict[str, dict[str, Any]]] = {
    "lr_current_growth": {
        "subject": "Physics",
        "family": "electricity",
        "allowed_kinds": {
            "physics-lr-circuit",
            "physics-current-time",
            "function-plot",
        },
        "forbidden_kinds": {"geometry", "angle", "mensuration"},
        "required_any": (
            {"dc_source", "resistor", "inductor"},
            {"time_axis", "current_axis", "exponential_growth_curve"},
        ),
        "rendered_required_any": (
            {"dc_source", "resistor", "inductor", "current_arrow"},
            {"physical_axes", "exponential_growth_curve"},
        ),
        "required_labels_any": ({"V", "R", "L"}, {"t", "I"}),
    },
    "transformer_ac_load": {
        "subject": "Physics",
        "family": "electricity",
        "allowed_kinds": {"physics-transformer", "transformer-circuit"},
        "forbidden_kinds": {
            "geometry",
            "angle",
            "mensuration",
            "function-plot",
        },
        "required_all": {
            "primary_coil",
            "secondary_coil",
            "magnetic_core",
            "ac_source",
        },
        "rendered_required_all": {
            "primary_coil",
            "secondary_coil",
            "magnetic_core",
            "ac_source",
        },
        "required_labels": {"Np", "Ns", "Vp", "Vs"},
    },
    "magnetic_flux_loop": {
        "subject": "Physics",
        "family": "electromagnetism",
        "allowed_kinds": {
            "physics-magnetic-flux",
            "magnetic-flux",
            "loop-field-angle",
        },
        "forbidden_kinds": {"geometry", "angle", "mensuration"},
        "required_all": {
            "conducting_loop",
            "loop_area",
            "magnetic_field_vector",
            "normal_vector",
            "angle_marker",
        },
        "rendered_required_all": {
            "conducting_loop",
            "loop_area",
            "magnetic_field_vector",
            "normal_vector",
            "angle_marker",
        },
        "required_labels": {"B", "A", "n"},
    },
    "mutual_induction": {
        "subject": "Physics",
        "family": "electromagnetism",
        "allowed_kinds": {
            "physics-coupled-coils",
            "coupled-coils",
            "induction-diagram",
        },
        "forbidden_kinds": {
            "geometry",
            "angle",
            "mensuration",
            "function-plot",
        },
        "required_all": {
            "coil_1",
            "coil_2",
            "coupling_indicator",
            "changing_current",
            "induced_emf",
        },
        "rendered_required_all": {
            "coil_1",
            "coil_2",
            "coupling_indicator",
            "changing_current",
            "induced_emf",
        },
        "required_labels": {"L1", "L2", "k", "i1", "ε2"},
    },
    "free_body_incline": {
        "subject": "Physics",
        "family": "mechanics",
        "allowed_kinds": {"physics-free-body", "free-body", "inclined-plane"},
        "forbidden_kinds": {"geometry", "angle", "mensuration"},
        "required_all": {
            "inclined_plane",
            "block",
            "gravity_vector",
            "normal_force_vector",
            "angle_marker",
        },
        "rendered_required_all": {
            "inclined_plane",
            "block",
            "gravity_vector",
            "normal_force_vector",
            "angle_marker",
        },
        "required_labels": {"mg", "N"},
    },
    "optics_refraction": {
        "subject": "Physics",
        "family": "optics",
        "allowed_kinds": {"physics-refraction", "ray-diagram", "ray-optics"},
        "forbidden_kinds": {"geometry", "angle", "mensuration"},
        "required_all": {
            "boundary",
            "normal_line",
            "incident_ray",
            "refracted_ray",
            "angle_of_incidence",
            "angle_of_refraction",
        },
        "rendered_required_all": {
            "boundary",
            "normal_line",
            "incident_ray",
            "refracted_ray",
            "angle_of_incidence",
            "angle_of_refraction",
        },
        "required_labels": {"n", "i", "r"},
    },
    "mathematical_function_plot": {
        "subject": "Mathematics",
        "family": "function-plot",
        "allowed_kinds": {
            "function-plot",
            "function-region",
            "coordinate",
            "lpp",
        },
        "forbidden_kinds": set(),
        "required_all": {"math_x_axis", "math_y_axis", "function_curve"},
        "required_labels": set(),
    },
    "chemical_reaction": {
        "subject": "Chemistry",
        "family": "chemical-reaction",
        "allowed_kinds": {"chemical-reaction", "chemical-equation"},
        "forbidden_kinds": {"geometry", "angle", "mensuration"},
        "required_all": {"reactants", "products", "reaction_arrow"},
        "rendered_required_all": {"reactants", "products", "reaction_arrow"},
        "required_labels": set(),
    },
}

SCORE_WEIGHTS: Final[dict[str, int]] = {
    "metadata": 8,
    "physics_correctness": 15,
    "answer_key_consistency": 20,
    "diagram_relevance": 12,
    "diagram_required_objects": 15,
    "diagram_labels": 8,
    "graph_quality": 5,
    "svg_schema": 5,
    "layout_quality": 3,
    "placeholder_detection": 4,
    "latex": 5,
}

CRITICAL_FAILURES: Final[set[str]] = {
    "no_correct_option",
    "multiple_correct_options",
    "answer_explanation_mismatch",
    "subject_mismatch",
    "diagram_irrelevant",
    "required_objects_missing",
    "invalid_latex",
    "invalid_svg",
    "placeholder_label",
}
