# LLM Diagram Generation Framework

## Purpose

This framework defines a deterministic, implementation-ready workflow for generating technical diagrams with an LLM. It supports mathematical, scientific, physics, architecture, topology, and web-specific vector diagrams while preserving editable source, validation evidence, and reproducible exports.

The governing pipeline is:

> **Specification → Code → Compile/Render → Validate → Repair → Export**

See the [Implementation Guide](implementation.md) for schemas, prompts, engine rules, validation contracts, repair orchestration, and CI/CD examples.

## Recommendation for This Repository

Use **TikZ/PGFPlots as the authoritative source for mathematics, physics, and scientific diagrams**, then compile and export the result to SVG for this repository's web player. Use **native SVG** when a diagram is specifically designed for web interaction, responsive behavior, or custom vector effects. Use Asymptote for advanced 3D and Mermaid, PlantUML, or Graphviz for flows and topology.

## Problem Statement

Natural-language requests rarely define every coordinate, relationship, label position, or rendering constraint needed for a correct technical diagram. Direct image generation can introduce incorrect geometry, missing values, overlapping labels, inconsistent notation, and assets that cannot be repaired predictably.

The framework addresses this by:

1. Converting the request into an explicit diagram specification.
2. Selecting an engine appropriate to the diagram domain.
3. Generating deterministic, versionable source code.
4. Compiling or rendering that source in a controlled environment.
5. Validating syntax, completeness, geometry, semantics, and layout.
6. Repairing defects in the authoritative source.
7. Exporting a web-compatible asset while retaining its source and report.

## Core Pipeline

```text
User request
    │
    ▼
Structured specification
    │
    ▼
Engine classification
    │
    ▼
Deterministic source generation
    │
    ▼
Compile or render
    │
    ▼
Programmatic and visual validation
    │
    ├── defects found ──► targeted source repair ──► re-render
    │
    ▼
SVG export
    │
    ▼
Web-player integration
```

Each run should produce:

- A normalized specification containing all requested objects, labels, values, and constraints.
- Authoritative source code in the selected engine.
- A rendered preview or final asset.
- A validation report containing errors, warnings, and repair history.
- An SVG export when the consuming target is the repository's web player.

## Engine Matrix

| Diagram category | Authoritative engine | Typical output | Use when |
|---|---|---|---|
| Mathematics and geometry | TikZ | SVG | Coordinates, constructions, proofs, labeled geometric figures |
| Physics and engineering | TikZ | SVG | Free-body diagrams, vectors, rays, circuits, mechanics |
| Scientific plots | PGFPlots | SVG | Functions, datasets, axes, regions, and quantitative annotations |
| Advanced 3D | Asymptote | SVG | Surfaces, solids, spatial geometry, and complex 3D relationships |
| Web-specific vectors | Native SVG | SVG | Responsive or interactive diagrams requiring stable DOM IDs |
| Flows and sequences | Mermaid or PlantUML | SVG | Processes, sequences, states, and architecture flows |
| Graphs and topology | Graphviz | SVG | Trees, networks, dependency graphs, and directed topology |

### Selection Rules

1. Default to TikZ/PGFPlots for mathematical, physics, engineering, and scientific content.
2. Choose native SVG for web-specific rendering or interaction requirements.
3. Choose Asymptote when advanced 3D modeling is central to the request.
4. Choose Mermaid or PlantUML for semantic process and architecture diagrams.
5. Choose Graphviz when graph connectivity is more important than fixed geometry.
6. Keep the selected engine stable during repair unless it cannot represent a required feature.

## Ten-Step Workflow

### 1. Capture the Request

Collect the topic, diagram type, required objects, labels, values, preferred output, audience, and quality rules. Preserve mathematical notation and units exactly.

### 2. Resolve Material Ambiguity

Identify missing information that affects correctness, such as coordinate systems, force direction, graph scale, topology direction, or 3D viewpoint. Do not invent values that change the requested meaning.

### 3. Generate the Specification

Normalize the request into named objects, relationships, labels, values, styles, constraints, and output requirements. Assign stable identifiers to important elements.

### 4. Classify the Diagram

Select the rendering engine from the engine matrix and record the decision in the specification.

### 5. Generate Authoritative Source

Produce complete source with explicit dimensions, coordinates, anchors, layers, styles, values, and labels. Do not emit pseudocode or placeholders.

### 6. Compile or Render

Invoke the selected engine, capture its diagnostics, and store the rendered result under `outputs/rendered/`.

### 7. Validate Programmatically

Check compilation status, required objects, labels, values, output bounds, valid SVG structure, and engine-specific constraints.

### 8. Validate Visually and Semantically

Inspect readability, overlap, clipping, alignment, direction, scale, mathematical correctness, and domain relationships.

