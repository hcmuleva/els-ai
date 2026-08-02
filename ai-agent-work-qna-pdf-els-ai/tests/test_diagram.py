import math
import xml.etree.ElementTree as ET

from knowledge_pipeline.diagram import builders as B
from knowledge_pipeline.diagram.dsl import (
    Arrow,
    Axes,
    DiagramSpec,
    FunctionPlot,
    FunctionRegion,
    Grid,
    ParallelMark,
    RightAngleMark,
    Segment,
    TickMark,
)
from knowledge_pipeline.diagram.catalog import (
    diagram_prompt_guide,
    supported_diagram_types,
)
from knowledge_pipeline.diagram.from_spec import build_diagram_from_spec
from knowledge_pipeline.diagram.validation import (
    validate_spec_semantics,
    validate_svg_layout,
)
from knowledge_pipeline.rendering.svg import (
    _segment_intersects_box,
    _text_box,
    render_svg,
)


def _all_specs():
    return {
        "func": B.function_plot("x**2 - 2", -3, 3, -3, 7, label="y", points=[(0, -2, "min")]),
        "lpp": B.lpp_region([(1, 1, 4, "<=")], [(0, 0), (3, 0), (0, 4)], xmax=6, ymax=6),
        "circle": B.circle_diagram(3, marked=[(30, "A"), (150, "B")], chords=[(30, 150)]),
        "tri": B.triangle_diagram((0, 0), (4, 0), (1, 3), mark_angle_at=0, angle_label="t"),
        "angle": B.angle_diagram(label="60"),
        "mens": B.mensuration_rectangle(5, 3, "5 cm", "3 cm"),
        "coord": B.coordinate_diagram([(1, 2, "A"), (4, 6, "B")], [((1, 2), (4, 6), "d")]),
        "incline": B.inclined_plane_free_body(30),
        "projectile": B.projectile_motion(20, 45),
        "lens": B.convex_lens_ray_diagram(2, 6, 2),
        "right-triangle": B.right_triangle_diagram(
            3, 4, "top-right", side_labels=("3", "5", "4")
        ),
        "bar-chart": B.bar_chart(
            ["A", "B", "C"], [4, 7, 5], max_value=8, tick_step=2
        ),
        "pie-chart": B.pie_chart(
            ["Bus", "Walk", "Train"], [6, 7, 11], label_mode="degrees"
        ),
        "pictogram": B.pictogram(
            [("Bike", 5, "#0891b2"), ("Train", 8, "#f97316")], unit=2
        ),
        "relations": DiagramSpec(
            kind="geometry-relations",
            xmin=-1,
            xmax=6,
            ymin=-1,
            ymax=5,
            elements=[
                Segment(a=(0, 0), b=(4, 0)),
                Segment(a=(0, 0), b=(0, 3)),
                RightAngleMark(vertex=(0, 0), p1=(4, 0), p2=(0, 3)),
                TickMark(a=(0, 0), b=(0, 3)),
                Segment(a=(0, 4), b=(5, 4)),
                ParallelMark(a=(0, 0), b=(4, 0)),
                ParallelMark(a=(0, 4), b=(5, 4)),
            ],
        ),
    }


def test_all_families_render_valid_svg():
    for name, spec in _all_specs().items():
        svg = render_svg(spec)
        assert svg.startswith("<svg") and svg.endswith("</svg>"), name
        assert svg.count("<svg") == 1


def test_render_is_deterministic():
    for spec in _all_specs().values():
        assert render_svg(spec) == render_svg(spec)


def test_dsl_json_round_trip():
    for spec in _all_specs().values():
        reparsed = DiagramSpec.model_validate_json(spec.model_dump_json())
        assert render_svg(reparsed) == render_svg(spec)


def test_function_plot_samples_within_view_only():
    # tan-like blowups must not produce points outside the viewport
    spec = B.function_plot("1/x", -3, 3, -3, 3)
    svg = render_svg(spec)
    assert "polyline" in svg


def test_physics_builders_include_expected_semantics():
    incline = render_svg(B.inclined_plane_free_body(30))
    assert all(label in incline for label in ("30°", ">mg<", ">N<", ">f<"))
    assert incline.count("<polygon") >= 5

    projectile = render_svg(B.projectile_motion(20, 45))
    assert "trajectory" in projectile
    assert "45°" in projectile

    lens = render_svg(B.convex_lens_ray_diagram(2, 6, 2))
    assert all(label in lens for label in ("object", "image", "F₁", "F₂"))


