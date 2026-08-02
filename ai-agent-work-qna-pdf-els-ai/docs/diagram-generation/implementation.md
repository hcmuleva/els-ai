# Implementation Guide

## 1. Purpose and Recommended Delivery

The LLM Diagram Generation Framework converts natural-language requests into deterministic, editable, validated diagrams. The recommended delivery for the current web player is **TikZ/PGFPlots as the authoritative source for mathematics and 2D physics, compiled to SVG for display**. Native SVG is appropriate for web vectors, Asymptote for 3D scientific geometry, Mermaid or PlantUML for flows and architecture, and Graphviz for graph topology.

Every successful run preserves:

1. The normalized specification.
2. The authoritative source.
3. The rendered SVG.
4. Validation results.
5. Attempt and repair history.

```text
Request -> Classification -> Specification -> Engine Selection
        -> Code Generation -> Rendering -> Validation
        -> Repair (if required, maximum three attempts) -> Export
```

Generated source is untrusted. Renderers run without network access, shell escape, or unrestricted file access and with CPU, memory, process, output-size, and wall-clock limits.

## 2. Architecture and Required Modules

### 2.1 Diagram Classifier

Classifies the request into a controlled diagram type such as `math_2d`, `physics`, `plot`, `math_3d`, `flowchart`, `sequence`, `architecture`, `graph`, or `web_vector`. It extracts required objects, labels, relationships, equations, constraints, and prohibited content without choosing coordinates.

### 2.2 Specification Builder

Converts the classification and request into schema-valid YAML. It assigns stable IDs, separates user requirements from assumptions, normalizes units and styles, resolves defaults, and rejects contradictions or unresolved references.

### 2.3 Engine Selector

Chooses an engine using deterministic rules. TikZ/PGFPlots is preferred for precise mathematical and physics content, Asymptote for 3D, native SVG for web vectors, Mermaid for simple flows, PlantUML for richer UML/architecture, and Graphviz for topology.

### 2.4 Code Generator

Consumes only a validated specification and geometry plan. It applies engine-specific prompts, allowlists, and source rules and returns one complete authoritative source artifact without placeholders.

### 2.5 Renderer

Compiles or renders source in an isolated environment. It captures the command, exit code, logs, duration, resource violations, and output artifact.

### 2.6 Validator

Runs schema, source-policy, compile, content, geometry, SVG-structure, layout, and accessibility checks. Semantic correctness takes precedence over visual polish.

### 2.7 Repair Agent

Receives the complete specification, previous source, and structured diagnostics. It returns a complete replacement source, may not weaken validation, and participates in no more than three total generation attempts.

### 2.8 Exporter

Sanitizes and optionally optimizes SVG, retains accessibility metadata and stable IDs, writes the manifest, and publishes the SVG together with the authoritative source and validation report.

### 2.9 Suggested Package Layout

```text
diagram_framework/
├── classifier.py              # Diagram Classifier
├── specification/
│   ├── builder.py             # Specification Builder
│   ├── schema.py
│   └── normalizer.py
├── engine_selector.py         # Engine Selector
├── generators/                # Code Generator adapters
│   ├── tikz.py
│   ├── svg.py
│   ├── asymptote.py
│   ├── mermaid.py
│   ├── plantuml.py
│   └── graphviz.py
├── renderer.py                # Renderer and sandbox
├── validators/                # Validator stages
│   ├── content.py
│   ├── geometry.py
│   ├── layout.py
│   ├── svg.py
│   └── accessibility.py
├── repair.py                  # Repair Agent
├── exporter.py                # Exporter
├── pipeline.py
└── artifacts.py
```

## 3. Diagram Specification

### 3.1 Concise YAML Contract

The following fields are the required public interchange contract:

```yaml
diagram_id: incline_fbd_30
diagram_type: physics
engine: tikz
title: Block on a 30-degree incline
canvas:
  width: 800
  height: 500
  units: px
  padding: 24
style:
  theme: educational
  font: "Latin Modern Roman"
  base_font_size: 14
  foreground: "#111111"
  background: "#FFFFFF"
objects:
  - id: incline
    type: line
    label: inclined surface
  - id: block
    type: rectangle
    label: m
  - id: gravity
    type: force
    label: "\\vec{W}=m\\vec{g}"
  - id: normal
    type: force
    label: "\\vec{N}"
  - id: friction
    type: force
    label: "\\vec{f}"
relationships:
  - subject: block
    predicate: rests_on
    object: incline
  - subject: normal
    predicate: perpendicular_to
    object: incline
  - subject: friction
    predicate: parallel_to
    object: incline
math:
  angle_degrees: 30
  coordinate_frame: world
  equations: []
validation_rules:
  required_objects: [incline, block, gravity, normal, friction]
  required_labels: ["30^\\circ", "\\vec{W}=m\\vec{g}", "\\vec{N}", "\\vec{f}"]
  max_label_overlap_ratio: 0
  require_inside_canvas: true
exports:
  authoritative_source: tex
  web_format: svg
  preserve_source: true
  accessible: true
```

