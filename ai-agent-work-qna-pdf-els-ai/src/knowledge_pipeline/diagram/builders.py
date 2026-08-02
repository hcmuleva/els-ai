"""Deterministic builders for the supported diagram families.

Each returns a DiagramSpec ready for `rendering.svg.render_svg`. These keep the
question generator free of low-level layout concerns.
"""
from __future__ import annotations

from typing import List, Optional, Sequence, Tuple

from .dsl import (
    AngleMark,
    Arrow,
    Axes,
    BarChart,
    Circle,
    Dimension,
    DiagramSpec,
    FunctionPlot,
    Grid,
    Label,
    Line,
    ParallelMark,
    PictogramChart,
    PictogramRow,
    PieChart,
    Point,
    Polygon,
    RightAngleMark,
    Segment,
    TickMark,
)

XY = Tuple[float, float]


def _window(points: Sequence[XY], pad: float = 1.0) -> Tuple[float, float, float, float]:
    xs = [p[0] for p in points] or [-1.0, 1.0]
    ys = [p[1] for p in points] or [-1.0, 1.0]
    xmin, xmax = min(xs) - pad, max(xs) + pad
    ymin, ymax = min(ys) - pad, max(ys) + pad
    if xmax - xmin < 1e-6:
        xmin, xmax = xmin - 1, xmax + 1
    if ymax - ymin < 1e-6:
        ymin, ymax = ymin - 1, ymax + 1
    return xmin, xmax, ymin, ymax


def function_plot(
    expr: str,
    xmin: float = -5,
    xmax: float = 5,
    ymin: float = -5,
    ymax: float = 5,
    label: Optional[str] = None,
    points: Sequence[Tuple[float, float, Optional[str]]] = (),
    title: Optional[str] = None,
    x_label: str = "x",
    y_label: str = "y",
) -> DiagramSpec:
    spec = DiagramSpec(kind="function-plot", xmin=xmin, xmax=xmax, ymin=ymin, ymax=ymax, title=title)
    spec.elements.append(Grid())
    spec.elements.append(Axes(x_label=x_label, y_label=y_label))
    spec.elements.append(FunctionPlot(expr=expr, domain=(xmin, xmax), label=label))
    for x, y, lbl in points:
        spec.elements.append(Point(at=(x, y), label=lbl))
    return spec


def lpp_region(
    constraints: Sequence[Tuple[float, float, float, str]],
    feasible_vertices: Sequence[XY],
    xmax: float = 10,
    ymax: float = 10,
    optimum: Optional[Tuple[float, float, str]] = None,
    title: Optional[str] = None,
) -> DiagramSpec:
    """constraints: (a, b, c, op) for a*x+b*y (op) c. feasible_vertices define the region."""
    spec = DiagramSpec(kind="lpp", xmin=0, xmax=xmax, ymin=0, ymax=ymax, equal_scale=True, title=title)
    spec.elements.append(Grid())
    spec.elements.append(Axes())
    if feasible_vertices:
        spec.elements.append(
            Polygon(points=list(feasible_vertices), fill="#2ca02c", label="Feasible")
        )
    for a, b, c, op in constraints:
        spec.elements.append(Line(a=a, b=b, c=c, label=f"{_fmt(a)}x+{_fmt(b)}y {op} {_fmt(c)}"))
    if optimum:
        ox, oy, olabel = optimum
        spec.elements.append(Point(at=(ox, oy), label=olabel))
    return spec


def coordinate_diagram(
    points: Sequence[Tuple[float, float, Optional[str]]],
    segments: Sequence[Tuple[XY, XY, Optional[str]]] = (),
    title: Optional[str] = None,
) -> DiagramSpec:
    pts = [(x, y) for x, y, _ in points]
    for a, b, _ in segments:
        pts.extend([a, b])
    xmin, xmax, ymin, ymax = _window(pts, pad=1.5)
    spec = DiagramSpec(kind="coordinate", xmin=xmin, xmax=xmax, ymin=ymin, ymax=ymax, equal_scale=True, title=title)
    spec.elements.append(Grid())
    spec.elements.append(Axes())
    for a, b, lbl in segments:
        spec.elements.append(Segment(a=a, b=b, label=lbl))
    for x, y, lbl in points:
        spec.elements.append(Point(at=(x, y), label=lbl))
    return spec


