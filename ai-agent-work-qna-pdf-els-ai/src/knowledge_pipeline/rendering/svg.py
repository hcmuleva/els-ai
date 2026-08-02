"""Render a DiagramSpec to a deterministic, self-contained SVG string.

No randomness, no external assets. Coordinates are rounded so identical specs
always produce byte-identical SVG (safe to cache/store/diff).
"""
from __future__ import annotations

import math
from typing import List, Sequence, Tuple
from xml.sax.saxutils import escape, quoteattr

from ..diagram.dsl import (
    AngleMark,
    Arrow,
    Axes,
    BarChart,
    Circle,
    Dimension,
    DiagramSpec,
    FunctionPlot,
    FunctionRegion,
    Grid,
    Label,
    Line,
    ParallelMark,
    PictogramChart,
    PieChart,
    Point,
    Polygon,
    RightAngleMark,
    Segment,
    TickMark,
)

_PAD = 34.0


def _fmt(v: float) -> str:
    return f"{v:.2f}".rstrip("0").rstrip(".") if v == v else "0"


class _Canvas:
    def __init__(self, spec: DiagramSpec) -> None:
        self.spec = spec
        self.w = float(spec.width)
        self.h = float(spec.height)
        self.pw = self.w - 2 * _PAD
        self.ph = self.h - 2 * _PAD
        self.xmin, self.xmax = float(spec.xmin), float(spec.xmax)
        self.ymin, self.ymax = float(spec.ymin), float(spec.ymax)
        if spec.equal_scale:
            self._apply_equal_scale()
        self.xr = (self.xmax - self.xmin) or 1.0
        self.yr = (self.ymax - self.ymin) or 1.0
        self.label_boxes: List[Tuple[float, float, float, float]] = []
        self.geometry_segments: List[Tuple[float, float, float, float]] = []

    def _apply_equal_scale(self) -> None:
        """Expand the shorter world axis so one world unit maps to the same
        pixel distance on both axes (keeps circles round, angles honest)."""
        xr = (self.xmax - self.xmin) or 1.0
        yr = (self.ymax - self.ymin) or 1.0
        if self.pw <= 0 or self.ph <= 0:
            return
        scale = min(self.pw / xr, self.ph / yr)
        target_xr = self.pw / scale
        target_yr = self.ph / scale
        cx = (self.xmin + self.xmax) / 2
        cy = (self.ymin + self.ymax) / 2
        self.xmin, self.xmax = cx - target_xr / 2, cx + target_xr / 2
        self.ymin, self.ymax = cy - target_yr / 2, cy + target_yr / 2

    def sx(self, x: float) -> float:
        return _PAD + (x - self.xmin) / self.xr * self.pw

    def sy(self, y: float) -> float:
        return self.h - _PAD - (y - self.ymin) / self.yr * self.ph

    def in_view(self, x: float, y: float) -> bool:
        return (
            self.xmin - 1e-9 <= x <= self.xmax + 1e-9
            and self.ymin - 1e-9 <= y <= self.ymax + 1e-9
        )

    def add_segment(self, x1: float, y1: float, x2: float, y2: float) -> None:
        self.geometry_segments.append((x1, y1, x2, y2))

    def add_world_segment(self, a: Tuple[float, float], b: Tuple[float, float]) -> None:
        self.add_segment(self.sx(a[0]), self.sy(a[1]), self.sx(b[0]), self.sy(b[1]))

    def place_label(
        self,
        text: str,
        candidates: Sequence[Tuple[float, float, str]],
        *,
        color: str,
        font_size: float = 12.0,
    ) -> str:
        if not candidates:
            candidates = [(_PAD + 6, _PAD + font_size, "start")]
        ranked: List[Tuple[float, Tuple[float, float, str], Tuple[float, float, float, float]]] = []
        for candidate in candidates:
            x, y, anchor = candidate
            box = _text_box(text, x, y, anchor, font_size)
            score = self._label_score(box)
            ranked.append((score, candidate, box))
        _, (x, y, anchor), box = min(ranked, key=lambda item: item[0])
        self.label_boxes.append(box)
        anchor_attr = f' text-anchor="{anchor}"' if anchor != "start" else ""
        return (
            f'<text x="{_fmt(x)}" y="{_fmt(y)}"{anchor_attr} data-layout="auto" '
            f'font-size="{_fmt(font_size)}" fill="{color}">{escape(text)}</text>'
        )

    def _label_score(self, box: Tuple[float, float, float, float]) -> float:
        left, top, right, bottom = box
        score = 0.0
        safe_left, safe_top = 5.0, 22.0 if self.spec.title else 5.0
        safe_right, safe_bottom = self.w - 5.0, self.h - 5.0
        if left < safe_left:
            score += (safe_left - left) * 1000
        if top < safe_top:
            score += (safe_top - top) * 1000
        if right > safe_right:
            score += (right - safe_right) * 1000
        if bottom > safe_bottom:
            score += (bottom - safe_bottom) * 1000
        for occupied in self.label_boxes:
            score += _overlap_area(box, occupied) * 100
        for segment in self.geometry_segments:
            if _segment_intersects_box(segment, box, padding=1.5):
                score += 400
        return score