### 3.2 Complete Schema

The canonical schema is JSON Schema Draft 2020-12 expressed as YAML:

```yaml
$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "https://example.org/schemas/diagram-spec.schema.yaml"
title: DiagramSpec
type: object
additionalProperties: false
required:
  - diagram_id
  - diagram_type
  - engine
  - title
  - canvas
  - style
  - objects
  - relationships
  - math
  - validation_rules
  - exports
properties:
  diagram_id:
    type: string
    pattern: "^[A-Za-z][A-Za-z0-9_-]{2,127}$"
  schema_version:
    type: string
    const: "1.0"
    default: "1.0"
  diagram_type:
    type: string
    enum:
      - math_2d
      - physics
      - plot
      - math_3d
      - flowchart
      - sequence
      - state
      - class
      - architecture
      - graph
      - web_vector
  engine:
    type: string
    enum: [auto, tikz, pgfplots, svg, asymptote, mermaid, plantuml, graphviz]
  title:
    type: string
    minLength: 1
    maxLength: 200
  intent:
    type: object
    additionalProperties: false
    properties:
      summary: {type: string}
      required_content:
        type: array
        uniqueItems: true
        items: {type: string}
      prohibited_content:
        type: array
        uniqueItems: true
        items: {type: string}
      assumptions:
        type: array
        items: {type: string}
  canvas:
    type: object
    additionalProperties: false
    required: [width, height, units, padding]
    properties:
      width: {type: number, exclusiveMinimum: 0}
      height: {type: number, exclusiveMinimum: 0}
      units: {type: string, enum: [px, pt, mm, cm, in, unitless]}
      padding: {type: number, minimum: 0}
      background: {$ref: "#/$defs/color"}
      responsive: {type: boolean, default: true}
      view_box: {$ref: "#/$defs/rectangle"}
  style:
    type: object
    additionalProperties: false
    required: [theme, font, base_font_size, foreground, background]
    properties:
      theme: {type: string, enum: [educational, technical, minimal, presentation, custom]}
      font: {type: string, minLength: 1}
      base_font_size: {type: number, exclusiveMinimum: 0}
      foreground: {$ref: "#/$defs/color"}
      background: {$ref: "#/$defs/color"}
      accent_colors:
        type: array
        maxItems: 12
        items: {$ref: "#/$defs/color"}
      default_stroke_width: {type: number, exclusiveMinimum: 0}
      arrow_tip: {type: string, enum: [latex, stealth, triangle, none]}
      color_blind_safe: {type: boolean, default: true}
  objects:
    type: array
    minItems: 1
    items: {$ref: "#/$defs/object"}
  relationships:
    type: array
    items: {$ref: "#/$defs/relationship"}
  math:
    type: object
    additionalProperties: false
    properties:
      coordinate_frame: {type: string}
      angle_degrees: {type: number}
      equations:
        type: array
        items: {type: string}
      variables:
        type: object
        additionalProperties: {type: [number, string]}
      domain:
        type: object
        additionalProperties: false
        properties:
          min: {type: number}
          max: {type: number}
      units: {type: string}
  validation_rules:
    type: object
    additionalProperties: false
    properties:
      required_objects:
        type: array
        uniqueItems: true
        items: {type: string}
      required_labels:
        type: array
        uniqueItems: true
        items: {type: string}
      forbidden_text:
        type: array
        uniqueItems: true
        items: {type: string}
      max_label_overlap_ratio: {type: number, minimum: 0, maximum: 1, default: 0}
      min_text_size: {type: number, exclusiveMinimum: 0}
      min_contrast_ratio: {type: number, minimum: 1, maximum: 21, default: 4.5}
      require_inside_canvas: {type: boolean, default: true}
  exports:
    type: object
    additionalProperties: false
    required: [authoritative_source, web_format, preserve_source]
    properties:
      authoritative_source:
        type: string
        enum: [tex, svg, asy, mmd, puml, dot]
      web_format: {type: string, const: svg}
      preserve_source: {type: boolean, const: true}
      optimize_svg: {type: boolean, default: true}
      accessible: {type: boolean, default: true}
      include_metadata: {type: boolean, default: true}
  accessibility:
    type: object
    additionalProperties: false
    properties:
      title: {type: string, minLength: 1}
      description: {type: string, minLength: 1}
      reading_order:
        type: array
        uniqueItems: true
        items: {type: string}
      decorative_objects:
        type: array
        uniqueItems: true
        items: {type: string}
$defs:
  color:
    type: string
    pattern: "^(#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{8}|transparent|none)$"
  point:
    type: object
    additionalProperties: false
    required: [x, y]
    properties:
      x: {type: number}
      y: {type: number}
      z: {type: number}
  vector:
    type: object
    additionalProperties: false
    required: [x, y]
    properties:
      x: {type: number}
      y: {type: number}
      z: {type: number}
  rectangle:
    type: object
    additionalProperties: false
    required: [x, y, width, height]
    properties:
      x: {type: number}
      y: {type: number}
      width: {type: number, exclusiveMinimum: 0}
      height: {type: number, exclusiveMinimum: 0}
  objectStyle:
    type: object
    additionalProperties: false
    properties:
      stroke: {$ref: "#/$defs/color"}
      fill: {$ref: "#/$defs/color"}
      stroke_width: {type: number, minimum: 0}
      opacity: {type: number, minimum: 0, maximum: 1}
      font_size: {type: number, exclusiveMinimum: 0}
      font_weight: {type: string, enum: [normal, medium, semibold, bold]}
      text_anchor: {type: string, enum: [start, middle, end]}
  label:
    oneOf:
      - type: string
      - type: object
        additionalProperties: false
        required: [text]
        properties:
          text: {type: string, minLength: 1}
          position: {$ref: "#/$defs/point"}
          anchor:
            type: string
            enum: [center, north, north_east, east, south_east, south, south_west, west, north_west]
          offset: {$ref: "#/$defs/vector"}
          math: {type: boolean, default: false}
          rotate_degrees: {type: number}
  object:
    type: object
    additionalProperties: false
    required: [id, type]
    properties:
      id:
        type: string
        pattern: "^[A-Za-z][A-Za-z0-9_-]{1,127}$"
      type:
        type: string
        enum: [point, line, path, rectangle, circle, ellipse, polygon, text, force, angle, node, edge, plot, group]
      role: {type: string}
      label: {$ref: "#/$defs/label"}
      position: {$ref: "#/$defs/point"}
      start: {$ref: "#/$defs/point"}
      end: {$ref: "#/$defs/point"}
      points:
        type: array
        minItems: 2
        items: {$ref: "#/$defs/point"}
      direction: {$ref: "#/$defs/vector"}
      magnitude: {type: number, exclusiveMinimum: 0}
      width: {type: number, exclusiveMinimum: 0}
      height: {type: number, exclusiveMinimum: 0}
      radius: {type: number, exclusiveMinimum: 0}
      rotation_degrees: {type: number}
      expression: {type: string}
      style: {$ref: "#/$defs/objectStyle"}
      semantic_tags:
        type: array
        uniqueItems: true
        items: {type: string}
      z_index: {type: integer, default: 0}
  relationship:
    type: object
    additionalProperties: false
    required: [subject, predicate, object]
    properties:
      id: {type: string}
      subject: {type: string}
      predicate:
        type: string
        enum: [connected_to, contains, rests_on, attached_to, parallel_to, perpendicular_to, aligned_with, points_to, acts_on, precedes, depends_on, overlaps, non_overlapping]
      object: {type: string}
      value: {type: [number, string, boolean]}
      priority: {type: string, enum: [required, preferred], default: required}
```