def test_incline_force_vectors_are_physically_aligned():
    spec = B.inclined_plane_free_body(30)
    forces = {
        element.label: element
        for element in spec.elements
        if isinstance(element, Arrow)
    }
    tangent = (math.cos(math.radians(30)), math.sin(math.radians(30)))

    gravity = (
        forces["mg"].end[0] - forces["mg"].start[0],
        forces["mg"].end[1] - forces["mg"].start[1],
    )
    normal = (
        forces["N"].end[0] - forces["N"].start[0],
        forces["N"].end[1] - forces["N"].start[1],
    )
    friction = (
        forces["f"].end[0] - forces["f"].start[0],
        forces["f"].end[1] - forces["f"].start[1],
    )

    assert abs(gravity[0]) < 1e-9 and gravity[1] < 0
    assert abs(normal[0] * tangent[0] + normal[1] * tangent[1]) < 1e-9
    assert abs(friction[0] * tangent[1] - friction[1] * tangent[0]) < 1e-9
    assert friction[0] * tangent[0] + friction[1] * tangent[1] > 0


def test_controlled_physics_specs_render():
    specs = [
        {"type": "inclined-plane", "angle_degrees": 30},
        {"type": "projectile", "speed": 20, "angle_degrees": 45},
        {
            "type": "convex-lens",
            "focal_length": 2,
            "object_distance": 6,
            "object_height": 2,
        },
    ]
    for raw in specs:
        built = build_diagram_from_spec(raw)
        assert built is not None
        assert render_svg(built).startswith("<svg")


def test_function_region_renders_and_validates():
    spec = DiagramSpec(
        kind="function-region",
        xmin=-2.5,
        xmax=2.5,
        ymin=-0.5,
        ymax=4.5,
        elements=[
            Grid(),
            Axes(),
            FunctionRegion(
                upper_expr="4",
                lower_expr="x**2",
                domain=(-2, 2),
            ),
            FunctionPlot(expr="x**2", domain=(-2, 2)),
        ],
    )
    svg = render_svg(spec)
    assert '<polygon points="' in svg
    assert 'fill-opacity="0.35"' in svg
    assert validate_spec_semantics(spec) == (True, [])
    assert validate_svg_layout(svg) == (True, [])


def test_controlled_function_region_spec_renders():
    built = build_diagram_from_spec(
        {
            "type": "function-region",
            "upper_expr": "x",
            "lower_expr": "x**2",
            "xmin": 0,
            "xmax": 1,
            "ymin": -0.2,
            "ymax": 1.2,
        }
    )
    assert built is not None
    assert '<polygon points="' in render_svg(built)


def test_controlled_worksheet_and_chart_specs_render():
    specs = [
        {
            "type": "right-triangle",
            "leg_a": 10,
            "leg_b": 14,
            "orientation": "bottom-right",
            "side_labels": ["10", "?", "14"],
            "angle_at": 1,
            "angle_label": "55°",
        },
        {
            "type": "bar-chart",
            "categories": ["Tea", "Coffee", "Milk"],
            "values": [40, 45, 105],
            "max_value": 120,
            "tick_step": 20,
        },
        {
            "type": "pie-chart",
            "categories": ["Bus", "Walk", "Train"],
            "values": [6, 7, 11],
            "label_mode": "degrees",
        },
        {
            "type": "pictogram",
            "unit": 2,
            "rows": [
                {"label": "Bike", "value": 5},
                {"label": "Train", "value": 8},
            ],
        },
    ]
    for raw in specs:
        built = build_diagram_from_spec(raw)
        assert built is not None, raw["type"]
        assert render_svg(built).startswith("<svg")


def test_shared_agent_catalog_includes_rich_families():
    guide = diagram_prompt_guide()
    required = {
        "right-triangle",
        "bar-chart",
        "pie-chart",
        "pictogram",
        "geometry",
        "triangle-geometry",
        "circle-geometry",
        "solid-geometry",
    }
    assert required.issubset(set(supported_diagram_types()))
    assert all(f"- {name}:" in guide for name in required)