def render_svg(spec: DiagramSpec) -> str:
    c = _Canvas(spec)
    _register_geometry(c)
    parts: List[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{spec.width}" height="{spec.height}" '
        f'viewBox="0 0 {spec.width} {spec.height}" font-family="sans-serif" font-size="12" '
        f'data-diagram-kind={quoteattr(spec.kind)}>',
        f'<rect x="0" y="0" width="{spec.width}" height="{spec.height}" fill="#ffffff"/>',
    ]
    if spec.title:
        c.label_boxes.append(_text_box(spec.title, c.w / 2, 16, "middle", 13.0))
        parts.append(
            f'<text x="{_fmt(c.w / 2)}" y="16" text-anchor="middle" '
            f'font-size="13" font-weight="bold" fill="#111111">{escape(spec.title)}</text>'
        )
    for index, el in enumerate(spec.elements):
        rendered = _dispatch(c, el)
        role = getattr(el, "role", None)
        role_attr = f" data-semantic-role={quoteattr(role)}" if role else ""
        parts.append(
            f'<g data-spec-index="{index}" data-element-type={quoteattr(el.type)}'
            f"{role_attr}>"
        )
        parts.extend(rendered)
        parts.append("</g>")
    parts.append("</svg>")
    return "".join(parts)


def _register_geometry(c: _Canvas) -> None:
    for element in c.spec.elements:
        if isinstance(element, Axes):
            x0 = c.sx(0) if c.xmin <= 0 <= c.xmax else _PAD
            y0 = c.sy(0) if c.ymin <= 0 <= c.ymax else (c.h - _PAD)
            c.add_segment(_PAD, y0, c.w - _PAD, y0)
            c.add_segment(x0, c.h - _PAD, x0, _PAD)
        elif isinstance(element, Segment):
            c.add_world_segment(element.a, element.b)
        elif isinstance(element, Arrow):
            c.add_world_segment(element.start, element.end)
        elif isinstance(element, Line):
            points = _clip_line(c, element.a, element.b, element.c)
            if len(points) == 2:
                c.add_world_segment(points[0], points[1])
        elif isinstance(element, Polygon):
            points = element.points
            for index in range(max(0, len(points) - 1)):
                c.add_world_segment(points[index], points[index + 1])
            if element.closed and len(points) > 2:
                c.add_world_segment(points[-1], points[0])
        elif isinstance(element, Circle):
            cx, cy = c.sx(element.center[0]), c.sy(element.center[1])
            rx = element.radius / c.xr * c.pw
            ry = element.radius / c.yr * c.ph
            previous = (cx + rx, cy)
            for index in range(1, 25):
                angle = 2 * math.pi * index / 24
                current = (cx + rx * math.cos(angle), cy + ry * math.sin(angle))
                c.add_segment(previous[0], previous[1], current[0], current[1])
                previous = current
            c.add_segment(previous[0], previous[1], cx + rx, cy)
            c.add_segment(cx, cy, cx, cy)
        elif isinstance(element, Dimension):
            c.add_world_segment(element.a, element.b)
        elif isinstance(element, Point):
            px, py = c.sx(element.at[0]), c.sy(element.at[1])
            c.add_segment(px, py, px, py)
        elif isinstance(element, FunctionPlot):
            for run in _function_screen_runs(c, element):
                for index in range(len(run) - 1):
                    c.add_segment(*run[index], *run[index + 1])
        elif isinstance(element, FunctionRegion):
            polygon = _function_region_screen_polygon(c, element)
            for index in range(len(polygon)):
                c.add_segment(*polygon[index - 1], *polygon[index])
        elif isinstance(element, (TickMark, ParallelMark)):
            c.add_world_segment(element.a, element.b)
        elif isinstance(element, RightAngleMark):
            c.add_world_segment(element.vertex, element.p1)
            c.add_world_segment(element.vertex, element.p2)


def _text_box(
    text: str, x: float, y: float, anchor: str, font_size: float
) -> Tuple[float, float, float, float]:
    width = max(font_size * 0.65, len(text) * font_size * 0.58)
    if anchor == "middle":
        left = x - width / 2
    elif anchor == "end":
        left = x - width
    else:
        left = x
    return (left - 2, y - font_size - 2, left + width + 2, y + 3)


def _overlap_area(
    first: Tuple[float, float, float, float],
    second: Tuple[float, float, float, float],
) -> float:
    width = min(first[2], second[2]) - max(first[0], second[0])
    height = min(first[3], second[3]) - max(first[1], second[1])
    return max(0.0, width) * max(0.0, height)


def _segment_intersects_box(
    segment: Tuple[float, float, float, float],
    box: Tuple[float, float, float, float],
    padding: float = 0.0,
) -> bool:
    x1, y1, x2, y2 = segment
    left, top, right, bottom = (
        box[0] - padding,
        box[1] - padding,
        box[2] + padding,
        box[3] + padding,
    )
    dx, dy = x2 - x1, y2 - y1
    p = (-dx, dx, -dy, dy)
    q = (x1 - left, right - x1, y1 - top, bottom - y1)
    low, high = 0.0, 1.0
    for pi, qi in zip(p, q):
        if abs(pi) < 1e-12:
            if qi < 0:
                return False
            continue
        ratio = qi / pi
        if pi < 0:
            low = max(low, ratio)
        else:
            high = min(high, ratio)
        if low > high:
            return False
    return True