The normalizer additionally enforces uniqueness of object IDs, valid cross-references, required dimensions for shapes, valid edge endpoints, accessibility references, and compatibility between diagram type and fixed engine.

## 4. Engine Selection

### 4.1 Required Concise Pseudocode

```python
def select_engine(diagram_type):
    if diagram_type in ["math_2d", "physics"]:
        return "tikz"
    if diagram_type == "plot":
        return "pgfplots"
    if diagram_type == "math_3d":
        return "asymptote"
    if diagram_type in ["flowchart", "sequence", "state", "class"]:
        return "mermaid"
    if diagram_type == "architecture":
        return "plantuml"
    if diagram_type == "graph":
        return "graphviz"
    return "svg"
```

### 4.2 Extended Selector

```python
def select_engine_for_spec(spec):
    if spec["engine"] != "auto":
        assert_engine_compatible(spec["engine"], spec["diagram_type"])
        return spec["engine"]

    engine = select_engine(spec["diagram_type"])

    if engine == "mermaid" and estimate_topology_complexity(spec) > 40:
        return "plantuml"
    if any(obj["type"] == "plot" for obj in spec["objects"]):
        return "pgfplots"
    if any(obj["type"] in {"force", "angle"} for obj in spec["objects"]):
        return "tikz"
    return engine
```

The deterministic selector is authoritative. An LLM review is optional only for mixed diagrams and may reject a decision solely for a concrete feature incompatibility.

## 5. Prompt Chain

All calls use low temperature and schema-constrained output where available.

### A. Classifier

**System prompt**

```text
You are the Diagram Classifier. Classify the request into one controlled
diagram_type. Extract required objects, labels, relationships, quantities,
units, directions, and prohibited content. Do not choose an engine, coordinates,
or rendering syntax. Do not invent optional content. Output JSON only.
```

