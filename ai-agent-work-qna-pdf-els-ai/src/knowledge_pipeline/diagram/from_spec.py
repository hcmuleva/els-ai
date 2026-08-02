"""Build a validated DiagramSpec from a small, controlled dict vocabulary.

Shared by the RAG quiz generator and the assessment generator so that
LLM-provided figures are always rendered deterministically (never arbitrary,
possibly-broken SVG). Every returned spec is pre-rendered once to guarantee it
produces valid SVG; anything that fails to build or render returns None.
"""
from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple

from . import builders as B
from .builders import _window
from .dsl import (
    AngleMark,
    Arrow,
    Axes,
    Circle,
    DiagramSpec,
    Dimension,
    FunctionPlot,
    FunctionRegion,
    Grid,
    Label,
    Line,
    ParallelMark,
    Point,
    Polygon,
    RightAngleMark,
    Segment,
    TickMark,
)

XY = Tuple[float, float]


def validate_function_expr(expr: str, x0: float, x1: float) -> None:
    """Mirror the SVG renderer's sympy path; raise if the expr is not a real
    single-variable function that yields finite values."""
    import sympy  # type: ignore

    x = sympy.Symbol("x")
    e = sympy.sympify(expr)  # raises SympifyError on junk
    if e.free_symbols - {x}:
        raise ValueError(f"expression has non-x symbols: {expr!r}")
    fn = sympy.lambdify(x, e, "math")
    for i in range(1, 6):
        xv = x0 + (x1 - x0) * i / 6.0
        try:
            v = float(fn(xv))
        except Exception:
            continue
        if math.isfinite(v):
            return
    raise ValueError(f"expression produced no finite samples: {expr!r}")


def _xy(p: Any) -> XY:
    if isinstance(p, dict):
        return (float(p.get("x", 0)), float(p.get("y", 0)))
    return (float(p[0]), float(p[1]))


def _label_of(p: Any, idx: int) -> Optional[str]:
    if isinstance(p, dict):
        return p.get("label")
    if isinstance(p, (list, tuple)) and len(p) > 2:
        return str(p[2])
    return None