def _dispatch(c: _Canvas, el) -> List[str]:
    if isinstance(el, Grid):
        return _grid(c, el)
    if isinstance(el, Axes):
        return _axes(c, el)
    if isinstance(el, FunctionPlot):
        return _function(c, el)
    if isinstance(el, FunctionRegion):
        return _function_region(c, el)
    if isinstance(el, Line):
        return _line(c, el)
    if isinstance(el, Segment):
        return _segment(c, el)
    if isinstance(el, Arrow):
        return _arrow(c, el)
    if isinstance(el, Polygon):
        return _polygon(c, el)
    if isinstance(el, Circle):
        return _circle(c, el)
    if isinstance(el, AngleMark):
        return _angle(c, el)
    if isinstance(el, RightAngleMark):
        return _right_angle(c, el)
    if isinstance(el, TickMark):
        return _tick_mark(c, el)
    if isinstance(el, ParallelMark):
        return _parallel_mark(c, el)
    if isinstance(el, BarChart):
        return _bar_chart(c, el)
    if isinstance(el, PieChart):
        return _pie_chart(c, el)
    if isinstance(el, PictogramChart):
        return _pictogram(c, el)
    if isinstance(el, Dimension):
        return _dimension(c, el)
    if isinstance(el, Point):
        return _point(c, el)
    if isinstance(el, Label):
        return _label(c, el)
    return []


def _frange(lo: float, hi: float, step: float):
    if step <= 0:
        return
    n = math.floor(lo / step) * step
    while n <= hi + 1e-9:
        if n >= lo - 1e-9:
            yield round(n, 6)
        n += step


def _grid(c: _Canvas, g: Grid) -> List[str]:
    out = ['<g stroke="#e6e6e6" stroke-width="1">']
    for x in _frange(c.xmin, c.xmax, g.step_x):
        out.append(f'<line x1="{_fmt(c.sx(x))}" y1="{_fmt(_PAD)}" x2="{_fmt(c.sx(x))}" y2="{_fmt(c.h - _PAD)}"/>')
    for y in _frange(c.ymin, c.ymax, g.step_y):
        out.append(f'<line x1="{_fmt(_PAD)}" y1="{_fmt(c.sy(y))}" x2="{_fmt(c.w - _PAD)}" y2="{_fmt(c.sy(y))}"/>')
    out.append("</g>")
    return out


def _axes(c: _Canvas, a: Axes) -> List[str]:
    s = c
    x0 = c.sx(0) if s.xmin <= 0 <= s.xmax else _PAD
    y0 = c.sy(0) if s.ymin <= 0 <= s.ymax else (c.h - _PAD)
    out = ['<g stroke="#555555" stroke-width="1.2">']
    out.append(f'<line x1="{_fmt(_PAD)}" y1="{_fmt(y0)}" x2="{_fmt(c.w - _PAD)}" y2="{_fmt(y0)}"/>')
    out.append(f'<line x1="{_fmt(x0)}" y1="{_fmt(c.h - _PAD)}" x2="{_fmt(x0)}" y2="{_fmt(_PAD)}"/>')
    out.append("</g>")
    if a.ticks:
        out.append('<g stroke="#555555" stroke-width="1" fill="#555555" font-size="10">')
        for x in _frange(s.xmin, s.xmax, a.tick_step):
            if abs(x) < 1e-9:
                continue
            px = c.sx(x)
            out.append(f'<line x1="{_fmt(px)}" y1="{_fmt(y0 - 3)}" x2="{_fmt(px)}" y2="{_fmt(y0 + 3)}"/>')
            c.label_boxes.append(_text_box(_fmt(x), px, y0 + 14, "middle", 10.0))
            out.append(f'<text x="{_fmt(px)}" y="{_fmt(y0 + 14)}" text-anchor="middle">{_fmt(x)}</text>')
        for y in _frange(s.ymin, s.ymax, a.tick_step):
            if abs(y) < 1e-9:
                continue
            py = c.sy(y)
            out.append(f'<line x1="{_fmt(x0 - 3)}" y1="{_fmt(py)}" x2="{_fmt(x0 + 3)}" y2="{_fmt(py)}"/>')
            c.label_boxes.append(_text_box(_fmt(y), x0 - 6, py + 3, "end", 10.0))
            out.append(f'<text x="{_fmt(x0 - 6)}" y="{_fmt(py + 3)}" text-anchor="end">{_fmt(y)}</text>')
        out.append("</g>")
    out.append(c.place_label(
        a.x_label,
        [(c.w - _PAD + 2, y0 + 4, "start"), (c.w - _PAD - 6, y0 - 8, "end")],
        color="#555555",
    ))
    out.append(c.place_label(
        a.y_label,
        [(x0 + 4, _PAD - 4, "start"), (x0 - 6, _PAD + 12, "end")],
        color="#555555",
    ))
    return out


def _function_screen_runs(
    c: _Canvas, function: FunctionPlot
) -> List[List[Tuple[float, float]]]:
    import sympy  # type: ignore

    x = sympy.Symbol("x")
    try:
        fn = sympy.lambdify(x, sympy.sympify(function.expr), "math")
    except Exception:
        return [[]]
    x0, x1 = function.domain
    n = max(2, int(function.samples))
    runs: List[List[Tuple[float, float]]] = [[]]
    for i in range(n + 1):
        xv = x0 + (x1 - x0) * i / n
        try:
            yv = float(fn(xv))
        except Exception:
            runs.append([])
            continue
        if not math.isfinite(yv) or yv < c.ymin or yv > c.ymax:
            runs.append([])
            continue
        runs[-1].append((c.sx(xv), c.sy(yv)))
    return runs


