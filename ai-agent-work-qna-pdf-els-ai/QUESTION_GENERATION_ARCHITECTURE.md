# Question Generation Architecture

The sole objective of this architecture is to generate accurate, source-grounded, educationally valuable questions from PDF books. Question quality takes precedence over throughput, feature breadth, and generation cost.

The system supports Physics, Chemistry, Mathematics, Biology, English, History, Geography, and Computer Science at CBSE, ICSE, JEE Main, JEE Advanced, and NEET quality levels. It produces MCQ, Multiple Select, Numerical, Short Answer, Case Study, and Scenario Based questions.

## 1. PDF Extraction Layer

### Responsibility

Convert born-digital and scanned PDFs into an ordered, source-traceable representation that preserves the educational information needed to create and verify questions.

### Extraction pipeline

1. **PDF integrity check**
   - Verify the file signature, page count, encryption status, readability, and checksum.
   - Reject unreadable or incomplete files before downstream processing.
   - Record the immutable source checksum and extraction version.

2. **Native extraction**
   - Extract text spans, headings, paragraphs, lists, tables, page numbers, coordinates, fonts, and reading order.
   - Preserve chapter, section, subsection, example, exercise, and solution boundaries.
   - Prefer native text whenever its coverage and character quality pass validation.

3. **Selective OCR**
   - Render and OCR only pages or regions with missing or unusable native text.
   - Record OCR engine, language, confidence, page image checksum, and bounding boxes.
   - Route low-confidence pages to review or exclude them from question generation.

4. **Formula extraction**
   - Detect display equations, inline expressions, equation labels, variable definitions, units, and surrounding explanatory text.
   - Preserve the source expression and produce normalized LaTeX only when conversion passes syntax and semantic checks.
   - Link every formula to its source page, region, section, and explanatory context.

5. **Diagram extraction**
   - Extract figures, charts, geometric drawings, circuits, scientific diagrams, captions, labels, legends, and nearby references.
   - Store the source crop, page coordinates, caption, detected labels, and a text description.
   - Flag diagrams with unreadable labels, missing captions, or uncertain reading order.

6. **Educational structure detection**
   - Identify chapters, sections, concepts, definitions, worked examples, exercises, case passages, scenarios, answer keys, and solution sections.
   - Keep questions and answer keys distinguishable so source exercises are not accidentally reproduced as newly generated questions.

### Canonical page record

Each extracted page must provide:

```json
{
  "document_id": "",
  "document_version": "",
  "page_number": 0,
  "chapter": "",
  "section": "",
  "blocks": [],
  "formulae": [],
  "diagrams": [],
  "tables": [],
  "extraction_method": "native|ocr|hybrid",
  "confidence": 0.0,
  "source_checksum": ""
}
```

Every block, formula, and diagram requires a stable identifier and source coordinates. Derived content without resolvable provenance cannot be used for generation.

### Extraction quality gates

- No unexplained empty instructional pages.
- Reading order must be valid for multi-column layouts.
- Native and OCR text must not be duplicated.
- OCR confidence must meet the subject-specific threshold.
- Formulae must have balanced notation and valid LaTeX when normalized.
- Diagram labels and captions must be associated with the correct figure.
- Headers, footers, watermarks, page numbers, and publisher boilerplate must not contaminate instructional text.
- Answer keys and source solutions must be marked explicitly.

## 2. Adaptive Chunking Layer

### Responsibility

Create source-grounded chunks that are complete enough to support planning, solving, explaining, and validating a question. Chunk boundaries follow educational meaning, not page count or arbitrary character limits.

### Chunk types

- **Concept chunk:** definition, principle, law, theorem, or explanatory passage.
- **Formula chunk:** expression, variable meanings, assumptions, units, derivation context, and applicable examples.
- **Worked-example chunk:** problem statement, method, intermediate steps, and result.
- **Exercise-context chunk:** exercise family or assessment pattern without copying an existing question as a generated item.
- **Case or scenario chunk:** complete stimulus, evidence, constraints, and related concepts.
- **Diagram chunk:** figure description, labels, caption, source crop reference, and concepts illustrated.
- **Table or data chunk:** complete table, headings, units, notes, and interpretation context.

### Chunk construction rules