**User template**

```text
REQUEST:
{{user_request}}

Return:
{
  "diagram_type": "...",
  "summary": "...",
  "required_content": [],
  "prohibited_content": [],
  "quantities": [],
  "assumptions": []
}
```

### B. Specification Builder

**System prompt**

```text
You are the Specification Builder. Convert the request and classification into
DiagramSpec YAML 1.0. Preserve every explicit requirement. Assign stable IDs,
declare relationships, coordinate frames, validation rules, accessibility text,
and exports. Separate assumptions from requirements. Do not generate source.
Output one schema-valid YAML document only.
```

**User template**

```text
REQUEST:
{{user_request}}

CLASSIFICATION:
{{classification_json}}

SCHEMA:
{{diagram_spec_schema}}

Return complete DiagramSpec YAML.
```

After schema validation, a geometry-planning pass assigns explicit coordinates, anchors, label offsets, estimated bounding boxes, and verified constraints. It may not add or remove semantic objects.

### C. Code Generator

**System prompt**

```text
You are the Code Generator for {{engine}}. Generate one complete, compilable
source document. Implement every required object and no prohibited object.
Follow the geometry plan exactly. Use stable identifiers and only allowlisted
features. Do not use external URLs, external files, scripts, shell escape,
placeholders, or ellipses. Return exactly one fenced source block and no prose.
```

**User template**

```text
DIAGRAMSPEC:
{{normalized_spec_yaml}}

GEOMETRY PLAN:
{{geometry_plan_json}}

ENGINE RULES:
{{engine_rules}}

ALLOWLIST:
{{allowlist}}
```

### D. Validator

**System prompt**

```text
You are the Validator. Compare the specification, geometry plan, source, render
metadata, and deterministic validation results. Do not judge style subjectively.
Identify only verifiable schema, content, geometry, compile, layout, security,
or accessibility defects. Do not propose removing required content. Output
structured JSON only.
```

**User template**

```text
DIAGRAMSPEC:
{{normalized_spec_yaml}}

GEOMETRY PLAN:
{{geometry_plan_json}}

SOURCE:
{{source_code}}

RENDER METADATA:
{{render_metadata_json}}

DETERMINISTIC CHECKS:
{{validation_results_json}}
```

### E. Repair

**System prompt**

```text
You are the Repair Agent for {{engine}}. Repair the complete source using the
structured diagnostics. Preserve all correct content and requirements. Do not
weaken validators, remove required objects, or use features outside the
allowlist. Return a complete replacement source, not a patch. Return exactly
one fenced source block and no prose.
```

**User template**

```text
ATTEMPT: {{attempt_number}} of 3
DIAGRAMSPEC: {{normalized_spec_yaml}}
GEOMETRY PLAN: {{geometry_plan_json}}
FAILED SOURCE: {{source_code}}
DIAGNOSTICS: {{diagnostics_json}}
ENGINE RULES: {{engine_rules}}
```

## 6. Strict Engine Rules

### 6.1 TikZ and PGFPlots

1. **Standalone:** use `\documentclass[tikz,border=<dimension>]{standalone}` with exactly one document environment and at least one `tikzpicture`.
2. **Libraries:** declare all required packages and `\usetikzlibrary` entries explicitly. Use only allowlisted libraries, such as `arrows.meta`, `calc`, `angles`, `quotes`, `positioning`, and `matrix`.
3. **Explicit coordinates:** derive every geometric point from the geometry plan. Do not depend on visually guessed placement.
4. **Named nodes:** assign stable, semantic names to objects and reusable coordinates.
5. **Anchors:** use explicit anchors (`north`, `south east`, `anchor=west`) for labels and connections.
6. **Spacing:** set `inner sep` and `outer sep` explicitly for layout-sensitive nodes.
7. **Dimensions:** set `minimum width` and `minimum height` for boxes that must have stable sizes.
8. **Text alignment:** use `align=center` for multiline centered labels.
9. **Text wrapping:** use explicit `text width` for bounded multiline content.
10. **Font:** declare an explicit base `font` and use math mode for variables, vectors, angles, and equations.
11. **Offsets:** use explicit `xshift`, `yshift`, or coordinate-vector offsets so labels do not overlap geometry.
12. **Relative positioning:** when node topology is primary, use the positioning library and forms such as `right=of <node>` instead of arbitrary invisible spacing.
13. **Matrices:** use TikZ `matrix` for grid or table-like arrangements rather than manually approximated rows and columns.
14. **PGFPlots axis:** place plots in an explicit `axis` environment with pinned `compat`, declared width, height, axis limits, labels, units, domains, and sample count.
15. Use `arrows.meta` and an allowlisted arrow tip such as `Latex`.
16. Keep world-space forces outside rotated scopes unless transformation is intentional. Gravity remains world-vertical, normal is perpendicular to contact, and friction is tangent to contact.
17. Free-body force arrows originate at the object center unless a contact-point representation is specified.
18. Do not place labels on arrow shafts or rotate ordinary text unnecessarily.
19. Compile with `-no-shell-escape`; prohibit externalization and unrestricted file access.