def _function(c: _Canvas, f: FunctionPlot) -> List[str]:
    runs = _function_screen_runs(c, f)
    out = []
    for run in runs:
        if len(run) >= 2:
            pts = " ".join(f"{_fmt(px)},{_fmt(py)}" for px, py in run)
            out.append(
                f'<polyline points="{pts}" fill="none" stroke="{f.color}" stroke-width="2"/>'
            )
    if f.label and runs:
        last = next((r[-1] for r in reversed(runs) if r), None)
        if last:
            out.append(c.place_label(
                f.label,
                [
                    (last[0] - 6, last[1] - 8, "end"),
                    (last[0] - 6, last[1] + 18, "end"),
                    (last[0] + 8, last[1] - 8, "start"),
                    (last[0] + 8, last[1] + 18, "start"),
                ],
                color=f.color,
            ))
    return out


def _function_region_screen_polygon(
    c: _Canvas, region: FunctionRegion
) -> List[Tuple[float, float]]:
    import sympy  # type: ignore

    x = sympy.Symbol("x")
    try:
        upper = sympy.lambdify(x, sympy.sympify(region.upper_expr), "math")
        lower = sympy.lambdify(x, sympy.sympify(region.lower_expr), "math")
    except Exception:
        return []
    x0, x1 = region.domain
    samples = max(2, int(region.samples))
    top: List[Tuple[float, float]] = []
    bottom: List[Tuple[float, float]] = []
    for index in range(samples + 1):
        xv = x0 + (x1 - x0) * index / samples
        try:
            upper_y = float(upper(xv))
            lower_y = float(lower(xv))
        except Exception:
            return []
        if not all(math.isfinite(value) for value in (upper_y, lower_y)):
            return []
        if upper_y < lower_y:
            upper_y, lower_y = lower_y, upper_y
        top.append((c.sx(xv), c.sy(upper_y)))
        bottom.append((c.sx(xv), c.sy(lower_y)))
    return top + list(reversed(bottom))


def _function_region(c: _Canvas, region: FunctionRegion) -> List[str]:
    polygon = _function_region_screen_polygon(c, region)
    if len(polygon) < 4:
        return []
    points = " ".join(f"{_fmt(x)},{_fmt(y)}" for x, y in polygon)
    return [
        f'<polygon points="{points}" fill="{region.fill}" '
        f'fill-opacity="{_fmt(region.fill_opacity)}" stroke="none"/>'
    ]


def _clip_line(c: _Canvas, a: float, b: float, cc: float):
    s = c
    pts: List[Tuple[float, float]] = []
    if abs(b) > 1e-12:
        for xv in (s.xmin, s.xmax):
            yv = (cc - a * xv) / b
            if c.in_view(xv, yv):
                pts.append((xv, yv))
    if abs(a) > 1e-12:
        for yv in (s.ymin, s.ymax):
            xv = (cc - b * yv) / a
            if c.in_view(xv, yv):
                pts.append((xv, yv))
    uniq: List[Tuple[float, float]] = []
    for p in pts:
        if not any(abs(p[0] - q[0]) < 1e-6 and abs(p[1] - q[1]) < 1e-6 for q in uniq):
            uniq.append(p)
    return uniq[:2]


def _line(c: _Canvas, ln: Line) -> List[str]:
    pts = _clip_line(c, ln.a, ln.b, ln.c)
    if len(pts) < 2:
        return []
    (x1, y1), (x2, y2) = pts
    dash = ' stroke-dasharray="5,4"' if ln.dashed else ""
    out = [
        f'<line x1="{_fmt(c.sx(x1))}" y1="{_fmt(c.sy(y1))}" x2="{_fmt(c.sx(x2))}" '
        f'y2="{_fmt(c.sy(y2))}" stroke="{ln.color}" stroke-width="1.8"{dash}/>'
    ]
    if ln.label:
        out.append(c.place_label(
            ln.label,
            _line_label_candidates(c.sx(x1), c.sy(y1), c.sx(x2), c.sy(y2), ln.label),
            color=ln.color,
        ))
    return out


def _segment(c: _Canvas, sg: Segment) -> List[str]:
    dash = ' stroke-dasharray="5,4"' if sg.dashed else ""
    out = [
        f'<line x1="{_fmt(c.sx(sg.a[0]))}" y1="{_fmt(c.sy(sg.a[1]))}" '
        f'x2="{_fmt(c.sx(sg.b[0]))}" y2="{_fmt(c.sy(sg.b[1]))}" stroke="{sg.color}" '
        f'stroke-width="1.8"{dash}/>'
    ]
    if sg.label:
        out.append(c.place_label(
            sg.label,
            _line_label_candidates(
                c.sx(sg.a[0]), c.sy(sg.a[1]), c.sx(sg.b[0]), c.sy(sg.b[1]), sg.label
            ),
            color=sg.color,
        ))
    return out