def circle_diagram(
    radius: float = 3.0,
    center: XY = (0.0, 0.0),
    marked: Sequence[Tuple[float, str]] = (),
    chords: Sequence[Tuple[float, float]] = (),
    title: Optional[str] = None,
) -> DiagramSpec:
    """marked: (angle_deg, label) points on the circle. chords: pairs of angles (deg)."""
    import math

    r = radius
    xmin, xmax = center[0] - r - 1, center[0] + r + 1
    ymin, ymax = center[1] - r - 1, center[1] + r + 1
    spec = DiagramSpec(kind="circle", xmin=xmin, xmax=xmax, ymin=ymin, ymax=ymax, equal_scale=True, title=title)
    spec.elements.append(Circle(center=center, radius=r, label="O"))

    def on_circle(deg: float) -> XY:
        t = math.radians(deg)
        return (center[0] + r * math.cos(t), center[1] + r * math.sin(t))

    for deg, lbl in marked:
        spec.elements.append(Point(at=on_circle(deg), label=lbl))
    for d1, d2 in chords:
        spec.elements.append(Segment(a=on_circle(d1), b=on_circle(d2)))
    return spec


def triangle_diagram(
    a: XY,
    b: XY,
    c: XY,
    vertex_labels: Tuple[str, str, str] = ("A", "B", "C"),
    side_labels: Optional[Tuple[str, str, str]] = None,
    mark_angle_at: Optional[int] = None,
    angle_label: Optional[str] = None,
    title: Optional[str] = None,
    right_angle_at: Optional[int] = None,
    equal_sides: Sequence[int] = (),
) -> DiagramSpec:
    xmin, xmax, ymin, ymax = _window([a, b, c], pad=1.5)
    spec = DiagramSpec(kind="triangle", xmin=xmin, xmax=xmax, ymin=ymin, ymax=ymax, equal_scale=True, title=title)
    spec.elements.append(Polygon(points=[a, b, c], stroke="#333333"))
    verts = [a, b, c]
    for pt, lbl in zip(verts, vertex_labels):
        if lbl:
            spec.elements.append(Label(at=pt, text=lbl, dx=6, dy=-6))
    if side_labels:
        pairs = [((a, b), side_labels[0]), ((b, c), side_labels[1]), ((c, a), side_labels[2])]
        for (p, q), lbl in pairs:
            spec.elements.append(
                Segment(a=p, b=q, label=lbl, color="#333333")
            )
    if mark_angle_at is not None:
        v = verts[mark_angle_at]
        others = [verts[i] for i in range(3) if i != mark_angle_at]
        spec.elements.append(
            AngleMark(vertex=v, p1=others[0], p2=others[1], label=angle_label)
        )
    if right_angle_at is not None:
        v = verts[right_angle_at]
        others = [verts[i] for i in range(3) if i != right_angle_at]
        spec.elements.append(RightAngleMark(vertex=v, p1=others[0], p2=others[1]))
    pairs = [(a, b), (b, c), (c, a)]
    for side_index in equal_sides:
        if 0 <= side_index < len(pairs):
            spec.elements.append(TickMark(a=pairs[side_index][0], b=pairs[side_index][1]))
    return spec


def right_triangle_diagram(
    leg_a: float,
    leg_b: float,
    orientation: str = "bottom-left",
    side_labels: Optional[Tuple[str, str, str]] = None,
    angle_at: Optional[int] = None,
    angle_label: Optional[str] = None,
    title: Optional[str] = None,
) -> DiagramSpec:
    """Build a proportional right triangle in one of four corner orientations."""
    if leg_a <= 0 or leg_b <= 0:
        raise ValueError("right-triangle legs must be positive")
    orientations = {
        "bottom-left": ((0.0, 0.0), (leg_a, 0.0), (0.0, leg_b)),
        "bottom-right": ((leg_a, 0.0), (0.0, 0.0), (leg_a, leg_b)),
        "top-left": ((0.0, leg_b), (leg_a, leg_b), (0.0, 0.0)),
        "top-right": ((leg_a, leg_b), (0.0, leg_b), (leg_a, 0.0)),
    }
    if orientation not in orientations:
        raise ValueError(f"unsupported right-triangle orientation: {orientation}")
    right_vertex, second, third = orientations[orientation]
    spec = triangle_diagram(
        right_vertex,
        second,
        third,
        vertex_labels=("", "", ""),
        side_labels=side_labels,
        mark_angle_at=angle_at,
        angle_label=angle_label,
        right_angle_at=0,
        title=title,
    )
    spec.kind = "right-triangle"
    return spec