Reject non-allowlisted uses of:

```text
\write18
\immediate
\openin
\openout
\input
\include
\includegraphics
\usepackage{shellesc}
\usetikzlibrary{external}
\tikzexternalize
```

### 6.2 Native SVG

1. Set an explicit `viewBox`; width and height, when present, must be positive.
2. Include direct-child `<title>` and `<desc>` elements and reference them with `aria-labelledby`.
3. Use stable IDs derived from object IDs and semantic `<g>` groups.
4. Use primitives rather than embedded raster images.
5. Put reusable markers, gradients, and clips in `<defs>` with artifact-unique IDs.
6. Keep text as text unless path conversion is explicitly requested.
7. Preserve logical DOM reading order and accessible contrast.
8. Keep all labels and arrowheads inside the padded view box.
9. Prohibit scripts, event handlers, `foreignObject`, external resources, and network or file URLs.
10. SVG optimization may not remove accessibility metadata, semantic IDs, or required text.

The sanitizer rejects `<script>`, `<foreignObject>`, `onload=`, `onclick=`, `javascript:`, `http:`, `https:`, and `file:`.

### 6.3 Mermaid

1. Begin with an explicit supported declaration such as `flowchart LR`.
2. Use stable ASCII IDs separated from quoted human-readable labels.
3. Declare every node by first use and preserve edge direction.
4. Select `LR` or `TD` from the expected aspect ratio.
5. Use subgraphs only for semantic groups.
6. Prohibit click directives, external links, unsafe initialization directives, and raw HTML.
7. Limit classes to allowlisted colors and line styles.
8. Render with a pinned Mermaid CLI in a network-disabled sandbox.

### 6.4 PlantUML

1. Enclose source in `@startuml` and `@enduml`.
2. Use stable aliases for participants, components, and nodes.
3. Set direction explicitly when layout matters.
4. Use component/deployment semantics only when requested.
5. Prohibit `!include`, `!includeurl`, external sprites, external resources, and unrestricted preprocessing.
6. Use a pinned JAR or container and a restrictive security profile with network disabled.

### 6.5 Graphviz and Asymptote

Graphviz must use `digraph` for directed relationships, quote IDs and labels safely, select the layout engine explicitly, preserve edge direction, and prohibit URL/image/external-file attributes. Asymptote must use explicit cameras, projections, bounds, and allowlisted modules, with no external file or process access.

## 7. Rendering

Recommended TikZ pipeline:

```text
diagram.tex -> latexmk/pdflatex -> diagram.pdf -> dvisvgm -> diagram.svg
             -> SVG sanitizer -> optional safe optimizer -> Exporter
```

```powershell
latexmk -pdf -halt-on-error -interaction=nonstopmode -no-shell-escape diagram.tex
dvisvgm --pdf --page=1 --exact --output=diagram.svg diagram.pdf
```

Other adapters:

```text
Asymptote: source.asy -> asy -> PDF/SVG -> sanitized SVG
Mermaid:   source.mmd -> pinned mmdc -> sanitized SVG
PlantUML:  source.puml -> pinned PlantUML -> sanitized SVG
Graphviz:  source.dot -> pinned dot/neato -Tsvg -> sanitized SVG
SVG:       source.svg -> sanitizer -> safe optimizer -> validated SVG
```

Suggested per-attempt sandbox limits are 30 seconds, two CPU cores, 512 MB memory, 64 processes, 1 MB source, and 10 MB output. The workspace is ephemeral, network is disabled, and system files are read-only.

## 8. Validation

Validation order is:

```text
Schema -> Source Policy -> Content -> Geometry -> Compile
       -> SVG Structure -> Layout -> Accessibility
```

### 8.1 Compile Validation

A render passes only when the process exits with zero, expected output exists and is non-empty, no timeout or resource limit occurs, no fatal log pattern appears, exactly one page is emitted unless requested otherwise, and the resulting SVG parses.

### 8.2 Content and Geometry Validation

Checks include:

- Every required object and label exists.
- Prohibited objects and text are absent.
- Relationship endpoints resolve and edge directions match.
- Quantities, equations, units, plot expressions, and domains match the specification.
- Force and angle directions pass numeric validation.
- Repair did not remove valid required content.

```python
assert abs(incline_angle_degrees - 30.0) <= 0.5
assert angular_error(gravity_vector, Vector(0, -1)) <= 1.0
assert abs(dot(normal_vector, incline_tangent)) <= 1e-6
assert abs(cross_2d(friction_vector, incline_tangent)) <= 1e-6
```