1. Detect a semantic anchor such as a concept, formula, worked example, case, diagram, or table.
2. Include the minimum surrounding context required to interpret the anchor correctly.
3. Keep assumptions, units, variable definitions, exceptions, and conditions with the content they qualify.
4. Keep a worked solution with its problem while separately identifying the statement and solution regions.
5. Keep diagram labels and caption references with the diagram description.
6. Split only at validated semantic boundaries.
7. If model limits require packaging, create linked child segments while retaining one parent semantic unit.
8. Attach exact source pages and block identifiers to every chunk.

### Chunk contract

```json
{
  "chunk_id": "",
  "document_id": "",
  "document_version": "",
  "subject": "",
  "chapter": "",
  "topic": "",
  "subtopic": "",
  "chunk_type": "",
  "text": "",
  "formulae": [],
  "diagram_ids": [],
  "source_pages": [],
  "source_block_ids": [],
  "quality_score": 0.0,
  "generation_allowed": true
}
```

### Chunk quality gates

- The chunk is self-contained for its declared purpose.
- Source text is not truncated mid-sentence, mid-formula, mid-table, or mid-example.
- Formulae include variable definitions and applicable conditions when available.
- Diagrams include labels, captions, and source references.
- OCR corruption and publisher boilerplate remain below threshold.
- Duplicate or near-duplicate chunks are removed.
- Existing source questions are identified to prevent unintentional copying.
- The chunk has sufficient educational content for at least one supported question type.

## 3. Contextual Retrieval Layer

### Responsibility

Retrieve the smallest set of high-quality source evidence needed to plan, solve, explain, and validate a requested question.

### Retrieval request

```json
{
  "subject": "",
  "topic": "",
  "question_type": "",
  "target_difficulty": "",
  "target_cognitive_level": "",
  "requires_formula": false,
  "requires_diagram": false,
  "document_filters": []
}
```

### Retrieval stages

1. **Filter**
   - Apply document version, subject, chapter, topic, language, chunk type, and minimum-quality filters.

2. **Hybrid candidate search**
   - Use dense semantic similarity for conceptual meaning.
   - Use sparse lexical matching for exact terminology, named laws, formula variables, dates, definitions, and subject vocabulary.

3. **Context expansion**
   - Retrieve linked formula, example, diagram, table, or neighboring semantic segments only when needed.
   - Include prerequisite definitions only when the question would otherwise be ambiguous.

4. **Reranking**
   - Rerank by educational relevance, source quality, target difficulty, question-type suitability, formula completeness, and diagram completeness.
   - Penalize OCR noise, duplication, answer-only passages, and weakly related content.

5. **Evidence assembly**
   - Produce a bounded context package with primary evidence, supporting evidence, formulae, diagrams, and source citations.
   - Do not merge conflicting source claims. Reject or route conflicts for review.

### Retrieval output

```json
{
  "primary_chunks": [],
  "supporting_chunks": [],
  "formulae": [],
  "diagrams": [],
  "citations": [],
  "retrieval_scores": {},
  "coverage_status": "complete|insufficient|conflicting"
}
```

Generation proceeds only when coverage is `complete`. Insufficient or conflicting retrieval must not be compensated for by unsupported model knowledge.

### Retrieval quality targets

- Recall@5 of at least 0.90 on the approved subject benchmark.
- MRR of at least 0.85.
- nDCG@5 of at least 0.85.
- Source citation coverage of 100% for accepted questions.
- Formula and diagram retrieval recall of at least 0.95 when required.
- No result from an excluded document version or low-quality chunk.

## 4. Qdrant Design

### Collection

Use one versioned collection family named `educational_chunks_<embedding_version>`. Promote a validated collection through a stable alias named `educational_chunks_current`.

The collection uses:

- a named dense vector for semantic retrieval;
- a named sparse vector for exact lexical retrieval;
- cosine similarity for dense vectors;
- payload indexes for all mandatory filters.

### Point identity

Each point represents one immutable chunk version. Its identifier is deterministically derived from:

```text
document_id + document_version + chunk_id + chunk_version + embedding_version
```

Reprocessing creates a new point version. It never silently overwrites the evidence used by an existing accepted question.

### Required payload

```json
{
  "chunk_id": "",
  "document_id": "",
  "document_version": "",
  "subject": "",
  "chapter": "",
  "topic": "",
  "subtopic": "",
  "chunk_type": "",
  "source_pages": [],
  "formula_ids": [],
  "diagram_ids": [],
  "quality_score": 0.0,
  "generation_allowed": true,
  "language": "",
  "embedding_model": "",
  "embedding_version": ""
}
```

Payload indexes are required for `document_id`, `document_version`, `subject`, `chapter`, `topic`, `chunk_type`, `generation_allowed`, `language`, and `embedding_version`.