def _line_label_candidates(
    x1: float, y1: float, x2: float, y2: float, text: str = ""
) -> List[Tuple[float, float, str]]:
    dx, dy = x2 - x1, y2 - y1
    length = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / length, dx / length
    candidates: List[Tuple[float, float, str]] = []
    clear_offset = max(16.0, len(text) * 3.5 + 9.0)
    for fraction in (0.5, 0.34, 0.66):
        base_x = x1 + dx * fraction
        base_y = y1 + dy * fraction
        for offset in (
            clear_offset,
            -clear_offset,
            clear_offset + 10.0,
            -clear_offset - 10.0,
        ):
            candidates.append(
                (base_x + nx * offset, base_y + ny * offset + 4, "middle")
            )
    return candidates


def _arrow(c: _Canvas, arrow: Arrow) -> List[str]:
    x1, y1 = c.sx(arrow.start[0]), c.sy(arrow.start[1])
    x2, y2 = c.sx(arrow.end[0]), c.sy(arrow.end[1])
    dx, dy = x2 - x1, y2 - y1
    length = math.hypot(dx, dy)
    if length < 1e-9:
        return []
    ux, uy = dx / length, dy / length
    px, py = -uy, ux
    tip_length, tip_width = 10.0, 4.5
    base_x, base_y = x2 - ux * tip_length, y2 - uy * tip_length
    tip_points = " ".join(
        [
            f"{_fmt(x2)},{_fmt(y2)}",
            f"{_fmt(base_x + px * tip_width)},{_fmt(base_y + py * tip_width)}",
            f"{_fmt(base_x - px * tip_width)},{_fmt(base_y - py * tip_width)}",
        ]
    )
    dash = ' stroke-dasharray="5,4"' if arrow.dashed else ""
    out = [
        f'<line x1="{_fmt(x1)}" y1="{_fmt(y1)}" x2="{_fmt(base_x)}" '
        f'y2="{_fmt(base_y)}" stroke="{arrow.color}" stroke-width="2.2"{dash}/>',
        f'<polygon points="{tip_points}" fill="{arrow.color}" stroke="{arrow.color}"/>',
    ]
    if arrow.label:
        out.append(c.place_label(
            arrow.label,
            _line_label_candidates(x1, y1, x2, y2, arrow.label),
            color=arrow.color,
        ))
    return out


def _polygon(c: _Canvas, p: Polygon) -> List[str]:
    pts = " ".join(f"{_fmt(c.sx(x))},{_fmt(c.sy(y))}" for x, y in p.points)
    tag = "polygon" if p.closed else "polyline"
    out = [
        f'<{tag} points="{pts}" fill="{p.fill}" fill-opacity="{_fmt(p.fill_opacity)}" '
        f'stroke="{p.stroke}" stroke-width="1.8"/>'
    ]
    if p.label and p.points:
        cx = sum(x for x, _ in p.points) / len(p.points)
        cy = sum(y for _, y in p.points) / len(p.points)
        px, py = c.sx(cx), c.sy(cy)
        out.append(c.place_label(
            p.label,
            [
                (px, py, "middle"),
                (px, py - 18, "middle"),
                (px, py + 22, "middle"),
                (px + 18, py, "start"),
                (px - 18, py, "end"),
            ],
            color="#333333",
        ))
    return out


def _circle(c: _Canvas, cir: Circle) -> List[str]:
    cx, cy = c.sx(cir.center[0]), c.sy(cir.center[1])
    rx = cir.radius / c.xr * c.pw
    ry = cir.radius / c.yr * c.ph
    out = [
        f'<ellipse cx="{_fmt(cx)}" cy="{_fmt(cy)}" rx="{_fmt(rx)}" ry="{_fmt(ry)}" '
        f'fill="{cir.fill}" stroke="{cir.stroke}" stroke-width="1.8"/>'
    ]
    out.append(f'<circle cx="{_fmt(cx)}" cy="{_fmt(cy)}" r="2" fill="{cir.stroke}"/>')
    if cir.label:
        out.append(c.place_label(
            cir.label,
            [
                (cx + 8, cy - 8, "start"),
                (cx - 8, cy - 8, "end"),
                (cx + 8, cy + 16, "start"),
                (cx - 8, cy + 16, "end"),
            ],
            color="#333333",
        ))
    return out


def _angle(c: _Canvas, a: AngleMark) -> List[str]:
    vx, vy = c.sx(a.vertex[0]), c.sy(a.vertex[1])
    a1 = math.atan2(c.sy(a.p1[1]) - vy, c.sx(a.p1[0]) - vx)
    a2 = math.atan2(c.sy(a.p2[1]) - vy, c.sx(a.p2[0]) - vx)
    x1, y1 = vx + a.radius_px * math.cos(a1), vy + a.radius_px * math.sin(a1)
    x2, y2 = vx + a.radius_px * math.cos(a2), vy + a.radius_px * math.sin(a2)
    counterclockwise = (a2 - a1) % (2 * math.pi)
    if a.sweep == "minor":
        if counterclockwise <= math.pi:
            diff, sweep, mid = counterclockwise, 1, a1 + counterclockwise / 2
        else:
            diff, sweep = 2 * math.pi - counterclockwise, 0
            mid = a1 - diff / 2
    elif counterclockwise > math.pi:
        diff, sweep, mid = counterclockwise, 1, a1 + counterclockwise / 2
    else:
        diff, sweep = 2 * math.pi - counterclockwise, 0
        mid = a1 - diff / 2
    out = [
        f'<path d="M {_fmt(x1)} {_fmt(y1)} A {_fmt(a.radius_px)} {_fmt(a.radius_px)} 0 '
        f'{1 if diff > math.pi else 0} {sweep} {_fmt(x2)} {_fmt(y2)}" '
        f'fill="none" stroke="{a.color}" stroke-width="1.6"/>'
    ]
    if a.label:
        candidates = [
            (
                vx + (a.radius_px + reach) * math.cos(mid + swing),
                vy + (a.radius_px + reach) * math.sin(mid + swing),
                "middle",
            )
            for reach in (12.0, 20.0, 30.0, 4.0)
            for swing in (0.0, 0.35, -0.35)
        ]
        out.append(c.place_label(a.label, candidates, color=a.color))
    return out