def angle_diagram(
    vertex: XY = (0.0, 0.0),
    ray1: XY = (3.0, 0.0),
    ray2: XY = (2.0, 2.0),
    label: Optional[str] = None,
    title: Optional[str] = None,
) -> DiagramSpec:
    xmin, xmax, ymin, ymax = _window([vertex, ray1, ray2], pad=1.0)
    spec = DiagramSpec(kind="angle", xmin=xmin, xmax=xmax, ymin=ymin, ymax=ymax, equal_scale=True, title=title)
    spec.elements.append(Segment(a=vertex, b=ray1, color="#333333"))
    spec.elements.append(Segment(a=vertex, b=ray2, color="#333333"))
    spec.elements.append(AngleMark(vertex=vertex, p1=ray1, p2=ray2, label=label))
    return spec


def mensuration_rectangle(
    width: float, height: float, width_label: str, height_label: str, title: Optional[str] = None
) -> DiagramSpec:
    xmin, xmax = -1.0, width + 1.5
    ymin, ymax = -1.5, height + 1.0
    spec = DiagramSpec(kind="mensuration", xmin=xmin, xmax=xmax, ymin=ymin, ymax=ymax, equal_scale=True, title=title)
    corners = [(0.0, 0.0), (width, 0.0), (width, height), (0.0, height)]
    spec.elements.append(Polygon(points=corners, stroke="#333333"))
    spec.elements.append(Dimension(a=(0.0, 0.0), b=(width, 0.0), label=width_label, offset_px=-16))
    spec.elements.append(Dimension(a=(width, 0.0), b=(width, height), label=height_label, offset_px=16))
    return spec


def bar_chart(
    categories: Sequence[str],
    values: Sequence[float],
    *,
    colors: Sequence[str] = (),
    max_value: Optional[float] = None,
    tick_step: Optional[float] = None,
    x_label: str = "",
    y_label: str = "",
    show_values: bool = False,
    title: Optional[str] = None,
) -> DiagramSpec:
    return DiagramSpec(
        kind="bar-chart",
        width=480,
        height=330,
        title=title,
        elements=[
            BarChart(
                categories=list(categories),
                values=list(values),
                colors=list(colors),
                max_value=max_value,
                tick_step=tick_step,
                x_label=x_label,
                y_label=y_label,
                show_values=show_values,
            )
        ],
    )


def pie_chart(
    categories: Sequence[str],
    values: Sequence[float],
    *,
    colors: Sequence[str] = (),
    label_mode: str = "value",
    total_label: Optional[str] = None,
    show_legend: bool = True,
    title: Optional[str] = None,
) -> DiagramSpec:
    return DiagramSpec(
        kind="pie-chart",
        width=460,
        height=330,
        title=title,
        elements=[
            PieChart(
                categories=list(categories),
                values=list(values),
                colors=list(colors),
                label_mode=label_mode,  # type: ignore[arg-type]
                total_label=total_label,
                show_legend=show_legend,
            )
        ],
    )


def pictogram(
    rows: Sequence[Tuple[str, float, str]],
    *,
    unit: float,
    key_label: Optional[str] = None,
    max_icons_per_row: int = 12,
    title: Optional[str] = None,
) -> DiagramSpec:
    return DiagramSpec(
        kind="pictogram",
        width=500,
        height=max(240, 92 + len(rows) * 48),
        title=title,
        elements=[
            PictogramChart(
                rows=[
                    PictogramRow(label=label, value=value, color=color)
                    for label, value, color in rows
                ],
                unit=unit,
                key_label=key_label,
                max_icons_per_row=max_icons_per_row,
            )
        ],
    )