### 9. Repair and Re-render

Translate each defect into a targeted source edit. Preserve correct content, then repeat rendering and validation.

### 10. Export and Integrate

Export the accepted diagram to SVG, retain its authoritative source and validation report, and verify it renders correctly in the web player.

## Quality Checklist

### Required Acceptance Checks

- [ ] Code compiles without errors.
- [ ] No placeholders remain.
- [ ] All requested values are included.
- [ ] Labels and objects do not overlap.

### Specification

- [ ] Every required object and relationship is explicit.
- [ ] Every required label, value, unit, and annotation is explicit.
- [ ] Coordinate systems, scales, and conventions are defined where relevant.
- [ ] The selected engine matches the diagram category.
- [ ] The preferred output and target consumer are recorded.

### Source and Render

- [ ] Coordinates, dimensions, anchors, and styles are deterministic.
- [ ] Mathematical notation is encoded correctly.
- [ ] Important elements have stable names or IDs where supported.
- [ ] No required content is clipped or outside the canvas.
- [ ] Lines, arrows, markers, fills, and text remain legible at target size.
- [ ] The authoritative source is retained with the rendered asset.

### Semantic Accuracy

- [ ] Geometry satisfies the specification.
- [ ] Vectors begin at the correct origins and point in the correct directions.
- [ ] Axes, plotted values, scales, and units are correct.
- [ ] Flow direction or graph topology matches the specification.
- [ ] Styling does not imply false quantitative relationships.

### Export

- [ ] SVG output is valid and non-empty.
- [ ] The SVG has a suitable `viewBox`.
- [ ] Text, symbols, arrow markers, and clipping paths render correctly.
- [ ] The SVG displays correctly in the repository's web player.
- [ ] The specification, source, render, and report are traceable as one run.

## Folder Structure

```text
llm-diagram-framework/
├── README.md
├── implementation.md
├── prompts/
│   ├── diagram-classifier.prompt.md
│   ├── tikz-generator.prompt.md
│   ├── svg-generator.prompt.md
│   ├── validator.prompt.md
│   └── repair.prompt.md
├── examples/
│   ├── physics-free-body/
│   ├── pgfplots-graph/
│   ├── architecture-flow/
│   └── svg-diagram/
├── src/
│   ├── classify_diagram.py
│   ├── generate_spec.py
│   ├── generate_code.py
│   ├── render_diagram.py
│   ├── validate_diagram.py
│   └── repair_diagram.py
└── outputs/
    ├── source/
    ├── rendered/
    └── reports/
```

### Component Responsibilities

- `prompts/diagram-classifier.prompt.md`: Classifies the request and selects an engine.
- `prompts/tikz-generator.prompt.md`: Generates TikZ or PGFPlots from a normalized specification.
- `prompts/svg-generator.prompt.md`: Generates native SVG for web-specific diagrams.
- `prompts/validator.prompt.md`: Evaluates completeness, correctness, and presentation.
- `prompts/repair.prompt.md`: Converts validation findings into focused source changes.
- `src/classify_diagram.py`: Applies engine-selection rules.
- `src/generate_spec.py`: Normalizes user input into a structured specification.
- `src/generate_code.py`: Produces authoritative engine source.
- `src/render_diagram.py`: Compiles or renders generated source.
- `src/validate_diagram.py`: Runs programmatic and report-based validation.
- `src/repair_diagram.py`: Applies targeted repair iterations.
- `outputs/source/`: Stores generated authoritative source.
- `outputs/rendered/`: Stores rendered previews and exported diagrams.
- `outputs/reports/`: Stores validation findings and repair history.

## Reusable User Prompt

```text
Generate a technical diagram using the LLM Diagram Generation Framework.

Topic:
[State the subject and purpose.]

Diagram type:
[Examples: physics free-body diagram, PGFPlots graph, architecture flow,
native SVG diagram, topology graph, or advanced 3D diagram.]

Required objects:
[List every object that must appear and describe their relationships.]

Required labels:
[List every label, symbol, equation, axis title, legend item, and annotation.]

Required values:
[List every numeric value, unit, angle, coordinate, scale, and data point.]

Preferred output:
[Examples: SVG for the web player, TikZ source plus SVG, or native SVG.]

Quality rules:
[List geometry, correctness, styling, accessibility, sizing, and layout rules.]

Follow this deterministic workflow:
Specification → Code → Compile/Render → Validate → Repair → Export.

Return:
1. A complete structured specification.
2. The selected engine and a concise rationale.
3. Complete authoritative source code that compiles or renders as provided.
4. Render and SVG export commands.
5. Validation results against every required object, label, value, and quality rule.
6. Targeted source repairs for any failed check.

The final result must satisfy:
- Code compiles without errors.
- No placeholders remain.
- All requested values are included.
- Labels and objects do not overlap.
```

