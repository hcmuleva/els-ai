"""Generate a visual gallery of deterministic mathematics and physics SVGs."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
_SRC = _ROOT / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from knowledge_pipeline.assessment.validation import validate_svg  # noqa: E402
from knowledge_pipeline.diagram import builders as B  # noqa: E402
from knowledge_pipeline.diagram.validation import (  # noqa: E402
    validate_spec_semantics,
    validate_svg_layout,
)
from knowledge_pipeline.rendering.svg import render_svg  # noqa: E402


def sample_diagrams() -> list[dict]:
    return [
        {
            "slug": "quadratic-function",
            "category": "Mathematics",
            "topic": "Quadratic Functions",
            "description": "Parabola with roots and vertex marked.",
            "spec": B.function_plot(
                "x**2 - 4*x",
                xmin=-1,
                xmax=5,
                ymin=-5,
                ymax=6,
                label="y=x²−4x",
                points=[(0, 0, "A"), (2, -4, "V"), (4, 0, "B")],
                title="Quadratic Function",
            ),
        },
        {
            "slug": "linear-programming",
            "category": "Mathematics",
            "topic": "Linear Programming",
            "description": "Feasible polygon, constraints, and optimum point.",
            "spec": B.lpp_region(
                [(1, 1, 6, "≤"), (2, 1, 8, "≤")],
                [(0, 0), (4, 0), (2, 4), (0, 6)],
                xmax=7,
                ymax=7,
                optimum=(2, 4, "optimum"),
                title="Linear Programming Region",
            ),
        },
        {
            "slug": "circle-chords",
            "category": "Mathematics",
            "topic": "Circle Geometry",
            "description": "A cyclic quadrilateral built from marked chord endpoints.",
            "spec": B.circle_diagram(
                radius=3,
                marked=[(20, "A"), (130, "B"), (210, "C"), (310, "D")],
                chords=[(20, 130), (130, 210), (210, 310), (310, 20)],
                title="Cyclic Quadrilateral",
            ),
        },
        {
            "slug": "triangle-trigonometry",
            "category": "Mathematics",
            "topic": "Trigonometry",
            "description": "Labeled triangle with an explicit angle marker.",
            "spec": B.triangle_diagram(
                (0, 0),
                (5, 0),
                (1.5, 3.5),
                side_labels=("c", "a", "b"),
                mark_angle_at=0,
                angle_label="θ",
                title="Triangle and Angle",
            ),
        },
        {
            "slug": "coordinate-distance",
            "category": "Mathematics",
            "topic": "Coordinate Geometry",
            "description": "Two points joined by a measured segment.",
            "spec": B.coordinate_diagram(
                [(1, 2, "P(1,2)"), (5, 5, "Q(5,5)")],
                [((1, 2), (5, 5), "PQ=5")],
                title="Distance Between Two Points",
            ),
        },
        {
            "slug": "right-triangle-missing-side",
            "category": "Mathematics",
            "topic": "Right-Angled Trigonometry",
            "description": "Proportional right triangle with a right-angle square and unknown side.",
            "spec": B.right_triangle_diagram(
                10,
                14,
                orientation="bottom-right",
                side_labels=("10", "?", "14"),
                angle_at=1,
                angle_label="55°",
                title="Find the Missing Length",
            ),
        },
        {
            "slug": "isosceles-angle-facts",
            "category": "Mathematics",
            "topic": "Angles in an Isosceles Triangle",
            "description": "Equal-side ticks and an unknown angle on a proportional triangle.",
            "spec": B.triangle_diagram(
                (0, 0),
                (4, 0),
                (2, 5),
                vertex_labels=("", "", ""),
                mark_angle_at=2,
                angle_label="x",
                equal_sides=(1, 2),
                title="Find the Missing Angle",
            ),
        },
        {
            "slug": "categorical-bar-chart",
            "category": "Statistics",
            "topic": "Bar Charts",
            "description": "Categorical frequency chart with a validated numeric scale.",
            "spec": B.bar_chart(
                ["Smoothie", "Juice", "Tea", "Coffee", "Milk"],
                [65, 85, 40, 45, 105],
                max_value=120,
                tick_step=20,
                x_label="Drink",
                y_label="Frequency",
                title="Favourite Drinks",
            ),
        },
        {
            "slug": "transport-pie-chart",
            "category": "Statistics",
            "topic": "Pie Charts",
            "description": "Proportional sectors with degree labels, total, colors, and legend.",
            "spec": B.pie_chart(
                ["Bus", "Walk", "Tram", "Train", "Car"],
                [6, 7, 7, 11, 9],
                label_mode="degrees",
                total_label="Total: 40 people",
                title="Modes of Transport",
            ),
        },
        {
            "slug": "transport-pictogram",
            "category": "Statistics",
            "topic": "Pictograms",
            "description": "Keyed pictogram supporting complete and fractional symbols.",
            "spec": B.pictogram(
                [
                    ("Bike", 5, "#0891b2"),
                    ("Walk", 9, "#7c3aed"),
                    ("Bus", 4, "#2563eb"),
                    ("Train", 11, "#f97316"),
                ],
                unit=2,
                key_label="1 square = 2 people",
                title="Travel Survey",
            ),
        },
        {
            "slug": "inclined-plane",
            "category": "Physics",
            "topic": "Laws of Motion",
            "description": "Free-body diagram with gravity, normal, and friction vectors.",
            "spec": B.inclined_plane_free_body(
                angle_degrees=30,
                friction_up_slope=True,
            ),
        },
        {
            "slug": "projectile-motion",
            "category": "Physics",
            "topic": "Kinematics",
            "description": "Trajectory, launch velocity, angle, peak, and range.",
            "spec": B.projectile_motion(
                speed=20,
                angle_degrees=45,
                gravity=9.8,
            ),
        },
        {
            "slug": "convex-lens",
            "category": "Physics",
            "topic": "Ray Optics",
            "description": "Principal rays for a real inverted image formed by a convex lens.",
            "spec": B.convex_lens_ray_diagram(
                focal_length=2,
                object_distance=6,
                object_height=2,
            ),
        },
    ]


def build_gallery(output_dir: Path) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    records = []
    cards = []
    for sample in sample_diagrams():
        spec = sample["spec"]
        svg = render_svg(spec)
        svg_valid, svg_issues = validate_svg(svg)
        semantic_valid, semantic_issues = validate_spec_semantics(spec)
        layout_valid, layout_issues = validate_svg_layout(svg)
        valid = svg_valid and semantic_valid and layout_valid
        issues = sorted(set(svg_issues + semantic_issues + layout_issues))
        if not valid:
            raise RuntimeError(f"{sample['slug']} failed SVG validation: {issues}")
        svg_name = f"{sample['slug']}.svg"
        (output_dir / svg_name).write_text(svg, encoding="utf-8")
        record = {
            key: value for key, value in sample.items() if key != "spec"
        }
        record["svg"] = svg_name
        record["spec"] = spec.model_dump(mode="json")
        record["validation"] = {"passed": valid, "issues": issues}
        records.append(record)
        cards.append(
            f"""
            <article class="card" data-category="{sample['category'].lower()}">
              <div class="meta"><span>{sample['category']}</span><span>{sample['topic']}</span></div>
              <h2>{sample['topic']}</h2>
              <p>{sample['description']}</p>
              <img src="/diagram-assets/{svg_name}" alt="{sample['description']}">
              <details><summary>Diagram specification</summary><pre>{json.dumps(record['spec'], indent=2, ensure_ascii=False)}</pre></details>
            </article>
            """
        )

    report = {
        "passed": all(record["validation"]["passed"] for record in records),
        "diagram_count": len(records),
        "categories": {
            "mathematics": sum(record["category"] == "Mathematics" for record in records),
            "physics": sum(record["category"] == "Physics" for record in records),
            "statistics": sum(record["category"] == "Statistics" for record in records),
        },
        "diagrams": records,
    }
    (output_dir / "gallery.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    html = _gallery_html("\n".join(cards), report)
    (output_dir / "index.html").write_text(html, encoding="utf-8")
    return report


def _gallery_html(cards: str, report: dict) -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Math and Physics Diagram Gallery</title>
  <style>
    :root {{ font-family: Inter, system-ui, sans-serif; color: #172033; background: #f3f6fb; }}
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; }}
    main {{ width: min(1240px, calc(100% - 32px)); margin: 32px auto 56px; }}
    header {{ display: flex; align-items: end; justify-content: space-between; gap: 20px; margin-bottom: 24px; }}
    h1 {{ margin: 0 0 8px; font-size: clamp(1.8rem, 4vw, 3rem); }}
    header p, .card p {{ color: #64748b; }}
    .badge {{ padding: 8px 12px; border-radius: 999px; background: #dcfce7; color: #166534; font-weight: 700; white-space: nowrap; }}
    .filters {{ display: flex; gap: 8px; margin: 18px 0; }}
    button {{ border: 1px solid #cbd5e1; background: white; padding: 8px 12px; border-radius: 8px; cursor: pointer; }}
    button.active {{ background: #1d4ed8; color: white; border-color: #1d4ed8; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; }}
    .card {{ background: white; border: 1px solid #dbe3ef; border-radius: 14px; padding: 18px; box-shadow: 0 8px 26px rgb(30 50 80 / 7%); }}
    .card h2 {{ margin: 10px 0 6px; }}
    .meta {{ display: flex; justify-content: space-between; color: #1d4ed8; font-size: .82rem; font-weight: 750; text-transform: uppercase; letter-spacing: .04em; }}
    img {{ display: block; width: 100%; min-height: 260px; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 10px; background: white; }}
    details {{ margin-top: 12px; }}
    summary {{ cursor: pointer; font-weight: 700; }}
    pre {{ overflow: auto; max-height: 280px; padding: 12px; border-radius: 8px; background: #111827; color: #dbeafe; font-size: .76rem; }}
    .hidden {{ display: none; }}
    @media (max-width: 650px) {{ header {{ align-items: start; flex-direction: column; }} .grid {{ grid-template-columns: 1fr; }} }}
  </style>
</head>
<body>
  <main>
    <header>
      <div><h1>Deterministic Diagram Gallery</h1><p>Math and physics diagrams generated from structured specifications and rendered to SVG.</p></div>
      <div class="badge">{report['diagram_count']} / {report['diagram_count']} SVGs validated</div>
    </header>
    <div class="filters">
      <button class="active" data-filter="all">All</button>
      <button data-filter="mathematics">Mathematics</button>
      <button data-filter="physics">Physics</button>
      <button data-filter="statistics">Statistics</button>
    </div>
    <section class="grid">{cards}</section>
  </main>
  <script>
    const buttons = document.querySelectorAll("[data-filter]");
    const cards = document.querySelectorAll("[data-category]");
    buttons.forEach(button => button.addEventListener("click", () => {{
      buttons.forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      const filter = button.dataset.filter;
      cards.forEach(card => card.classList.toggle("hidden", filter !== "all" && card.dataset.category !== filter));
    }}));
  </script>
</body>
</html>"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=_ROOT / "web" / "generated" / "diagram-gallery",
    )
    args = parser.parse_args()
    report = build_gallery(args.output_dir.resolve())
    print(
        f"[diagrams] generated {report['diagram_count']} validated SVGs at "
        f"{args.output_dir.resolve()}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