### Indexing gate

A chunk can be indexed for generation only if:

- extraction and chunk quality gates pass;
- its source document version is approved;
- provenance resolves successfully;
- formula and diagram references are valid;
- the embedding dimension and model version match the target collection;
- duplicate detection passes.

### Query behavior

1. Apply hard payload filters before similarity search.
2. Retrieve dense and sparse candidate sets.
3. Fuse candidates using a deterministic rank-fusion rule.
4. Rerank outside Qdrant using educational relevance and evidence completeness.
5. Return payload, content, and source identifiers for every hit.

### Operational controls

- Build new collections offline and promote them through aliases only after retrieval evaluation.
- Keep the prior alias target available for rollback.
- Reconcile Qdrant points against the approved chunk manifest.
- Back up collection snapshots and the exact embedding configuration.
- Prevent mixed embedding versions in one collection.
- Record retrieval latency, candidate counts, filters, and score distributions without logging copyrighted source text.

## 5. Question Generation Engine

### Responsibility

Produce valid questions through a deterministic, persisted workflow. Question generation must never be a single LLM call. Each stage has a narrow output contract, deterministic validators, and a rejection path.

### Supported question types

| Type | Required behavior |
|---|---|
| MCQ | Exactly one correct option and at least three misconception-based distractors |
| Multiple Select | One or more correct options, explicit selection instruction, and no partial ambiguity |
| Numerical | Exact value or validated tolerance, units, significant-figure rule, and worked solution |
| Short Answer | Expected answer, accepted variants, concise scoring criteria, and explanation |
| Case Study | Complete source-grounded stimulus followed by one or more independently valid questions |
| Scenario Based | Realistic self-contained situation requiring application or analysis rather than recall alone |

### Deterministic generation workflow

#### Step 1: Question Planning

Use retrieved evidence to identify concepts, difficulty, cognitive level, learning objective, assessment type, and content requirements. Do not generate the final question.

```json
{
  "question_type": "",
  "difficulty": "",
  "cognitive_level": "",
  "concepts": [],
  "learning_objective": "",
  "requires_diagram": false,
  "requires_formula": false,
  "source_chunk_ids": []
}
```

The planner must verify that the retrieved evidence supports the requested subject, level, type, and difficulty.

#### Step 2: Question Stem Generation

Generate only the title or stem.

The stem must be:

- clear, complete, self-contained, and educationally correct;
- solvable using the approved evidence;
- free from accidental clues and unsupported assumptions;
- original rather than a copied source exercise;
- appropriate for the planned cognitive level and difficulty.

Do not generate options, answer, hint, or explanation.

#### Step 3: Diagram Planning

Determine whether a diagram is necessary. A diagram is required when the question depends on spatial, geometric, graphical, circuit, process, or anatomical information that cannot be stated clearly in text alone.

```json
{
  "requires_diagram": false,
  "diagram_type": "",
  "diagram_description": "",
  "svg_specification": {},
  "source_diagram_ids": []
}
```

Supported diagram types are Triangle, Circle, Coordinate Geometry, Graph, Bar Chart, Pie Chart, Flow Chart, Physics Diagram, Circuit, and Biology Diagram.

#### Step 4: Answer Generation

Generate the correct answer before distractors.

Validate the answer against:

- retrieved source evidence;
- independent mathematical calculation where applicable;
- scientific laws, units, and significant figures;
- case or scenario facts;
- the rendered diagram and labels when applicable.

The answer remains internal until option validation passes.

#### Step 5: Distractor Generation

Generate distractors only from meaningful misconceptions or typical student errors.

Each distractor must record:

```json
{
  "option": "",
  "error_type": "misconception|calculation_error|unit_error|sign_error|misread_condition|concept_confusion",
  "rationale": "",
  "source_concept": ""
}
```

Random, absurd, grammatically inconsistent, overlapping, or obviously longer distractors are rejected.

For Multiple Select questions, incorrect combinations must remain plausible while every correct option is independently supported.

#### Step 6: Option Validation

Deterministic and semantic checks verify:

- exactly one correct answer for MCQ;
- one or more correct answers for Multiple Select;
- option uniqueness after normalization;
- no equivalent choices;
- no ambiguous wording;
- no answer leakage from grammar, length, ordering, or units;
- all distractors are genuinely incorrect under the stated conditions.

Failure returns the item to distractor generation or rejects it after the configured retry limit.