def _build(t: str, spec: Dict[str, Any]) -> Optional[DiagramSpec]:
    if t == "triangle":
        v = spec.get("vertices") or [[0, 0], [4, 0], [1, 3]]
        pts = [_xy(p) for p in v[:3]]
        if len(pts) < 3:
            return None
        labels = tuple((spec.get("vertex_labels") or ["A", "B", "C"])[:3])
        if len(labels) < 3:
            labels = ("A", "B", "C")
        return B.triangle_diagram(
            pts[0], pts[1], pts[2],
            vertex_labels=labels,  # type: ignore[arg-type]
            side_labels=tuple(spec["side_labels"]) if spec.get("side_labels") else None,  # type: ignore[arg-type]
            mark_angle_at=spec.get("mark_angle_at"),
            angle_label=spec.get("angle_label"),
            right_angle_at=spec.get("right_angle_at"),
            equal_sides=tuple(int(value) for value in (spec.get("equal_sides") or [])),
        )
    if t in ("right-triangle", "right_triangle"):
        side_labels = spec.get("side_labels")
        return B.right_triangle_diagram(
            leg_a=float(spec.get("leg_a", 3)),
            leg_b=float(spec.get("leg_b", 4)),
            orientation=str(spec.get("orientation", "bottom-left")),
            side_labels=tuple(side_labels) if side_labels else None,  # type: ignore[arg-type]
            angle_at=spec.get("angle_at"),
            angle_label=spec.get("angle_label"),
            title=spec.get("title"),
        )
    if t == "circle":
        marked = [(float(d), str(lbl)) for d, lbl in (spec.get("marked") or [])]
        chords = [(float(a), float(b)) for a, b in (spec.get("chords") or [])]
        return B.circle_diagram(radius=float(spec.get("radius", 3)), marked=marked, chords=chords)
    if t == "angle":
        deg = float(spec.get("degrees", 60))
        rad = math.radians(deg)
        diagram = B.angle_diagram(
            ray2=(3 * math.cos(rad), 3 * math.sin(rad)),
            label=str(spec.get("label") or f"{deg:g}"),
        )
        angle = next(
            element for element in diagram.elements if isinstance(element, AngleMark)
        )
        angle.sweep = str(spec.get("sweep", "minor"))  # type: ignore[assignment]
        return diagram
    if t in ("function", "function-plot", "plot", "graph", "graphs"):
        expr = str(spec["expr"])
        xmin, xmax = float(spec.get("xmin", -5)), float(spec.get("xmax", 5))
        validate_function_expr(expr, xmin, xmax)
        pts = [(_xy(p)[0], _xy(p)[1], _label_of(p, i)) for i, p in enumerate(spec.get("points") or [])]
        return B.function_plot(
            expr,
            xmin=xmin, xmax=xmax,
            ymin=float(spec.get("ymin", -5)), ymax=float(spec.get("ymax", 5)),
            points=pts,
            label=spec.get("label"),
            title=spec.get("title"),
            x_label=str(spec.get("x_label") or "x"),
            y_label=str(spec.get("y_label") or "y"),
        )
    if t in ("function-region", "area-between-curves"):
        upper = str(spec["upper_expr"])
        lower = str(spec["lower_expr"])
        xmin, xmax = float(spec.get("xmin", -5)), float(spec.get("xmax", 5))
        validate_function_expr(upper, xmin, xmax)
        validate_function_expr(lower, xmin, xmax)
        diagram = DiagramSpec(
            kind="function-region",
            xmin=xmin,
            xmax=xmax,
            ymin=float(spec.get("ymin", -5)),
            ymax=float(spec.get("ymax", 5)),
            title=spec.get("title"),
            elements=[
                Grid(),
                Axes(),
                FunctionRegion(
                    upper_expr=upper,
                    lower_expr=lower,
                    domain=(xmin, xmax),
                ),
                FunctionPlot(
                    expr=upper,
                    domain=(xmin, xmax),
                    label=spec.get("upper_label"),
                    color="#2563eb",
                ),
                FunctionPlot(
                    expr=lower,
                    domain=(xmin, xmax),
                    label=spec.get("lower_label"),
                    color="#dc2626",
                ),
            ],
        )
        return diagram
    if t in ("coordinate", "coordinate-geometry"):
        pts = [(_xy(p)[0], _xy(p)[1], _label_of(p, i)) for i, p in enumerate(spec.get("points") or [])]
        segs = [(_xy(s[0]), _xy(s[1]), (s[2] if len(s) > 2 else None)) for s in (spec.get("segments") or [])]
        return B.coordinate_diagram(pts, segments=segs)
    if t in ("mensuration", "rectangle"):
        return B.mensuration_rectangle(
            float(spec.get("width", 5)), float(spec.get("height", 3)),
            str(spec.get("width_label", "")), str(spec.get("height_label", "")),
        )
    if t == "lpp":
        cons = [(float(a), float(b), float(c), str(op)) for a, b, c, op in (spec.get("constraints") or [])]
        verts = [_xy(p) for p in (spec.get("vertices") or [])]
        opt = spec.get("optimum")
        optimum = (float(opt[0]), float(opt[1]), str(opt[2])) if opt else None
        return B.lpp_region(cons, verts, optimum=optimum)
    if t in ("bar-chart", "bar_chart", "barchart"):
        return B.bar_chart(
            [str(value) for value in (spec.get("categories") or [])],
            [float(value) for value in (spec.get("values") or [])],
            colors=[str(value) for value in (spec.get("colors") or [])],
            max_value=(
                float(spec["max_value"]) if spec.get("max_value") is not None else None
            ),
            tick_step=(
                float(spec["tick_step"]) if spec.get("tick_step") is not None else None
            ),
            x_label=str(spec.get("x_label") or ""),
            y_label=str(spec.get("y_label") or ""),
            show_values=bool(spec.get("show_values", False)),
            title=spec.get("title"),
        )
    if t in ("pie-chart", "pie_chart", "piechart"):
        return B.pie_chart(
            [str(value) for value in (spec.get("categories") or [])],
            [float(value) for value in (spec.get("values") or [])],
            colors=[str(value) for value in (spec.get("colors") or [])],
            label_mode=str(spec.get("label_mode", "value")),
            total_label=spec.get("total_label"),
            show_legend=bool(spec.get("show_legend", True)),
            title=spec.get("title"),
        )
    if t in ("pictogram", "pictograph"):
        rows = [
            (
                str(row.get("label") or ""),
                float(row.get("value", 0)),
                str(row.get("color") or "#7c3aed"),
            )
            for row in (spec.get("rows") or [])
            if isinstance(row, dict)
        ]
        return B.pictogram(
            rows,
            unit=float(spec.get("unit", 1)),
            key_label=spec.get("key_label"),
            max_icons_per_row=int(spec.get("max_icons_per_row", 12)),
            title=spec.get("title"),
        )
    if t in ("inclined-plane", "free-body", "free-body-diagram"):
        return B.inclined_plane_free_body(
            angle_degrees=float(spec.get("angle_degrees", 30)),
            friction_up_slope=bool(spec.get("friction_up_slope", True)),
            title=spec.get("title"),
        )
    if t in ("projectile", "projectile-motion"):
        return B.projectile_motion(
            speed=float(spec.get("speed", 20)),
            angle_degrees=float(spec.get("angle_degrees", 45)),
            gravity=float(spec.get("gravity", 9.8)),
            title=spec.get("title"),
        )
    if t in ("convex-lens", "ray-optics", "lens"):
        return B.convex_lens_ray_diagram(
            focal_length=float(spec.get("focal_length", 2)),
            object_distance=float(spec.get("object_distance", 6)),
            object_height=float(spec.get("object_height", 2)),
            title=spec.get("title"),
        )
    if t in ("magnetic-flux", "magnetic-flux-loop", "loop-field-angle"):
        return B.magnetic_flux_loop(
            area_label=str(spec.get("area_label") or "A"),
            field_label=str(spec.get("field_label") or "B"),
            normal_label=str(spec.get("normal_label") or "n"),
            angle_degrees=float(spec.get("angle_degrees", 60)),
            angle_label=spec.get("angle_label"),
            title=spec.get("title"),
        )
    if t in ("lr-circuit", "rl-circuit"):
        return B.lr_circuit(
            voltage_label=str(spec.get("voltage_label") or "V"),
            resistance_label=str(spec.get("resistance_label") or "R"),
            inductance_label=str(spec.get("inductance_label") or "L"),
            current_label=str(spec.get("current_label") or "I"),
            title=spec.get("title"),
        )
    if t in ("current-time", "lr-current-growth", "current-growth-graph"):
        percentage = spec.get("percentage")
        return B.current_time_graph(
            final_current_label=str(spec.get("final_current_label") or "I∞"),
            percentage=float(percentage) if percentage is not None else None,
            title=spec.get("title"),
        )
    if t in ("transformer", "transformer-circuit"):
        resistance_label = spec.get("resistance_label")
        inductance_label = spec.get("inductance_label")
        show_load = bool(
            spec.get("show_load")
            or resistance_label
            or inductance_label
        )
        return B.transformer_circuit(
            np_label=str(spec.get("np_label") or "Np"),
            ns_label=str(spec.get("ns_label") or "Ns"),
            primary_voltage_label=str(
                spec.get("primary_voltage_label") or "Vp"
            ),
            secondary_voltage_label=str(
                spec.get("secondary_voltage_label") or "Vs"
            ),
            resistance_label=(
                str(resistance_label) if resistance_label is not None else None
            ),
            inductance_label=(
                str(inductance_label) if inductance_label is not None else None
            ),
            show_load=show_load,
            title=spec.get("title"),
        )
    if t in ("coupled-coils", "mutual-induction"):
        return B.coupled_coils(
            l1_label=str(spec.get("l1_label") or "L1"),
            l2_label=str(spec.get("l2_label") or "L2"),
            coupling_label=str(spec.get("coupling_label") or "k"),
            current_label=str(spec.get("current_label") or "i1"),
            emf_label=str(spec.get("emf_label") or "ε2"),
            mutual_label=(
                str(spec["mutual_label"]) if spec.get("mutual_label") else None
            ),
            flux_label=(
                str(spec["flux_label"]) if spec.get("flux_label") else None
            ),
            dot_convention=bool(spec.get("dot_convention", False)),
            title=spec.get("title"),
        )
    if t in ("refraction", "ray-diagram"):
        return B.refraction_diagram(
            incident_angle=float(spec.get("incident_angle", 45)),
            refracted_angle=float(spec.get("refracted_angle", 28)),
            title=spec.get("title"),
        )
    if t in ("chemical-reaction", "chemical-equation"):
        return B.chemical_reaction_diagram(
            reactants=str(spec.get("reactants") or ""),
            products=str(spec.get("products") or ""),
            condition=str(spec.get("condition") or ""),
            title=spec.get("title"),
        )
    if t in ("polygon", "polygons"):
        verts = [_xy(p) for p in (spec.get("vertices") or [])]
        if len(verts) < 3:
            return None
        return _geometry({"polygons": [{"vertices": verts, "labels": spec.get("vertex_labels")}],
                          "points": spec.get("points") or []})
    if t in (
        "geometry",
        "triangle-geometry",
        "circle-geometry",
        "solid-geometry",
        "figure",
        "parallel_lines",
        "parallel-lines",
        "polygon_figure",
    ):
        return _geometry(spec)
    return None