def inclined_plane_free_body(
    angle_degrees: float = 30.0,
    friction_up_slope: bool = True,
    title: Optional[str] = None,
) -> DiagramSpec:
    import math

    theta = math.radians(angle_degrees)
    tangent = (math.cos(theta), math.sin(theta))
    normal = (-math.sin(theta), math.cos(theta))
    origin = (0.0, 0.0)
    end = (6.0 * tangent[0], 6.0 * tangent[1])
    center = (
        3.15 * tangent[0] + 0.5 * normal[0],
        3.15 * tangent[1] + 0.5 * normal[1],
    )

    def offset(point: XY, along: float, outward: float) -> XY:
        return (
            point[0] + along * tangent[0] + outward * normal[0],
            point[1] + along * tangent[1] + outward * normal[1],
        )

    block = [
        offset(center, -0.75, -0.45),
        offset(center, 0.75, -0.45),
        offset(center, 0.75, 0.45),
        offset(center, -0.75, 0.45),
    ]
    gravity_end = (center[0], center[1] - 2.25)
    normal_end = (
        center[0] + 1.8 * normal[0],
        center[1] + 1.8 * normal[1],
    )
    friction_sign = 1.0 if friction_up_slope else -1.0
    friction_end = (
        center[0] + friction_sign * 1.8 * tangent[0],
        center[1] + friction_sign * 1.8 * tangent[1],
    )
    points = [origin, end, (end[0], 0.0), *block, gravity_end, normal_end, friction_end]
    xmin, xmax, ymin, ymax = _window(points, pad=0.8)
    spec = DiagramSpec(
        kind="physics-free-body",
        width=440,
        height=320,
        xmin=xmin,
        xmax=xmax,
        ymin=ymin,
        ymax=ymax,
        equal_scale=True,
        title=title or f"Block on a {angle_degrees:g}° Incline",
    )
    spec.elements.extend(
        [
            Polygon(
                points=[origin, end, (end[0], 0.0)],
                role="inclined_plane",
                fill="#dbe4ee",
                fill_opacity=0.65,
                stroke="#64748b",
            ),
            Segment(a=origin, b=end, color="#334155"),
            Segment(a=origin, b=(2.0, 0.0), color="#64748b"),
            AngleMark(
                vertex=origin,
                p1=(2.0, 0.0),
                p2=(2.0 * tangent[0], 2.0 * tangent[1]),
                label=f"{angle_degrees:g}°",
                role="angle_marker",
            ),
            Polygon(
                points=block,
                role="block",
                fill="#dbeafe",
                fill_opacity=1.0,
                stroke="#1e3a8a",
            ),
            Label(at=center, text="m", dx=-4, dy=4),
            Arrow(
                start=center,
                end=gravity_end,
                label="mg",
                role="gravity_vector",
                color="#dc2626",
            ),
            Arrow(
                start=center,
                end=normal_end,
                label="N",
                role="normal_force_vector",
                color="#2563eb",
            ),
            Arrow(
                start=center,
                end=friction_end,
                label="f",
                role="friction_vector",
                color="#d97706",
            ),
            Point(at=center, color="#111827"),
        ]
    )
    return spec


def projectile_motion(
    speed: float = 20.0,
    angle_degrees: float = 45.0,
    gravity: float = 9.8,
    title: Optional[str] = None,
) -> DiagramSpec:
    import math

    theta = math.radians(angle_degrees)
    horizontal_range = speed**2 * math.sin(2 * theta) / gravity
    peak = speed**2 * math.sin(theta) ** 2 / (2 * gravity)
    xmax = horizontal_range * 1.12
    ymax = peak * 1.35
    expression = (
        f"x*{math.tan(theta):.10g}-"
        f"{gravity:.10g}*x**2/(2*{speed:.10g}**2*{math.cos(theta):.10g}**2)"
    )
    arrow_scale = horizontal_range * 0.17
    velocity_end = (
        arrow_scale * math.cos(theta),
        arrow_scale * math.sin(theta),
    )
    spec = DiagramSpec(
        kind="physics-projectile",
        width=440,
        height=320,
        xmin=0,
        xmax=xmax,
        ymin=0,
        ymax=ymax,
        title=title or "Projectile Motion",
    )
    spec.elements.extend(
        [
            Grid(step_x=max(1.0, round(horizontal_range / 8)), step_y=max(1.0, round(peak / 5))),
            Axes(tick_step=max(1.0, round(horizontal_range / 8)), x_label="x", y_label="y"),
            FunctionPlot(
                expr=expression,
                domain=(0.0, horizontal_range),
                label="trajectory",
                color="#7c3aed",
            ),
            Arrow(start=(0.0, 0.0), end=velocity_end, label="u", color="#2563eb"),
            AngleMark(
                vertex=(0.0, 0.0),
                p1=(arrow_scale, 0.0),
                p2=velocity_end,
                label=f"{angle_degrees:g}°",
            ),
            Point(at=(0.0, 0.0), label="launch"),
            Point(at=(horizontal_range, 0.0), label="range"),
            Label(
                at=(horizontal_range / 2, peak),
                text=f"H={peak:.1f}",
                dx=8,
                dy=-8,
                color="#6d28d9",
            ),
        ]
    )
    return spec