def _unit_screen_vector(c: _Canvas, start, end) -> Tuple[float, float]:
    dx = c.sx(end[0]) - c.sx(start[0])
    dy = c.sy(end[1]) - c.sy(start[1])
    length = math.hypot(dx, dy)
    if length < 1e-9:
        return (0.0, 0.0)
    return (dx / length, dy / length)


def _right_angle(c: _Canvas, mark: RightAngleMark) -> List[str]:
    vx, vy = c.sx(mark.vertex[0]), c.sy(mark.vertex[1])
    u1 = _unit_screen_vector(c, mark.vertex, mark.p1)
    u2 = _unit_screen_vector(c, mark.vertex, mark.p2)
    if u1 == (0.0, 0.0) or u2 == (0.0, 0.0):
        return []
    size = mark.size_px
    first = (vx + u1[0] * size, vy + u1[1] * size)
    corner = (
        vx + (u1[0] + u2[0]) * size,
        vy + (u1[1] + u2[1]) * size,
    )
    second = (vx + u2[0] * size, vy + u2[1] * size)
    return [
        f'<polyline points="{_fmt(first[0])},{_fmt(first[1])} '
        f'{_fmt(corner[0])},{_fmt(corner[1])} '
        f'{_fmt(second[0])},{_fmt(second[1])}" fill="none" '
        f'stroke="{mark.color}" stroke-width="1.7"/>'
    ]


def _tick_mark(c: _Canvas, mark: TickMark) -> List[str]:
    x1, y1 = c.sx(mark.a[0]), c.sy(mark.a[1])
    x2, y2 = c.sx(mark.b[0]), c.sy(mark.b[1])
    dx, dy = x2 - x1, y2 - y1
    length = math.hypot(dx, dy)
    if length < 1e-9:
        return []
    ux, uy, nx, ny = dx / length, dy / length, -dy / length, dx / length
    out: List[str] = []
    for index in range(max(1, mark.count)):
        shift = (index - (max(1, mark.count) - 1) / 2) * 6
        mx = (x1 + x2) / 2 + ux * shift
        my = (y1 + y2) / 2 + uy * shift
        half = mark.size_px / 2
        out.append(
            f'<line x1="{_fmt(mx - nx * half)}" y1="{_fmt(my - ny * half)}" '
            f'x2="{_fmt(mx + nx * half)}" y2="{_fmt(my + ny * half)}" '
            f'stroke="{mark.color}" stroke-width="1.8"/>'
        )
    return out


def _parallel_mark(c: _Canvas, mark: ParallelMark) -> List[str]:
    x1, y1 = c.sx(mark.a[0]), c.sy(mark.a[1])
    x2, y2 = c.sx(mark.b[0]), c.sy(mark.b[1])
    dx, dy = x2 - x1, y2 - y1
    length = math.hypot(dx, dy)
    if length < 1e-9:
        return []
    ux, uy, nx, ny = dx / length, dy / length, -dy / length, dx / length
    out: List[str] = []
    for index in range(max(1, mark.count)):
        shift = (index - (max(1, mark.count) - 1) / 2) * 8
        mx, my = (x1 + x2) / 2 + ux * shift, (y1 + y2) / 2 + uy * shift
        size = mark.size_px
        points = [
            (mx - ux * size / 2 + nx * size / 2, my - uy * size / 2 + ny * size / 2),
            (mx + ux * size / 2, my + uy * size / 2),
            (mx - ux * size / 2 - nx * size / 2, my - uy * size / 2 - ny * size / 2),
        ]
        out.append(
            f'<polyline points="{" ".join(f"{_fmt(x)},{_fmt(y)}" for x, y in points)}" '
            f'fill="none" stroke="{mark.color}" stroke-width="1.8"/>'
        )
    return out


def _palette(index: int) -> str:
    colors = ("#7c3aed", "#2563eb", "#f97316", "#16a34a", "#db2777", "#eab308")
    return colors[index % len(colors)]


def _nice_step(maximum: float) -> float:
    if maximum <= 0:
        return 1.0
    rough = maximum / 5
    power = 10 ** math.floor(math.log10(rough))
    scaled = rough / power
    nice = 1 if scaled <= 1 else 2 if scaled <= 2 else 5 if scaled <= 5 else 10
    return nice * power