#### Step 7: Hint Generation

Generate a hint of no more than two sentences. It must identify a productive starting point, relevant concept, or formula-selection strategy without revealing the answer or reproducing the decisive calculation.

#### Step 8: Explanation Generation

The Explanation Engine generates the correct-answer rationale, option-level error analysis, and worked solution from the validated answer and evidence.

#### Step 9: LaTeX Formatting

All mathematical content must use valid LaTeX. Raw-text equations are not accepted.

Display mathematics uses:

```latex
\[
v = \frac{s}{t}
\]
```

Supported notation includes fractions, roots, powers, subscripts, matrices, vectors, chemical expressions where appropriate, units, piecewise functions, and aligned derivations. LaTeX delimiters, commands, braces, and environments must pass parsing and rendering checks.

#### Step 10: Final Question Validation

Validate:

- question correctness;
- diagram correctness;
- answer correctness;
- option uniqueness and correctness;
- explanation completeness;
- worked-solution consistency;
- LaTeX validity;
- source grounding;
- target difficulty and cognitive-level fit;
- originality against source exercises and previously generated questions.

Any failed mandatory check rejects the question. A rejected question is never indexed or delivered.

### Final question contract

```json
{
  "question_id": "",
  "question_type": "",
  "subject": "",
  "difficulty": "",
  "cognitive_level": "",
  "concepts": [],
  "question": "",
  "options": [],
  "correct_answer": "",
  "hint": "",
  "explanation": {
    "why_correct": "",
    "why_each_incorrect_option_is_wrong": [],
    "worked_solution": ""
  },
  "formula_references": [],
  "diagram": null,
  "source_citations": [],
  "validation": {
    "passed": false,
    "checks": []
  }
}
```

## 6. Explanation Engine

### Responsibility

Explain why the validated answer is correct, why every incorrect choice is wrong, and how to solve the problem without introducing unsupported information.

### Inputs

- validated question plan;
- final stem;
- validated answer;
- validated options;
- approved source evidence;
- formula references;
- rendered diagram metadata;
- target subject and level.

### Output structure

```json
{
  "why_correct": "",
  "why_option_a_wrong": "",
  "why_option_b_wrong": "",
  "why_option_c_wrong": "",
  "why_option_d_wrong": "",
  "worked_solution": "",
  "formula_references": [],
  "diagram_references": [],
  "source_citations": []
}
```

For Multiple Select questions, the engine explains every option independently. For Numerical and Short Answer questions, option-specific fields may be empty, but the reasoning and scoring basis remain mandatory. Case Study and Scenario Based explanations must distinguish stimulus evidence from general concept reasoning.

### Explanation rules

- Begin with the governing concept or principle.
- State applicable formulae in LaTeX and define variables.
- Show substitutions, units, transformations, and intermediate results.
- Reference diagram labels exactly as rendered.
- Explain the specific misconception or error behind each distractor.
- Use language appropriate to the target level.
- Do not claim that an option is wrong merely because another option is correct.
- Do not introduce facts that are absent from the approved evidence unless they are independently verified by a deterministic subject validator.
- Keep the explanation logically consistent with the stem, options, and answer.

### Explanation validation

- Every option receives a non-circular rationale.
- The worked solution reproduces the validated answer.
- Formula substitutions and units are correct.
- Mathematical expressions render successfully.
- Scientific terminology and claims match the source.
- Diagram references resolve to visible labels.
- Citations support the decisive reasoning.

## 7. Diagram Generation Engine

### Responsibility

Generate deterministic, accessible SVG diagrams when a visual is necessary for solving or understanding the question.

### Diagram workflow

1. Use the diagram plan to select a supported diagram type.
2. Build a typed SVG specification rather than free-form SVG text.
3. Validate geometry, data, labels, units, scale, and required relationships.
4. Render SVG from the validated specification.
5. Parse and sanitize the SVG.
6. Compare the rendered diagram with the stem, answer, and explanation.
7. Reject the question if the diagram is misleading, incomplete, or inaccessible.

### SVG specification

```json
{
  "diagram_type": "",
  "width": 0,
  "height": 0,
  "view_box": "",
  "coordinate_system": {},
  "elements": [],
  "labels": [],
  "styles": {},
  "accessibility": {
    "title": "",
    "description": ""
  }
}
```

### Supported element families