def convex_lens_ray_diagram(
    focal_length: float = 2.0,
    object_distance: float = 6.0,
    object_height: float = 2.0,
    title: Optional[str] = None,
) -> DiagramSpec:
    if object_distance <= focal_length:
        raise ValueError("object_distance must be greater than focal_length")
    image_distance = focal_length * object_distance / (object_distance - focal_length)
    image_height = -(image_distance / object_distance) * object_height
    object_x, image_x = -object_distance, image_distance
    xmin, xmax = object_x - 1.0, image_x + 1.5
    ymin = min(image_height - 1.0, -2.0)
    ymax = max(object_height + 1.0, 2.0)
    lens_top, lens_bottom = (0.0, ymax - 0.35), (0.0, ymin + 0.35)
    object_top = (object_x, object_height)
    image_tip = (image_x, image_height)
    spec = DiagramSpec(
        kind="physics-ray-optics",
        width=460,
        height=310,
        xmin=xmin,
        xmax=xmax,
        ymin=ymin,
        ymax=ymax,
        equal_scale=True,
        title=title or "Convex Lens Ray Diagram",
    )
    spec.elements.extend(
        [
            Segment(a=(xmin, 0.0), b=(xmax, 0.0), color="#64748b"),
            Segment(a=lens_bottom, b=lens_top, color="#0891b2"),
            Arrow(
                start=(object_x, 0.0),
                end=object_top,
                label="object",
                color="#2563eb",
            ),
            Arrow(
                start=(image_x, 0.0),
                end=image_tip,
                label="image",
                color="#dc2626",
            ),
            Segment(a=object_top, b=(0.0, object_height), color="#d97706"),
            Segment(a=(0.0, object_height), b=image_tip, color="#d97706"),
            Segment(a=object_top, b=image_tip, color="#7c3aed"),
            Point(at=(-focal_length, 0.0), label="F₁", color="#0f766e"),
            Point(at=(focal_length, 0.0), label="F₂", color="#0f766e"),
            Point(at=(0.0, 0.0), label="O", color="#0891b2"),
            Label(at=(0.0, ymax - 0.65), text="convex lens", dx=8, color="#0891b2"),
        ]
    )
    return spec


def magnetic_flux_loop(
    *,
    area_label: str = "A",
    field_label: str = "B",
    normal_label: str = "n",
    angle_degrees: float = 60.0,
    angle_label: Optional[str] = None,
    title: Optional[str] = None,
) -> DiagramSpec:
    import math

    theta = math.radians(angle_degrees)
    center = (0.0, 0.0)
    loop = [(-2.6, -1.0), (1.6, -1.0), (2.6, 1.0), (-1.6, 1.0)]
    normal_end = (0.0, 3.2)
    field_end = (3.2 * math.sin(theta), 3.2 * math.cos(theta))
    spec = DiagramSpec(
        kind="physics-magnetic-flux",
        width=440,
        height=330,
        xmin=-3.5,
        xmax=4.0,
        ymin=-2.0,
        ymax=4.0,
        equal_scale=True,
        title=title or "Magnetic Flux Through a Loop",
    )
    spec.elements.extend(
        [
            Polygon(
                points=loop,
                role="conducting_loop",
                fill="#dbeafe",
                fill_opacity=0.55,
                stroke="#1d4ed8",
            ),
            Label(
                at=(-0.7, -0.1),
                text=area_label,
                role="loop_area",
                color="#1e3a8a",
            ),
            Arrow(
                start=center,
                end=normal_end,
                label=normal_label,
                role="normal_vector",
                color="#059669",
            ),
            Arrow(
                start=center,
                end=field_end,
                label=field_label,
                role="magnetic_field_vector",
                color="#dc2626",
            ),
            AngleMark(
                vertex=center,
                p1=normal_end,
                p2=field_end,
                label=angle_label or f"{angle_degrees:g}°",
                role="angle_marker",
            ),
            Point(at=center, color="#111827"),
        ]
    )
    return spec