def _bar_chart(c: _Canvas, chart: BarChart) -> List[str]:
    left, right = 62.0, c.w - 22.0
    top, bottom = (32.0 if c.spec.title else 20.0), c.h - 54.0
    maximum = chart.max_value or max(chart.values or [1])
    step = chart.tick_step or _nice_step(maximum)
    maximum = max(maximum, step)
    count = max(1, len(chart.categories))
    slot = (right - left) / count
    bar_width = slot * 0.62
    out = ['<g font-size="10">']
    tick = 0.0
    while tick <= maximum + 1e-9:
        y = bottom - tick / maximum * (bottom - top)
        out.append(
            f'<line x1="{_fmt(left)}" y1="{_fmt(y)}" x2="{_fmt(right)}" '
            f'y2="{_fmt(y)}" stroke="#dbe3ee" stroke-width="1"/>'
        )
        out.append(
            f'<text x="{_fmt(left - 7)}" y="{_fmt(y + 3)}" text-anchor="end" '
            f'fill="#475569">{escape(_fmt(tick))}</text>'
        )
        tick += step
    out.append(
        f'<line x1="{_fmt(left)}" y1="{_fmt(top)}" x2="{_fmt(left)}" '
        f'y2="{_fmt(bottom)}" stroke="#475569"/>'
    )
    out.append(
        f'<line x1="{_fmt(left)}" y1="{_fmt(bottom)}" x2="{_fmt(right)}" '
        f'y2="{_fmt(bottom)}" stroke="#475569"/>'
    )
    for index, (category, value) in enumerate(zip(chart.categories, chart.values)):
        x = left + index * slot + (slot - bar_width) / 2
        height = max(0.0, value) / maximum * (bottom - top)
        y = bottom - height
        color = chart.colors[index] if index < len(chart.colors) else _palette(index)
        out.append(
            f'<rect x="{_fmt(x)}" y="{_fmt(y)}" width="{_fmt(bar_width)}" '
            f'height="{_fmt(height)}" fill="{color}"/>'
        )
        out.append(
            f'<text x="{_fmt(x + bar_width / 2)}" y="{_fmt(bottom + 16)}" '
            f'text-anchor="middle" fill="#334155">{escape(category)}</text>'
        )
        if chart.show_values:
            out.append(
                f'<text x="{_fmt(x + bar_width / 2)}" y="{_fmt(y - 5)}" '
                f'text-anchor="middle" fill="#334155">{escape(_fmt(value))}</text>'
            )
    if chart.x_label:
        out.append(
            f'<text x="{_fmt((left + right) / 2)}" y="{_fmt(c.h - 10)}" '
            f'text-anchor="middle" font-size="11">{escape(chart.x_label)}</text>'
        )
    if chart.y_label:
        out.append(
            f'<text x="14" y="{_fmt((top + bottom) / 2)}" text-anchor="middle" '
            f'font-size="11" transform="rotate(-90 14 {_fmt((top + bottom) / 2)})">'
            f'{escape(chart.y_label)}</text>'
        )
    out.append("</g>")
    return out


def _pie_chart(c: _Canvas, chart: PieChart) -> List[str]:
    total = sum(chart.values)
    cx = c.w * (0.38 if chart.show_legend else 0.5)
    cy = c.h * 0.53
    radius = min(c.h * 0.32, c.w * (0.25 if chart.show_legend else 0.35))
    angle = -math.pi / 2
    out = ['<g font-size="10">']
    for index, (category, value) in enumerate(zip(chart.categories, chart.values)):
        sweep = 2 * math.pi * value / total
        end = angle + sweep
        x1, y1 = cx + radius * math.cos(angle), cy + radius * math.sin(angle)
        x2, y2 = cx + radius * math.cos(end), cy + radius * math.sin(end)
        large = 1 if sweep > math.pi else 0
        color = chart.colors[index] if index < len(chart.colors) else _palette(index)
        out.append(
            f'<path d="M {_fmt(cx)} {_fmt(cy)} L {_fmt(x1)} {_fmt(y1)} '
            f'A {_fmt(radius)} {_fmt(radius)} 0 {large} 1 {_fmt(x2)} {_fmt(y2)} Z" '
            f'fill="{color}" stroke="#ffffff" stroke-width="1.5"/>'
        )
        if chart.label_mode != "none":
            mid = angle + sweep / 2
            label_value = (
                f"{_fmt(value)}"
                if chart.label_mode == "value"
                else f"{_fmt(value / total * 100)}%"
                if chart.label_mode == "percent"
                else f"{_fmt(value / total * 360)}°"
            )
            lx, ly = cx + radius * 0.62 * math.cos(mid), cy + radius * 0.62 * math.sin(mid)
            out.append(
                f'<text x="{_fmt(lx)}" y="{_fmt(ly + 3)}" text-anchor="middle" '
                f'fill="#111827" font-weight="bold">{escape(label_value)}</text>'
            )
        angle = end
    if chart.total_label:
        out.append(
            f'<text x="{_fmt(cx)}" y="{_fmt(cy - radius - 12)}" text-anchor="middle" '
            f'font-size="11" font-weight="bold">{escape(chart.total_label)}</text>'
        )
    if chart.show_legend:
        legend_x, legend_y = c.w * 0.7, c.h * 0.3
        for index, category in enumerate(chart.categories):
            y = legend_y + index * 22
            color = chart.colors[index] if index < len(chart.colors) else _palette(index)
            out.append(
                f'<rect x="{_fmt(legend_x)}" y="{_fmt(y - 10)}" width="12" height="12" fill="{color}"/>'
            )
            out.append(
                f'<text x="{_fmt(legend_x + 18)}" y="{_fmt(y)}" fill="#334155">'
                f'{escape(category)}</text>'
            )
    out.append("</g>")
    return out