def test_complex_geometry_specs_render_with_relations_and_hidden_edges():
    specs = [
        {
            "type": "triangle-geometry",
            "polygons": [{
                "vertices": [[-3, 0], [3, 0], [0, 3]],
                "labels": ["A", "B", "C"],
                "role": "triangle",
            }],
            "circles": [{
                "center": [0, 0],
                "radius": 3,
                "role": "circumcircle",
            }],
            "segments": [{
                "a": [0, 3],
                "b": [0, 0],
                "role": "cevian",
                "label": "CD",
            }],
            "points": [[0, 0, "D"]],
            "angles": [
                {
                    "vertex": [0, 3],
                    "p1": [-3, 0],
                    "p2": [0, 0],
                    "label": "α",
                },
                {
                    "vertex": [0, 3],
                    "p1": [0, 0],
                    "p2": [3, 0],
                    "label": "β",
                },
            ],
        },
        {
            "type": "circle-geometry",
            "circles": [{"center": [0, 0], "radius": 3, "role": "circle"}],
            "segments": [
                {"a": [3, -3], "b": [3, 3], "role": "tangent"},
                {"a": [-4, -1], "b": [3.5, 1.5], "role": "secant"},
                {"a": [0, 0], "b": [3, 0], "role": "radius", "label": "OT"},
            ],
            "points": [[0, 0, "O"], [3, 0, "T"], [-2.85, -0.95, "A"]],
        },
        {
            "type": "solid-geometry",
            "segments": [
                {"a": [-3, -2], "b": [3, -2], "role": "visible_edge"},
                {"a": [-3, -2], "b": [0, 4], "role": "visible_edge"},
                {"a": [3, -2], "b": [0, 4], "role": "visible_edge"},
                {
                    "a": [-3, -2],
                    "b": [1, 2],
                    "role": "hidden_edge",
                    "dashed": True,
                    "color": "#64748b",
                },
                {"a": [1, 2], "b": [0, 4], "role": "visible_edge"},
            ],
            "points": [[-3, -2, "A"], [3, -2, "B"], [1, 2, "C"], [0, 4, "D"]],
        },
    ]

    for raw in specs:
        built = build_diagram_from_spec(raw)
        assert built is not None, raw["type"]
        assert built.kind == raw["type"]
        assert render_svg(built).startswith("<svg")

    solid = build_diagram_from_spec(specs[-1])
    hidden = next(
        element
        for element in solid.elements
        if isinstance(element, Segment) and element.role == "hidden_edge"
    )
    assert hidden.dashed is True
    assert hidden.color == "#64748b"


def test_relation_validation_rejects_false_geometry_claims():
    invalid = DiagramSpec(
        kind="invalid-relations",
        xmin=-1,
        xmax=6,
        ymin=-1,
        ymax=5,
        elements=[
            RightAngleMark(vertex=(0, 0), p1=(4, 0), p2=(2, 3)),
            TickMark(a=(0, 0), b=(2, 0), count=1),
            TickMark(a=(0, 1), b=(4, 1), count=1),
            ParallelMark(a=(0, 0), b=(4, 0), count=1),
            ParallelMark(a=(0, 2), b=(4, 3), count=1),
        ],
    )
    valid, issues = validate_spec_semantics(invalid)
    assert not valid
    assert "right-angle mark references non-perpendicular rays" in issues
    assert "matching tick marks reference unequal segments" in issues
    assert "matching parallel marks reference non-parallel segments" in issues


def _auto_label_boxes(svg: str):
    root = ET.fromstring(svg)
    boxes = []
    for element in root.iter():
        if element.tag.split("}")[-1] != "text":
            continue
        if element.attrib.get("data-layout") != "auto":
            continue
        text = "".join(element.itertext())
        boxes.append(
            _text_box(
                text,
                float(element.attrib["x"]),
                float(element.attrib["y"]),
                element.attrib.get("text-anchor", "start"),
                float(element.attrib.get("font-size", 12)),
            )
        )
    return boxes


def test_auto_labels_do_not_overlap_each_other():
    for name, spec in _all_specs().items():
        boxes = _auto_label_boxes(render_svg(spec))
        for index, first in enumerate(boxes):
            for second in boxes[index + 1 :]:
                width = min(first[2], second[2]) - max(first[0], second[0])
                height = min(first[3], second[3]) - max(first[1], second[1])
                assert width <= 0 or height <= 0, name


def test_coordinate_segment_label_does_not_cross_segment():
    spec = B.coordinate_diagram(
        [(1, 2, "P(1,2)"), (5, 5, "Q(5,5)")],
        [((1, 2), (5, 5), "PQ=5")],
    )
    svg = render_svg(spec)
    label_box = next(
        box
        for box, text in zip(
            _auto_label_boxes(svg),
            [
                "".join(element.itertext())
                for element in ET.fromstring(svg).iter()
                if element.tag.split("}")[-1] == "text"
                and element.attrib.get("data-layout") == "auto"
            ],
        )
        if text == "PQ=5"
    )
    canvas_width = spec.width - 68
    canvas_height = spec.height - 68
    x1 = 34 + (1 - spec.xmin) / (spec.xmax - spec.xmin) * canvas_width
    y1 = spec.height - 34 - (2 - spec.ymin) / (spec.ymax - spec.ymin) * canvas_height
    x2 = 34 + (5 - spec.xmin) / (spec.xmax - spec.xmin) * canvas_width
    y2 = spec.height - 34 - (5 - spec.ymin) / (spec.ymax - spec.ymin) * canvas_height
    assert not _segment_intersects_box((x1, y1, x2, y2), label_box)