### 8.3 SVG Validation

Require a valid `<svg>` root, finite numeric geometry, a non-empty `viewBox`, unique IDs, resolved local references, no script or external resource, and at least one visible element.

### 8.4 Layout Validation

Rendered bounding boxes must show:

- No clipped text or arrowheads.
- No object outside the padded canvas.
- No label-label overlap beyond the configured ratio.
- No label obscuring an unrelated line, arrowhead, or node.
- No connector crossing an unrelated node.
- Labels closest to their intended object.
- Minimum text size and contrast.
- No excessive unused canvas.

```python
def overlap_ratio(a, b):
    intersection = area(intersect(a, b))
    return 0.0 if intersection == 0 else intersection / min(area(a), area(b))
```

### 8.5 Accessibility Validation

Require a title, relational description, valid reading order, 4.5:1 minimum normal-text contrast, and no meaning conveyed solely by color. Preserve text as text unless explicitly converted.

### 8.6 Diagnostic Contract

```json
{
  "passed": false,
  "stage": "layout",
  "errors": [
    {
      "code": "LABEL_OVERLAP",
      "severity": "error",
      "object_ids": ["gravity", "friction"],
      "message": "Label bounding boxes overlap by 18%.",
      "expected": "Overlap ratio <= 0.",
      "actual": "0.18",
      "repair_hint": "Move the gravity label to the right of its arrow."
    }
  ],
  "warnings": [],
  "metrics": {
    "compile_seconds": 0.82,
    "label_overlap_count": 1,
    "out_of_bounds_count": 0
  }
}
```

## 9. Maximum-Three-Attempt Repair Loop

Three attempts means one initial generation and at most two repairs:

```python
MAX_ATTEMPTS = 3

for attempt in range(1, MAX_ATTEMPTS + 1):
    source = (
        generate_code(spec, engine, geometry)
        if attempt == 1
        else repair_diagram(spec, engine, geometry, source, diagnostics, attempt)
    )
    policy = validate_source_policy(source, engine)
    if not policy.passed:
        diagnostics = policy
        continue
    artifact = render_diagram(source, engine)
    diagnostics = validate_diagram(spec, geometry, source, artifact)
    if diagnostics.passed:
        return export_diagram(spec, source, artifact, diagnostics)

raise DiagramGenerationError("Diagram failed after three attempts", diagnostics)
```

Failures are classified as schema, policy, syntax, dependency, content, geometry, layout, or accessibility errors. The repair receives minimal structured diagnostics plus the complete specification and source. Failed attempts are retained for diagnosis.

## 10. Python Implementation Skeleton

```python
from dataclasses import dataclass
from pathlib import Path

MAX_ATTEMPTS = 3


@dataclass(frozen=True)
class RenderResult:
    passed: bool
    artifact_path: Path | None
    stdout: str
    stderr: str
    exit_code: int


@dataclass(frozen=True)
class ValidationResult:
    passed: bool
    stage: str
    errors: list[dict]
    warnings: list[dict]


def classify_diagram(request: str, llm) -> dict:
    response = llm.generate(
        template="classifier",
        variables={"user_request": request},
    )
    return parse_and_validate_classification(response)


def generate_spec(request: str, classification: dict, llm) -> dict:
    response = llm.generate(
        template="specification_builder",
        variables={"request": request, "classification": classification},
    )
    spec = parse_yaml(response)
    validate_schema(spec)
    validate_cross_references(spec)
    return normalize_spec(spec)


def generate_code(spec: dict, engine: str, geometry: dict, llm) -> str:
    response = llm.generate(
        template="code_generator",
        variables={
            "spec": spec,
            "engine": engine,
            "geometry": geometry,
            "engine_rules": load_engine_rules(engine),
        },
    )
    return extract_single_source_block(response)


def render_diagram(source: str, engine: str, sandbox) -> RenderResult:
    validate_source_policy(source, engine).raise_for_errors()
    return sandbox.render(
        engine=engine,
        source=source,
        network=False,
        timeout_seconds=30,
        memory_mb=512,
    )


def validate_diagram(
    spec: dict,
    geometry: dict,
    source: str,
    render: RenderResult,
    validators,
) -> ValidationResult:
    if not render.passed:
        return classify_render_failure(render)
    results = [
        validator.validate(spec, geometry, source, render.artifact_path)
        for validator in validators
    ]
    return combine_validation_results(results)


def repair_diagram(
    spec: dict,
    engine: str,
    geometry: dict,
    source: str,
    diagnostics: ValidationResult,
    attempt: int,
    llm,
) -> str:
    response = llm.generate(
        template="repair",
        variables={
            "attempt": attempt,
            "spec": spec,
            "engine": engine,
            "geometry": geometry,
            "source": source,
            "diagnostics": diagnostics,
        },
    )
    return extract_single_source_block(response)


def run_pipeline(request: str, services) -> dict:
    classification = classify_diagram(request, services.llm)
    spec = generate_spec(request, classification, services.llm)
    engine = select_engine_for_spec(spec)
    geometry = services.geometry_planner.plan(spec, engine)
    source = ""
    diagnostics = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        source = (
            generate_code(spec, engine, geometry, services.llm)
            if attempt == 1
            else repair_diagram(
                spec,
                engine,
                geometry,
                source,
                diagnostics,
                attempt,
                services.llm,
            )
        )
        render = render_diagram(source, engine, services.sandbox)
        diagnostics = validate_diagram(
            spec,
            geometry,
            source,
            render,
            services.validators,
        )
        services.artifacts.record_attempt(attempt, source, diagnostics)
        if diagnostics.passed:
            return services.exporter.export(spec, source, render, diagnostics)

    raise RuntimeError("Diagram failed after three attempts")
```