def _pictogram(c: _Canvas, chart: PictogramChart) -> List[str]:
    left, top, label_width = 24.0, (38.0 if c.spec.title else 22.0), 92.0
    row_height = min(48.0, (c.h - top - 38) / max(1, len(chart.rows)))
    icon_size = min(24.0, (c.w - left - label_width - 24) / chart.max_icons_per_row - 4)
    out = ['<g font-size="11">']
    key = chart.key_label or f"1 square = {_fmt(chart.unit)}"
    out.append(
        f'<text x="{_fmt(left)}" y="{_fmt(top - 8)}" font-weight="bold">{escape(key)}</text>'
    )
    for row_index, row in enumerate(chart.rows):
        y = top + row_index * row_height
        out.append(
            f'<line x1="{_fmt(left)}" y1="{_fmt(y + row_height - 5)}" '
            f'x2="{_fmt(c.w - 20)}" y2="{_fmt(y + row_height - 5)}" stroke="#e2e8f0"/>'
        )
        out.append(
            f'<text x="{_fmt(left)}" y="{_fmt(y + row_height / 2 + 4)}" '
            f'fill="#334155">{escape(row.label)}</text>'
        )
        icons = row.value / chart.unit
        full = int(math.floor(icons + 1e-9))
        fraction = max(0.0, icons - full)
        for index in range(min(full + (1 if fraction > 1e-9 else 0), chart.max_icons_per_row)):
            x = left + label_width + index * (icon_size + 4)
            fill_fraction = 1.0 if index < full else fraction
            out.append(
                f'<rect x="{_fmt(x)}" y="{_fmt(y + (row_height - icon_size) / 2)}" '
                f'width="{_fmt(icon_size)}" height="{_fmt(icon_size)}" '
                f'fill="none" stroke="{row.color}" stroke-width="1.2"/>'
            )
            if fill_fraction > 0:
                out.append(
                    f'<rect x="{_fmt(x)}" y="{_fmt(y + (row_height - icon_size) / 2)}" '
                    f'width="{_fmt(icon_size * fill_fraction)}" height="{_fmt(icon_size)}" '
                    f'fill="{row.color}"/>'
                )
    out.append("</g>")
    return out


def _dimension(c: _Canvas, d: Dimension) -> List[str]:
    ax, ay = c.sx(d.a[0]), c.sy(d.a[1])
    bx, by = c.sx(d.b[0]), c.sy(d.b[1])
    dx, dy = bx - ax, by - ay
    length = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / length, dx / length
    off = d.offset_px
    ax2, ay2 = ax + nx * off, ay + ny * off
    bx2, by2 = bx + nx * off, by + ny * off
    tick = 5.0
    out = [
        f'<line x1="{_fmt(ax2)}" y1="{_fmt(ay2)}" x2="{_fmt(bx2)}" y2="{_fmt(by2)}" '
        f'stroke="{d.color}" stroke-width="1.2"/>',
        f'<line x1="{_fmt(ax2 - nx * tick)}" y1="{_fmt(ay2 - ny * tick)}" '
        f'x2="{_fmt(ax2 + nx * tick)}" y2="{_fmt(ay2 + ny * tick)}" stroke="{d.color}" stroke-width="1.2"/>',
        f'<line x1="{_fmt(bx2 - nx * tick)}" y1="{_fmt(by2 - ny * tick)}" '
        f'x2="{_fmt(bx2 + nx * tick)}" y2="{_fmt(by2 + ny * tick)}" stroke="{d.color}" stroke-width="1.2"/>',
    ]
    mx, my = (ax2 + bx2) / 2 + nx * 10, (ay2 + by2) / 2 + ny * 10
    out.append(c.place_label(
        d.label,
        [
            (mx, my, "middle"),
            (mx + nx * 10, my + ny * 10, "middle"),
            (mx - nx * 20, my - ny * 20, "middle"),
        ],
        color=d.color,
    ))
    return out


def _point(c: _Canvas, p: Point) -> List[str]:
    px, py = c.sx(p.at[0]), c.sy(p.at[1])
    out = [f'<circle cx="{_fmt(px)}" cy="{_fmt(py)}" r="3" fill="{p.color}"/>']
    if p.label:
        out.append(c.place_label(
            p.label,
            [
                (px + 8, py - 8, "start"),
                (px - 8, py - 8, "end"),
                (px + 8, py + 18, "start"),
                (px - 8, py + 18, "end"),
                (px, py - 15, "middle"),
                (px, py + 22, "middle"),
            ],
            color="#111111",
        ))
    return out


def _label(c: _Canvas, lb: Label) -> List[str]:
    px, py = c.sx(lb.at[0]) + lb.dx, c.sy(lb.at[1]) + lb.dy
    return [c.place_label(
        lb.text,
        [
            (px, py, "start"),
            (px - 8, py, "end"),
            (px, py - 14, "start"),
            (px, py + 18, "start"),
            (px + 8, py - 8, "start"),
            (px - 8, py - 8, "end"),
        ],
        color=lb.color,
    )]