- points, lines, rays, segments, polygons, circles, arcs, and angle markers;
- axes, ticks, functions, data points, and shaded regions;
- bars, sectors, legends, labels, and data annotations;
- nodes, directed connectors, and decision branches;
- masses, forces, vectors, pulleys, lenses, mirrors, rays, and motion paths;
- wires, cells, resistors, switches, meters, junctions, and polarity labels;
- biological structures, leader lines, region labels, and directional processes.

### Diagram quality gates

- All dimensions and relationships used by the solution are represented accurately.
- Labels are unique, readable, and referenced consistently.
- No answer is accidentally revealed.
- The view box contains every visible element.
- Axes, scales, units, current direction, force direction, and polarity are correct.
- Colors are not the only means of conveying meaning.
- Text has sufficient contrast and does not overlap.
- SVG contains no scripts, external resources, event handlers, or unsafe markup.
- Accessibility title and description are present.
- The rendered SVG passes visual and semantic validation.

### Static-only rendering architecture

The canonical runtime representation is a controlled `DiagramSpec`. The application renders that
specification to deterministic SVG and validates both forms. Model-authored raw SVG, JavaScript,
animations, image URLs, raw TikZ, and executable renderer code are forbidden.

The validator records optional static export recommendations without making them runtime
dependencies:

| Content | Canonical runtime | Optional static export recommendation |
|---|---|---|
| Mathematics geometry and analytic figures | Deterministic SVG | TikZ |
| Mathematics functions, regions, and charts | Deterministic SVG | PGFPlots |
| Physics circuits and transformers | Deterministic SVG | CircuitikZ |
| Physics free-body diagrams | Deterministic SVG | pyfreebody |
| Physics fields, rays, and other schematics | Deterministic SVG | TikZ |
| Chemistry formulae and reactions | Deterministic SVG | mhchem or ChemFig |

External engines are never selected merely because they are installed. They are offline export
targets only until a separately validated exporter and compiler sandbox are configured.

### Concept-to-diagram rules

Diagram existence is not evidence of relevance. A concept profile defines allowed diagram
families, forbidden generic families, mandatory scientific objects, required labels, conditional
values and units, and graph-axis rules.

| Concept | Allowed family | Mandatory visual semantics |
|---|---|---|
| LR current growth | `current-time`, `lr-circuit` | Physical time/current axes and exponential curve, or source, switch, R, L, and current |
| Transformer with AC load | `transformer-circuit` | Primary, secondary, core, AC source, load, and turns labels |
| Magnetic flux through a loop | `magnetic-flux` | Loop or surface, area, magnetic-field vector, normal, and angle |
| Mutual induction | `coupled-coils` | Two coils, changing current or AC source, and induced emf |
| Inclined-plane free body | `inclined-plane` | Plane, block, weight, normal, angle, and friction only when applicable |
| Refraction | `refraction` | Boundary, normal, incident ray, refracted ray, and stated angles |
| Mathematical function plot | `function`, `function-region` | Mathematical axes, function curve, domain, and marked values when stated |
| Chemical reaction | `chemical-reaction` | Reactants, products, reaction arrow, and stated condition |

Physics questions cannot use generic geometry, mensuration, or default `x`/`y` plots as
substitutes for scientific diagrams. Displayed quantities must come from the question. Missing
objects, invented values, placeholder labels, or scientifically incorrect vector relationships
cause repair or rejection.

### Deterministic STEM validation report

The validator runs after target-schema adaptation and again before persistence. Its stable report
contains:

```json
{
  "question_id": "question-id",
  "detected_subject": "Physics",
  "detected_concept": "magnetic_flux",
  "concept_confidence": 0.99,
  "checks": {
    "metadata_consistency": {"status": "pass", "issues": [], "warnings": []},
    "answer_key_consistency": {"status": "pass", "issues": [], "warnings": []},
    "physics_correctness": {"status": "pass", "issues": [], "warnings": []},
    "diagram_type_match": {"status": "pass", "issues": [], "warnings": []},
    "diagram_required_objects": {"status": "pass", "issues": [], "warnings": []},
    "diagram_labels_units": {"status": "pass", "issues": [], "warnings": []},
    "graph_quality": {"status": "pass", "issues": [], "warnings": []},
    "svg_schema": {"status": "pass", "issues": [], "warnings": []},
    "layout_readability": {"status": "pass", "issues": [], "warnings": []},
    "placeholder_detection": {"status": "pass", "issues": [], "warnings": []}
  },
  "score": 100.0,
  "decision": "accept",
  "critical_failures": [],
  "repair_instructions": [],
  "selected_static_engine": "deterministic_svg",
  "recommended_export_engine": "tikz",
  "animations_allowed": false
}
```