def lr_circuit(
    *,
    voltage_label: str = "V",
    resistance_label: str = "R",
    inductance_label: str = "L",
    current_label: str = "I",
    title: Optional[str] = None,
) -> DiagramSpec:
    spec = DiagramSpec(
        kind="physics-lr-circuit",
        width=500,
        height=300,
        xmin=-5.5,
        xmax=5.5,
        ymin=-3.0,
        ymax=3.0,
        equal_scale=True,
        title=title or "Series LR Circuit",
    )
    zigzag = [
        (-2.0, 2.0),
        (-1.6, 2.45),
        (-1.2, 1.55),
        (-0.8, 2.45),
        (-0.4, 1.55),
        (0.0, 2.0),
    ]
    elements = [
        Segment(a=(-4.0, -2.0), b=(4.0, -2.0)),
        Segment(a=(-4.0, -2.0), b=(-4.0, -0.7)),
        Segment(a=(-4.0, 0.7), b=(-4.0, 2.0)),
        Segment(a=(-4.0, 2.0), b=(-2.0, 2.0)),
        Segment(a=(0.0, 2.0), b=(1.3, 2.0)),
        Segment(a=(3.2, 2.0), b=(4.0, 2.0)),
        Segment(a=(4.0, 2.0), b=(4.0, -2.0)),
        Circle(
            center=(-4.0, 0.0),
            radius=0.7,
            label="DC source",
            role="dc_source",
        ),
        Label(at=(-5.25, 0.0), text=f"DC source {voltage_label}"),
        Label(at=(-1.0, 2.75), text=f"resistor {resistance_label}"),
        Label(at=(2.25, 2.75), text=f"inductor {inductance_label}"),
        Arrow(
            start=(-3.2, 2.0),
            end=(-2.4, 2.0),
            label=current_label,
            role="current_arrow",
        ),
    ]
    elements.extend(
        Segment(
            a=zigzag[index],
            b=zigzag[index + 1],
            role="resistor",
            color="#b45309",
        )
        for index in range(len(zigzag) - 1)
    )
    for x in (1.45, 1.85, 2.25, 2.65, 3.05):
        elements.append(
            Circle(
                center=(x, 2.0),
                radius=0.28,
                role="inductor",
                stroke="#7c3aed",
            )
        )
    spec.elements.extend(elements)
    return spec


def current_time_graph(
    *,
    final_current_label: str = "I∞",
    percentage: Optional[float] = None,
    title: Optional[str] = None,
) -> DiagramSpec:
    spec = DiagramSpec(
        kind="physics-current-time",
        width=460,
        height=320,
        xmin=0,
        xmax=5,
        ymin=0,
        ymax=1.15,
        title=title or "LR Current Growth",
        elements=[
            Grid(step_x=1.0, step_y=0.25),
            Axes(
                x_label="t (s)",
                y_label="I (A)",
                tick_step=1.0,
                role="physical_axes",
            ),
            FunctionPlot(
                expr="1-exp(-x)",
                domain=(0.0, 5.0),
                label="I(t)",
                role="exponential_growth_curve",
                color="#2563eb",
            ),
            Segment(
                a=(0.0, 1.0),
                b=(5.0, 1.0),
                label=final_current_label,
                dashed=True,
                color="#059669",
            ),
        ],
    )
    if percentage is not None and 0 < percentage < 100:
        fraction = percentage / 100.0
        x_value = -__import__("math").log(1 - fraction)
        spec.elements.extend(
            [
                Segment(
                    a=(0.0, fraction),
                    b=(x_value, fraction),
                    dashed=True,
                    color="#dc2626",
                ),
                Point(
                    at=(x_value, fraction),
                    label=f"{percentage:g}%",
                    color="#dc2626",
                ),
            ]
        )
    return spec