## 11. Complete TikZ Example: Block on a 30-Degree Incline

This example is self-contained and compilable. The block is aligned with the incline, gravity is world-vertical, normal is perpendicular to the incline, friction points up the incline, and labels use explicit non-overlapping coordinates.

```latex
\documentclass[tikz,border=8pt]{standalone}

\usepackage{amsmath}
\usetikzlibrary{arrows.meta,calc,angles,quotes}

\begin{document}
\begin{tikzpicture}[
    line cap=round,
    line join=round,
    force/.style={-{Latex[length=3.2mm,width=2.2mm]}, very thick},
    surface/.style={line width=1.1pt},
    block/.style={
        draw=black,
        line width=1pt,
        fill=blue!12,
        minimum width=1.6cm,
        minimum height=1.28cm,
        inner sep=2pt,
        outer sep=0pt,
        align=center,
        text width=1.2cm,
        font=\small
    },
    angle mark/.style={draw=black, line width=0.8pt},
    every node/.style={font=\small}
]

\coordinate (O) at (0,0);
\coordinate (H) at (6.20,0);
\coordinate (T) at ({6.20*cos(30)},{6.20*sin(30)});

\draw[surface] (-0.45,0) -- (6.15,0);
\draw[surface] (O) -- (T);

\foreach \s in {0.45,0.90,...,5.85} {
    \coordinate (S) at ({\s*cos(30)},{\s*sin(30)});
    \draw[gray!65, line width=0.45pt] (S) -- ++(-70:0.22);
}

\coordinate (BlockCenter) at (
    {3.35*cos(30)-0.72*sin(30)},
    {3.35*sin(30)+0.72*cos(30)}
);
\node[block, rotate=30] (Block) at (BlockCenter) {$m$};

\coordinate (AngleHorizontal) at (1.25,0);
\coordinate (AngleIncline) at ({1.25*cos(30)},{1.25*sin(30)});
\pic[angle mark, angle radius=0.78cm]
    {angle=AngleHorizontal--O--AngleIncline};
\node[anchor=center] at (0.98,0.27) {$30^\circ$};

\coordinate (GravityEnd) at ($(BlockCenter)+(0,-2.15)$);
\draw[force, red!75!black] (BlockCenter) -- (GravityEnd);
\node[anchor=west, text=red!75!black]
    at ($(GravityEnd)+(0.12,0.12)$) {$\vec{W}=m\vec{g}$};

\coordinate (NormalEnd) at ($(BlockCenter)+(120:1.90)$);
\draw[force, blue!70!black] (BlockCenter) -- (NormalEnd);
\node[anchor=south east, text=blue!70!black]
    at ($(NormalEnd)+(-0.08,0.10)$) {$\vec{N}$};

\coordinate (FrictionEnd) at ($(BlockCenter)+(30:1.75)$);
\draw[force, orange!85!black] (BlockCenter) -- (FrictionEnd);
\node[anchor=south west, text=orange!85!black]
    at ($(FrictionEnd)+(0.08,0.10)$) {$\vec{f}$};

\fill[black] (BlockCenter) circle[radius=1.2pt];

\node[rotate=30, anchor=south] at (4.95,2.98) {inclined surface};

\end{tikzpicture}
\end{document}
```

## 12. Artifacts and Observability

```text
artifacts/{request_id}/
├── request.json
├── diagram-spec.yaml
├── geometry-plan.json
├── source/diagram.tex
├── rendered/diagram.svg
├── validation/attempt-1.json
├── validation/final.json
└── manifest.json
```

Record the request ID, schema and prompt versions, model, engine decision, compiler/container digest, attempt count, failure classes, durations, token usage, source and artifact checksums, and inferred assumptions. Confidential prompts must not appear in unrestricted logs.

## 13. CI/CD

### 13.1 GitHub Actions