Scores use fixed weights: metadata 8, answer consistency 20, Physics formula consistency 15,
diagram family 12, required objects 15, labels and units 8, graph quality 5, SVG safety 5,
layout 3, placeholder detection 4, and LaTeX 5. Warnings retain 80% of their check weight; failed
checks retain none. A failed major check requires repair. Critical failures,
including subject mismatch, answer/explanation mismatch, unrelated diagrams, missing scientific
objects, unsafe SVG, and placeholders, reject the candidate regardless of score. Acceptance
requires a score of at least 85 and no failed major or critical check.

### Repair and retry contract

Rejected and repair-required candidates are not persisted. Deterministic instructions are added to
the next bounded generation attempt using this template:

```text
Regenerate the question without changing its intended topic or supplied quantities.
1. Correct every listed scientific or answer inconsistency.
2. Use only the allowed controlled static diagram family.
3. Add every missing scientific object and required label.
4. Use physical axis names and units for Physics graphs.
5. Remove placeholder labels and values not supplied by the question.
6. Return strict JSON only. Do not emit raw SVG, TikZ, animation, or image URLs.

Validator findings:
{{repair_instructions}}
```

The retry result is validated from the beginning. Repair instructions never authorize the model to
invent measurements, units, formula assumptions, labels, or answer values.

## 8. Evaluation Framework

### Responsibility

Prevent low-quality questions from publication and measure whether the system produces questions comparable to CBSE, ICSE, JEE Main, JEE Advanced, and NEET standards.

### Evaluation layers

#### A. Deterministic validation

- Schema completeness.
- Question-type rules.
- Option count and uniqueness.
- MCQ single-answer constraint.
- Multiple Select answer-set constraint.
- Numerical tolerance, units, and significant figures.
- LaTeX parsing and rendering.
- SVG parsing, sanitization, geometry, labels, and accessibility.
- Citation resolution.
- Duplicate and source-copy detection.

#### B. Subject correctness validation

- Recalculate mathematical and numerical answers independently.
- Check dimensional consistency and units in Physics and Chemistry.
- Validate chemical formulae, reactions, conditions, and nomenclature.
- Validate biological terminology and diagram labels.
- Verify textual evidence and inference for English, History, and Geography.
- Compile or simulate Computer Science snippets when the question depends on execution behavior.

#### C. Educational quality review

Score each question for:

- source grounding;
- factual correctness;
- clarity and self-containment;
- target difficulty fit;
- cognitive-level fit;
- distractor plausibility;
- explanation quality;
- worked-solution completeness;
- formula correctness;
- diagram usefulness and correctness;
- originality;
- freedom from bias and ambiguity.

Each score includes the evaluator version, evidence, and rejection reasons. Correctness, grounding, ambiguity, and answer validity are mandatory pass criteria, not averages that can be offset by presentation quality.

#### D. Retrieval evaluation

Maintain expert-labeled query and evidence sets for every supported subject and target level. Measure Recall@K, Precision@K, MRR, nDCG, citation coverage, formula retrieval, diagram retrieval, and forbidden-source leakage.

#### E. Human expert evaluation

Subject experts review statistically valid samples and all high-risk items before release. JEE Advanced, NEET scientific content, ambiguous language questions, and diagram-dependent items receive stricter review policies.

### Release thresholds

| Measure | Minimum release threshold |
|---|---:|
| Answer correctness | 100% on deterministic checks |
| Source citation coverage | 100% |
| Mandatory schema completion | 100% |
| MCQ and Multiple Select option validity | 100% |
| LaTeX parse and render success | 100% |
| SVG safety and parse success | 100% |
| Expert-rated factual correctness | At least 0.98 |
| Expert-rated non-ambiguity | At least 0.97 |
| Expert-rated explanation completeness | At least 0.95 |
| Distractor plausibility | At least 0.90 |
| Retrieval Recall@5 | At least 0.90 |
| Retrieval MRR | At least 0.85 |

### Acceptance and rejection

A question is accepted only when every mandatory validator passes and its weighted educational quality score meets the configured subject and level threshold. Failed items retain stage outputs and rejection reasons for analysis but are never exposed as approved questions.

Evaluation results are segmented by subject, question type, difficulty, cognitive level, diagram requirement, formula requirement, source quality, and target examination. A strong overall average cannot hide a weak subject or question category.