def transformer_circuit(
    *,
    np_label: str = "Np",
    ns_label: str = "Ns",
    primary_voltage_label: str = "Vp",
    secondary_voltage_label: str = "Vs",
    resistance_label: Optional[str] = None,
    inductance_label: Optional[str] = None,
    show_load: bool = False,
    title: Optional[str] = None,
) -> DiagramSpec:
    spec = DiagramSpec(
        kind="physics-transformer",
        width=560,
        height=340,
        xmin=-7,
        xmax=7,
        ymin=-4,
        ymax=4,
        equal_scale=True,
        title=title or ("Transformer With R-L Load" if show_load else "Transformer"),
    )
    spec.elements.extend(
        [
            Circle(
                center=(-5.5, 0.0),
                radius=0.75,
                label="AC source",
                role="ac_source",
            ),
            Label(at=(-6.8, 1.2), text=f"AC {primary_voltage_label}"),
            Segment(a=(-5.5, 0.75), b=(-2.0, 2.2)),
            Segment(a=(-5.5, -0.75), b=(-2.0, -2.2)),
            Segment(a=(2.0, 2.2), b=(5.5, 2.2)),
            Segment(a=(2.0, -2.2), b=(5.5, -2.2)),
            Segment(
                a=(-0.35, -2.7),
                b=(-0.35, 2.7),
                label="core",
                role="magnetic_core",
            ),
            Segment(
                a=(0.35, -2.7),
                b=(0.35, 2.7),
                label="core",
                role="magnetic_core",
            ),
            Label(at=(-2.4, 3.0), text=f"primary coil {np_label}"),
            Label(at=(1.2, 3.0), text=f"secondary coil {ns_label}"),
            Label(at=(2.4, 1.6), text=secondary_voltage_label),
        ]
    )
    for x in (-1.75, -1.35, -0.95):
        spec.elements.append(
            Circle(
                center=(x, 0.0),
                radius=0.35,
                role="primary_coil",
                stroke="#7c3aed",
            )
        )
    for x in (0.95, 1.35, 1.75):
        spec.elements.append(
            Circle(
                center=(x, 0.0),
                radius=0.35,
                role="secondary_coil",
                stroke="#7c3aed",
            )
        )
    if show_load:
        spec.elements.extend(
            [
                Polygon(
                    points=[
                        (5.1, 1.2),
                        (5.9, 1.2),
                        (5.9, 0.2),
                        (5.1, 0.2),
                    ],
                    role="load_resistor",
                    fill="#fee2e2",
                    stroke="#b91c1c",
                ),
                Label(
                    at=(5.0, 0.7),
                    text=f"resistor {resistance_label or 'R'}",
                    dx=-65,
                ),
                Label(
                    at=(4.4, -1.0),
                    text=f"inductor {inductance_label or 'L'}",
                ),
                Segment(a=(5.5, 2.2), b=(5.5, 1.2)),
                Segment(a=(5.5, 0.2), b=(5.5, -0.4)),
                Segment(a=(5.5, -1.6), b=(5.5, -2.2)),
            ]
        )
        for y in (-0.55, -0.95, -1.35):
            spec.elements.append(
                Circle(
                    center=(5.5, y),
                    radius=0.23,
                    role="load_inductor",
                    stroke="#7c3aed",
                )
            )
    return spec