def _geometry(spec: Dict[str, Any]) -> Optional[DiagramSpec]:
    """General geometry: points, segments, angles, circles, lines, polygons."""
    pts = spec.get("points") or []
    segs = spec.get("segments") or []
    angles = spec.get("angles") or []
    circles = spec.get("circles") or []
    lines = spec.get("lines") or []
    polys = spec.get("polygons") or []
    right_angles = spec.get("right_angles") or []
    tick_marks = spec.get("tick_marks") or []
    parallel_marks = spec.get("parallel_marks") or []
    arrows = spec.get("arrows") or []
    free_labels = spec.get("labels") or []
    dimensions = spec.get("dimensions") or []

    coords: List[XY] = []
    for p in pts:
        coords.append(_xy(p))
    for s in segs:
        coords.extend([_xy(s.get("a") if isinstance(s, dict) else s[0]),
                       _xy(s.get("b") if isinstance(s, dict) else s[1])])
    for a in angles:
        coords.extend([_xy(a["vertex"]), _xy(a["p1"]), _xy(a["p2"])])
    for cir in circles:
        cx, cy = _xy(cir["center"])
        r = float(cir.get("radius", 1))
        coords.extend([(cx - r, cy - r), (cx + r, cy + r)])
    for poly in polys:
        coords.extend(_xy(v) for v in (poly.get("vertices") or []))
    for relation in [*right_angles, *tick_marks, *parallel_marks]:
        for key in ("vertex", "p1", "p2", "a", "b"):
            if key in relation:
                coords.append(_xy(relation[key]))
    for arrow in arrows:
        coords.extend([_xy(arrow["start"]), _xy(arrow["end"])])
    for label in free_labels:
        coords.append(_xy(label["at"]))
    for dimension in dimensions:
        coords.extend([_xy(dimension["a"]), _xy(dimension["b"])])
    if not coords:
        return None

    xmin, xmax, ymin, ymax = _window(coords, pad=1.2)
    show_axes = bool(spec.get("axes", False))
    dspec = DiagramSpec(
        kind=str(spec.get("type") or "geometry"),
        xmin=xmin,
        xmax=xmax,
        ymin=ymin,
        ymax=ymax,
        equal_scale=True,
        title=spec.get("title"),
    )
    if show_axes:
        dspec.elements.append(Grid())
        dspec.elements.append(Axes())
    for poly in polys:
        verts = [_xy(v) for v in (poly.get("vertices") or [])]
        if len(verts) >= 2:
            dspec.elements.append(
                Polygon(
                    points=verts,
                    role=poly.get("role"),
                    label=poly.get("label"),
                    fill=str(poly.get("fill") or "none"),
                    fill_opacity=float(poly.get("fill_opacity", 0.25)),
                    stroke=str(poly.get("stroke") or "#333333"),
                    closed=bool(poly.get("closed", True)),
                )
            )
            vertex_labels = poly.get("labels") or []
            for v, lbl in zip(verts, vertex_labels):
                dspec.elements.append(Label(at=v, text=str(lbl), dx=6, dy=-6))
    for a, b, c, *rest in [(l[0], l[1], l[2], *(l[3:])) for l in lines]:
        dspec.elements.append(Line(a=float(a), b=float(b), c=float(c), label=(str(rest[0]) if rest else None)))
    for s in segs:
        a = _xy(s.get("a") if isinstance(s, dict) else s[0])
        b = _xy(s.get("b") if isinstance(s, dict) else s[1])
        lbl = s.get("label") if isinstance(s, dict) else (s[2] if len(s) > 2 else None)
        dspec.elements.append(
            Segment(
                a=a,
                b=b,
                label=(str(lbl) if lbl else None),
                role=s.get("role") if isinstance(s, dict) else None,
                dashed=bool(s.get("dashed", False)) if isinstance(s, dict) else False,
                color=str(s.get("color") or "#333333") if isinstance(s, dict) else "#333333",
            )
        )
    for cir in circles:
        dspec.elements.append(
            Circle(
                center=_xy(cir["center"]),
                radius=float(cir.get("radius", 1)),
                role=cir.get("role"),
                label=cir.get("label"),
                fill=str(cir.get("fill") or "none"),
                stroke=str(cir.get("stroke") or "#333333"),
            )
        )
    for a in angles:
        dspec.elements.append(AngleMark(
            vertex=_xy(a["vertex"]),
            p1=_xy(a["p1"]),
            p2=_xy(a["p2"]),
            label=(str(a["label"]) if a.get("label") is not None else None),
            role=a.get("role"),
            radius_px=float(a.get("radius_px", 22)),
            color=str(a.get("color") or "#9467bd"),
            sweep=str(a.get("sweep", "minor")),  # type: ignore[arg-type]
        ))
    for mark in right_angles:
        dspec.elements.append(
            RightAngleMark(
                vertex=_xy(mark["vertex"]),
                p1=_xy(mark["p1"]),
                p2=_xy(mark["p2"]),
                size_px=float(mark.get("size_px", 14)),
                color=str(mark.get("color") or "#7c3aed"),
            )
        )
    for mark in tick_marks:
        dspec.elements.append(
            TickMark(
                a=_xy(mark["a"]),
                b=_xy(mark["b"]),
                count=int(mark.get("count", 1)),
                size_px=float(mark.get("size_px", 8)),
                color=str(mark.get("color") or "#7c3aed"),
            )
        )
    for mark in parallel_marks:
        dspec.elements.append(
            ParallelMark(
                a=_xy(mark["a"]),
                b=_xy(mark["b"]),
                count=int(mark.get("count", 1)),
                size_px=float(mark.get("size_px", 9)),
                color=str(mark.get("color") or "#7c3aed"),
            )
        )
    for i, p in enumerate(pts):
        dspec.elements.append(
            Point(
                at=_xy(p),
                label=_label_of(p, i),
                role=p.get("role") if isinstance(p, dict) else None,
                color=str(p.get("color") or "#d62728") if isinstance(p, dict) else "#d62728",
            )
        )
    for arrow in arrows:
        dspec.elements.append(
            Arrow(
                start=_xy(arrow["start"]),
                end=_xy(arrow["end"]),
                role=arrow.get("role"),
                label=arrow.get("label"),
                dashed=bool(arrow.get("dashed", False)),
                color=str(arrow.get("color") or "#1d4ed8"),
            )
        )
    for label in free_labels:
        dspec.elements.append(
            Label(
                at=_xy(label["at"]),
                role=label.get("role"),
                text=str(label.get("text") or ""),
                color=str(label.get("color") or "#111111"),
                dx=float(label.get("dx", 0)),
                dy=float(label.get("dy", 0)),
            )
        )
    for dimension in dimensions:
        dspec.elements.append(
            Dimension(
                a=_xy(dimension["a"]),
                b=_xy(dimension["b"]),
                label=str(dimension.get("label") or ""),
                color=str(dimension.get("color") or "#555555"),
                offset_px=float(dimension.get("offset_px", 0)),
            )
        )
    return dspec


def build_diagram_from_spec(spec: Any) -> Optional[DiagramSpec]:
    """Return a validated (renderable) DiagramSpec, or None if the spec is
    empty/unsupported/unrenderable."""
    from ..rendering.svg import render_svg
    from .validation import validate_spec_semantics, validate_svg_layout

    if not isinstance(spec, dict):
        return None
    t = str(spec.get("type", "")).strip().lower()
    if t in ("", "none", "null"):
        return None
    try:
        built = _build(t, spec)
    except Exception:
        return None
    if built is None:
        return None
    try:
        svg = render_svg(built)
        semantic_ok, _ = validate_spec_semantics(built)
        layout_ok, _ = validate_svg_layout(svg)
        if not semantic_ok or not layout_ok:
            return None
    except Exception:
        return None
    return built