## Example: Block on a 30-Degree Inclined Plane

### Request

Create a free-body diagram of a block on a \(30^\circ\) inclined plane. Show the block, plane, angle marker, weight \(mg\), normal force \(N\), and friction force \(f\). The weight must be vertical, the normal force perpendicular to the plane, and friction parallel to the plane.

### Specification

```yaml
topic: Forces on a block on an inclined plane
diagram_type: physics-free-body
engine: tikz
required_objects:
  - inclined plane
  - block
  - angle marker
  - weight vector
  - normal-force vector
  - friction-force vector
required_labels:
  - "$m$"
  - "$mg$"
  - "$N$"
  - "$f$"
  - "$30^\\circ$"
required_values:
  incline_angle_degrees: 30
constraints:
  - The weight vector is vertical and points downward.
  - The normal vector is perpendicular to the plane.
  - The friction vector is parallel to and points up the plane.
  - All force vectors originate at the block center.
preferred_output: svg
quality_rules:
  - No labels or objects overlap.
  - No content is clipped.
  - Force directions are semantically correct.
```

### Authoritative TikZ Source

```latex
\documentclass[tikz,border=8pt]{standalone}
\usetikzlibrary{angles,arrows.meta,patterns,quotes}

\begin{document}
\begin{tikzpicture}[
  force/.style={-{Latex[length=3mm,width=2mm]},line width=1.1pt},
  block/.style={
    draw,
    fill=blue!12,
    line width=0.9pt,
    minimum width=2cm,
    minimum height=1.2cm
  },
  force label/.style={fill=white,inner sep=1.5pt,font=\large}
]
  \coordinate (origin) at (-3,-1.5);
  \coordinate (end) at (3.5,2.2528);
  \coordinate (horizontal) at (3.5,-1.5);

  \fill[pattern=north east lines,pattern color=gray!70]
    (origin) -- (end) -- (horizontal) -- cycle;
  \draw[line width=1pt] (origin) -- (end);
  \draw[gray] (origin) -- (horizontal);
  \pic[
    draw,
    angle radius=1.05cm,
    angle eccentricity=1.35,
    "$30^\circ$"
  ] {angle=horizontal--origin--end};

  \begin{scope}[rotate=30]
    \node[block,transform shape] (block) at (0,0.6) {$m$};
    \coordinate (center) at (block.center);
  \end{scope}

  \draw[force,blue!75!black]
    (center) -- ++(0,-2.5)
    node[force label,below] {$mg$};
  \draw[force,red!75!black]
    (center) -- ++(120:2.1)
    node[force label,above left] {$N$};
  \draw[force,orange!85!black]
    (center) -- ++(30:2.2)
    node[force label,above right] {$f$};
  \fill (center) circle (1.8pt);
\end{tikzpicture}
\end{document}
```

### Compile and Export

Compile the standalone TikZ source:

```powershell
pdflatex source.tex
```

Export the compiled PDF to SVG:

```powershell
dvisvgm --pdf --exact --font-format=woff source.pdf -o diagram.svg
```

### Example Validation

- [ ] `source.tex` compiles without errors.
- [ ] No placeholders remain.
- [ ] The \(30^\circ\) value and all requested force labels are included.
- [ ] Labels and objects do not overlap.
- [ ] The plane rises at \(30^\circ\) from horizontal.
- [ ] The weight vector points vertically downward.
- [ ] The normal force is perpendicular to the plane.
- [ ] The friction force is parallel to and points up the plane.
- [ ] All three force vectors originate at the block center.
- [ ] The diagram is not clipped.
- [ ] The exported SVG is valid, non-empty, and displays correctly in the web player.

### Targeted Repairs

| Validation defect | Source repair |
|---|---|
| A force starts away from the block center | Replace its start coordinate with `(center)`. |
| The weight rotates with the plane | Draw it outside the rotated scope with the global displacement `++(0,-2.5)`. |
| A label overlaps the block or arrowhead | Change its node position or add a controlled offset. |
| The angle label is clipped | Increase the standalone border or reduce the angle-label eccentricity. |
| SVG text renders inconsistently | Adjust the SVG font export option while retaining TikZ as authoritative source. |

## Acceptance Criteria

A diagram is ready for use when:

1. Its structured specification contains every requested object, label, value, relationship, output preference, and quality rule.
2. Its authoritative source compiles or renders without errors and contains no placeholders.
3. Programmatic and visual checks confirm completeness, semantic correctness, and non-overlapping layout.
4. Any defects have been repaired in source and the result revalidated.
5. The final SVG renders correctly in the repository's web player.
6. The source, rendered asset, and validation report remain traceable to the same request.