```yaml
name: Diagram Framework Validation

on:
  pull_request:
    paths:
      - "diagram_framework/**"
      - "schemas/**"
      - "tests/diagrams/**"
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip

      - name: Install Python dependencies
        run: |
          python -m pip install --upgrade pip
          python -m pip install -r requirements.txt -r requirements-dev.txt

      - name: Install rendering tools
        run: |
          sudo apt-get update
          sudo apt-get install --yes latexmk texlive-latex-base \
            texlive-latex-extra texlive-pictures dvisvgm graphviz

      - name: Validate schema
        run: python -m pytest tests/specification -q

      - name: Run unit tests
        run: python -m pytest tests/unit -q

      - name: Compile golden diagrams
        run: python -m pytest tests/diagrams/test_golden_compilation.py -q

      - name: Validate content, layout, security, and accessibility
        run: python -m pytest tests/validators -q

      - name: Upload failed artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: failed-diagram-artifacts
          path: .test-artifacts/
          if-no-files-found: ignore
          retention-days: 7
```

Production should replace mutable package installation with a rendering image pinned by digest.

### 13.2 Azure DevOps Equivalent

```yaml
trigger:
  branches:
    include: [main]
  paths:
    include:
      - diagram_framework/*
      - schemas/*
      - tests/diagrams/*

pool:
  vmImage: ubuntu-latest

steps:
  - checkout: self
    clean: true
  - task: UsePythonVersion@0
    inputs:
      versionSpec: "3.12"
  - script: |
      python -m pip install --upgrade pip
      python -m pip install -r requirements.txt -r requirements-dev.txt
    displayName: Install dependencies
  - script: |
      sudo apt-get update
      sudo apt-get install --yes latexmk texlive-latex-base \
        texlive-latex-extra texlive-pictures dvisvgm graphviz
    displayName: Install renderers
  - script: python -m pytest tests/specification tests/unit -q
    displayName: Validate schema and units
  - script: python -m pytest tests/diagrams tests/validators -q
    displayName: Compile and validate diagrams
  - task: PublishPipelineArtifact@1
    condition: failed()
    inputs:
      targetPath: "$(System.DefaultWorkingDirectory)/.test-artifacts"
      artifact: failed-diagram-artifacts
```

Golden fixtures cover 2D mathematics, the incline free-body diagram, PGFPlots, native SVG, Asymptote 3D, Mermaid, PlantUML, Graphviz, compiler failures, overlap and clipping, prohibited references, successful repair, and exhaustion after attempt three.

## 14. Acceptance Criteria

### Specification

- Every request becomes schema-valid DiagramSpec YAML containing the required public fields.
- Duplicate IDs, unresolved references, invalid dimensions, and contradictions are rejected.
- Normalization preserves explicit requirements and records inferred assumptions separately.

### Architecture and Routing

- All eight required modules have defined contracts and are independently testable.
- Engine selection follows deterministic rules.
- TikZ/PGFPlots is selected for 2D mathematics and physics, Asymptote for 3D, SVG for web vectors, and flow/topology engines according to their semantics.
- Incompatible fixed-engine requests fail with actionable diagnostics.

### Generation and Security

- Every engine emits complete source without placeholders.
- Authoritative source is preserved and the web artifact is SVG.
- TikZ and Asymptote sources compile independently.
- Source-policy checks reject executable directives, external resources, and non-allowlisted features.
- Rendering has no network or shell escape and runs under resource limits.

### Semantic Correctness

- Every required object, label, relationship, quantity, and equation is present.
- Prohibited content is absent.
- Force directions, angles, edges, plot expressions, and domains pass numeric validation.
- The incline example compiles and contains the 30-degree incline, block, gravity, normal, friction, and angle label.

### Layout and Accessibility

- No required content leaves the padded canvas.
- Text and arrowheads are not clipped.
- Labels do not overlap or obscure unrelated geometry.
- Text meets configured size and contrast thresholds.
- Every SVG contains an accessible title, relational description, and logical reading order.
- Meaning is not conveyed solely by color.

### Repair

- The framework performs no more than three total attempts.
- Every repair receives structured diagnostics and returns a complete source.
- Repair preserves valid required content and cannot weaken validation.
- Exhausted attempts return diagnostics and retained failure artifacts.

### Export and CI/CD

- The Exporter emits sanitized SVG, authoritative source, normalized specification, manifest, and validation report.
- Schema, unit, compile, content, geometry, layout, security, and accessibility tests run in CI.
- Golden artifacts compile reproducibly with pinned dependencies.
- Required validation failures fail CI, and failed artifacts are retained for diagnosis.

### Performance and Reproducibility

- A non-LLM render attempt finishes within the configured 30-second limit.
- A successful request finishes within three attempts.
- Source and output remain below configured size limits.
- Identical normalized input, model version, prompt version, and toolchain produce semantically equivalent output.