def coupled_coils(
    *,
    l1_label: str = "L1",
    l2_label: str = "L2",
    coupling_label: str = "k",
    current_label: str = "i1",
    emf_label: str = "ε2",
    mutual_label: Optional[str] = None,
    flux_label: Optional[str] = None,
    dot_convention: bool = False,
    title: Optional[str] = None,
) -> DiagramSpec:
    spec = DiagramSpec(
        kind="physics-coupled-coils",
        width=500,
        height=310,
        xmin=-6,
        xmax=6,
        ymin=-3.5,
        ymax=3.5,
        equal_scale=True,
        title=title or "Mutual Induction",
        elements=[
            Label(at=(-4.6, 2.5), text=f"coil 1 {l1_label}"),
            Label(at=(2.2, 2.5), text=f"coil 2 {l2_label}"),
            Arrow(
                start=(-5.0, -2.0),
                end=(-3.0, -2.0),
                label=current_label,
                role="changing_current",
            ),
            Arrow(
                start=(3.0, -2.0),
                end=(5.0, -2.0),
                label=f"induced emf {emf_label}",
                role="induced_emf",
            ),
            Arrow(
                start=(-1.6, 0.0),
                end=(1.6, 0.0),
                label=f"coupling {coupling_label}",
                role="coupling_indicator",
                dashed=True,
            ),
        ],
    )
    for x in (-4.4, -3.8, -3.2, -2.6):
        spec.elements.append(
            Circle(
                center=(x, 0.0),
                radius=0.42,
                role="coil_1",
                stroke="#7c3aed",
            )
        )
    for x in (2.6, 3.2, 3.8, 4.4):
        spec.elements.append(
            Circle(
                center=(x, 0.0),
                radius=0.42,
                role="coil_2",
                stroke="#7c3aed",
            )
        )
    if mutual_label:
        spec.elements.append(
            Label(
                at=(-1.2, 1.6),
                text=mutual_label,
                role="mutual_inductance",
            )
        )
    if flux_label:
        spec.elements.append(
            Arrow(
                start=(-1.4, 1.0),
                end=(1.4, 1.0),
                label=flux_label,
                role="mutual_flux_direction",
                dashed=True,
            )
        )
    if dot_convention:
        spec.elements.extend(
            [
                Point(
                    at=(-2.15, 0.65),
                    label="dot",
                    role="dot_convention",
                ),
                Point(
                    at=(2.15, 0.65),
                    label="dot",
                    role="dot_convention",
                ),
            ]
        )
    return spec


def refraction_diagram(
    *,
    incident_angle: float = 45.0,
    refracted_angle: float = 28.0,
    title: Optional[str] = None,
) -> DiagramSpec:
    import math

    vertex = (0.0, 0.0)
    incident = (
        -3.3 * math.sin(math.radians(incident_angle)),
        3.3 * math.cos(math.radians(incident_angle)),
    )
    refracted = (
        3.3 * math.sin(math.radians(refracted_angle)),
        -3.3 * math.cos(math.radians(refracted_angle)),
    )
    spec = DiagramSpec(
        kind="physics-refraction",
        width=440,
        height=320,
        xmin=-4,
        xmax=4,
        ymin=-4,
        ymax=4,
        equal_scale=True,
        title=title or "Refraction at a Boundary",
        elements=[
            Segment(
                a=(-4.0, 0.0),
                b=(4.0, 0.0),
                label="boundary",
                role="boundary",
            ),
            Segment(
                a=(0.0, -3.8),
                b=(0.0, 3.8),
                label="normal n",
                role="normal_line",
                dashed=True,
            ),
            Arrow(
                start=incident,
                end=vertex,
                label="incident ray",
                role="incident_ray",
            ),
            Arrow(
                start=vertex,
                end=refracted,
                label="refracted ray",
                role="refracted_ray",
            ),
            AngleMark(
                vertex=vertex,
                p1=(0.0, 2.0),
                p2=incident,
                label=f"i={incident_angle:g}°",
                role="angle_of_incidence",
            ),
            AngleMark(
                vertex=vertex,
                p1=(0.0, -2.0),
                p2=refracted,
                label=f"r={refracted_angle:g}°",
                role="angle_of_refraction",
            ),
        ],
    )
    return spec


def chemical_reaction_diagram(
    *,
    reactants: str,
    products: str,
    condition: str = "",
    title: Optional[str] = None,
) -> DiagramSpec:
    return DiagramSpec(
        kind="chemical-reaction",
        width=520,
        height=220,
        xmin=-6,
        xmax=6,
        ymin=-2,
        ymax=2,
        title=title or "Chemical Reaction",
        elements=[
            Label(
                at=(-4.6, 0.0),
                text=f"reactants: {reactants}",
                role="reactants",
            ),
            Arrow(
                start=(-1.2, 0.0),
                end=(1.2, 0.0),
                label=condition or "reaction",
                role="reaction_arrow",
            ),
            Label(
                at=(2.0, 0.0),
                text=f"products: {products}",
                role="products",
            ),
        ],
    )


def _fmt(v: float) -> str:
    return f"{v:g}"
