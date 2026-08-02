"""Math-diagram DSL.

A DiagramSpec is a viewport (math-world window) plus an ordered list of typed
elements. It is JSON-serialisable so it can be stored on a question/option and
rendered deterministically to SVG by `rendering.svg`.
"""
from __future__ import annotations

from typing import List, Literal, Optional, Tuple, Union

from pydantic import BaseModel, Field
from typing_extensions import Annotated

XY = Tuple[float, float]


class Axes(BaseModel):
    type: Literal["axes"] = "axes"
    role: Optional[str] = None
    x_label: str = "x"
    y_label: str = "y"
    ticks: bool = True
    tick_step: float = 1.0


class Grid(BaseModel):
    type: Literal["grid"] = "grid"
    step_x: float = 1.0
    step_y: float = 1.0


class FunctionPlot(BaseModel):
    type: Literal["function"] = "function"
    role: Optional[str] = None
    expr: str                       # sympy expression in variable x, e.g. "x**2 - 1"
    domain: XY                      # [x0, x1]
    samples: int = 120
    label: Optional[str] = None
    color: str = "#1f77b4"


class FunctionRegion(BaseModel):
    type: Literal["function-region"] = "function-region"
    upper_expr: str
    lower_expr: str
    domain: XY
    samples: int = 120
    fill: str = "#93c5fd"
    fill_opacity: float = 0.35


class Point(BaseModel):
    type: Literal["point"] = "point"
    role: Optional[str] = None
    at: XY
    label: Optional[str] = None
    color: str = "#d62728"


class Segment(BaseModel):
    type: Literal["segment"] = "segment"
    role: Optional[str] = None
    a: XY
    b: XY
    label: Optional[str] = None
    dashed: bool = False
    color: str = "#333333"


class Arrow(BaseModel):
    type: Literal["arrow"] = "arrow"
    role: Optional[str] = None
    start: XY
    end: XY
    label: Optional[str] = None
    dashed: bool = False
    color: str = "#1d4ed8"


class Line(BaseModel):
    """Infinite line a*x + b*y = c, clipped to the viewport. Used for LPP constraints."""
    type: Literal["line"] = "line"
    a: float
    b: float
    c: float
    label: Optional[str] = None
    dashed: bool = False
    color: str = "#2ca02c"


class Polygon(BaseModel):
    type: Literal["polygon"] = "polygon"
    role: Optional[str] = None
    points: List[XY]
    label: Optional[str] = None
    fill: str = "none"
    fill_opacity: float = 0.25
    stroke: str = "#333333"
    closed: bool = True


class Circle(BaseModel):
    type: Literal["circle"] = "circle"
    role: Optional[str] = None
    center: XY
    radius: float
    label: Optional[str] = None
    fill: str = "none"
    stroke: str = "#333333"


class AngleMark(BaseModel):
    """Small arc at `vertex` spanning toward points `p1` and `p2`, with a label."""
    type: Literal["angle"] = "angle"
    role: Optional[str] = None
    vertex: XY
    p1: XY
    p2: XY
    label: Optional[str] = None
    radius_px: float = 22.0
    color: str = "#9467bd"
    sweep: Literal["minor", "reflex"] = "minor"


class RightAngleMark(BaseModel):
    type: Literal["right-angle"] = "right-angle"
    vertex: XY
    p1: XY
    p2: XY
    size_px: float = 14.0
    color: str = "#7c3aed"


class TickMark(BaseModel):
    type: Literal["tick-mark"] = "tick-mark"
    a: XY
    b: XY
    count: int = 1
    size_px: float = 8.0
    color: str = "#7c3aed"


class ParallelMark(BaseModel):
    type: Literal["parallel-mark"] = "parallel-mark"
    a: XY
    b: XY
    count: int = 1
    size_px: float = 9.0
    color: str = "#7c3aed"


class BarChart(BaseModel):
    type: Literal["bar-chart"] = "bar-chart"
    categories: List[str]
    values: List[float]
    colors: List[str] = Field(default_factory=list)
    max_value: Optional[float] = None
    tick_step: Optional[float] = None
    x_label: str = ""
    y_label: str = ""
    show_values: bool = False


class PieChart(BaseModel):
    type: Literal["pie-chart"] = "pie-chart"
    categories: List[str]
    values: List[float]
    colors: List[str] = Field(default_factory=list)
    label_mode: Literal["value", "percent", "degrees", "none"] = "value"
    total_label: Optional[str] = None
    show_legend: bool = True


class PictogramRow(BaseModel):
    label: str
    value: float
    color: str = "#7c3aed"


class PictogramChart(BaseModel):
    type: Literal["pictogram"] = "pictogram"
    rows: List[PictogramRow]
    unit: float = 1.0
    key_label: Optional[str] = None
    max_icons_per_row: int = 12


class Label(BaseModel):
    type: Literal["label"] = "label"
    role: Optional[str] = None
    at: XY
    text: str
    color: str = "#111111"
    dx: float = 0.0
    dy: float = 0.0


class Dimension(BaseModel):
    """Measurement line with end ticks and a length label (mensuration)."""
    type: Literal["dimension"] = "dimension"
    a: XY
    b: XY
    label: str
    color: str = "#555555"
    offset_px: float = 0.0


Element = Annotated[
    Union[
        Axes,
        Grid,
        FunctionPlot,
        FunctionRegion,
        Point,
        Segment,
        Arrow,
        Line,
        Polygon,
        Circle,
        AngleMark,
        RightAngleMark,
        TickMark,
        ParallelMark,
        BarChart,
        PieChart,
        PictogramChart,
        Label,
        Dimension,
    ],
    Field(discriminator="type"),
]


class DiagramSpec(BaseModel):
    kind: str = "generic"           # function-plot | coordinate | lpp | circle | triangle | ...
    width: int = 360
    height: int = 300
    xmin: float = -5.0
    xmax: float = 5.0
    ymin: float = -5.0
    ymax: float = 5.0
    # When true the math window is expanded so x and y share one scale, keeping
    # shapes (circles, triangles, angles) proportional instead of squeezed.
    equal_scale: bool = False
    title: Optional[str] = None
    elements: List[Element] = Field(default_factory=list)
