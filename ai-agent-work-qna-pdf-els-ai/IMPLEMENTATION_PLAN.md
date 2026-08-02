# Question Generation Implementation Plan

## 1. Objective

Deliver a production-ready pipeline that generates the highest-quality educational questions from PDF books:

```text
PDF
  -> intelligent extraction
  -> adaptive chunking
  -> contextual retrieval
  -> Qdrant indexing
  -> deterministic question generation
  -> explanation and SVG generation
  -> strict evaluation
```

The first release supports Physics, Chemistry, Mathematics, Biology, English, History, Geography, and Computer Science. It produces MCQ, Multiple Select, Numerical, Short Answer, Case Study, and Scenario Based questions at CBSE, ICSE, JEE Main, JEE Advanced, and NEET quality levels.

Question correctness, grounding, clarity, distractor quality, and explanation quality take priority over generation speed and volume.

## 2. Required Question Output

Every accepted question must provide:

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
    "checks": [],
    "rejection_reasons": []
  }
}
```

Question-type rules:

- **MCQ:** exactly one correct option and at least three plausible distractors.
- **Multiple Select:** one or more correct options, with every option independently validated.
- **Numerical:** validated value or range, units, tolerance, significant figures, and worked solution.
- **Short Answer:** expected response, accepted variants, scoring guidance, and explanation.
- **Case Study:** a complete, source-grounded stimulus with independently valid questions.
- **Scenario Based:** a realistic, self-contained situation requiring application or analysis.

## 3. Delivery Principles

1. **Never use a single-call question generator.** Planning, stem, answer, distractors, options, hint, explanation, formatting, diagrams, and validation are separate stages.
2. **Reject unsupported generation.** Missing, conflicting, or low-quality evidence stops the workflow.
3. **Generate the answer before distractors.** Distractors must be derived from misconceptions or typical errors relative to the validated answer.
4. **Validate deterministically wherever possible.** Calculation, units, option uniqueness, LaTeX, SVG safety, citation resolution, and schema rules do not depend solely on model judgment.
5. **Preserve provenance.** Every accepted claim, formula, diagram, and solution step resolves to approved PDF evidence.
6. **Use semantic chunk boundaries.** Character and token limits constrain packaging but never define educational meaning.
7. **Keep failed artifacts out of Qdrant serving aliases and question outputs.**
8. **Measure quality by subject and question type.** Overall averages cannot hide weak categories.

## 4. Priority Order

| Priority | Capability | Reason |
|---|---|---|
| P0 | PDF extraction and integrity validation | Incorrect input makes every downstream result unreliable |
| P0 | Formula and diagram extraction | STEM questions cannot be trusted without them |
| P0 | Concept-complete chunking with provenance | Retrieval and explanations depend on coherent evidence |
| P0 | Qdrant hybrid retrieval and evaluation | Generation must receive the right evidence |
| P0 | Ten-stage deterministic question workflow | Prevents uncontrolled single-call generation |
| P0 | Answer, option, source, LaTeX, and scientific validation | Correctness is the release gate |
| P1 | Explanation and distractor quality refinement | Converts correct questions into useful learning assets |
| P1 | Deterministic SVG planning, rendering, and validation | Required for geometry, graphs, circuits, and scientific diagrams |
| P1 | Case Study and Scenario Based generation | Requires stable extraction, retrieval, and evidence assembly |
| P1 | Subject and examination benchmark expansion | Establishes comparable quality across the full target scope |

## 5. Workstream 1: PDF Extraction

### Goal

Produce validated page, block, formula, table, and diagram records from born-digital and scanned educational PDFs.

### Tasks

1. Define immutable PDF, page, block, formula, table, diagram, and source-location contracts.
2. Validate PDF signature, encryption, readability, page count, and checksum.
3. Implement native text and layout extraction with coordinates and reading order.
4. Detect weak pages using text coverage, character quality, and layout confidence.
5. Run selective OCR only on weak pages or regions.
6. Detect chapter, section, subsection, definition, example, exercise, answer-key, and solution boundaries.
7. Remove headers, footers, watermarks, repeated page furniture, and publisher boilerplate without deleting instructional content.
8. Extract formula source text, normalized LaTeX, variables, units, assumptions, and source coordinates.
9. Extract diagram crops, captions, labels, references, and text descriptions.
10. Generate a per-page integrity report and exclude pages that fail mandatory quality thresholds.

### Deliverables

- Canonical PDF extraction schema.
- Page-level extraction and integrity records.
- Formula repository with LaTeX and provenance.
- Diagram repository with source crops and provenance.
- Extraction quality report.
- Expert-reviewed benchmark PDFs covering all supported subjects.

### Acceptance criteria

- Every extracted record resolves to document checksum, version, page, and region.
- Born-digital benchmark text recall is at least 99%.
- OCR pages meet the approved subject-specific character error threshold or are excluded.
- No duplicated native and OCR text.
- Reading order passes multi-column and mixed-layout fixtures.
- Formula syntax and diagram associations pass validation.
- Existing questions, answer keys, and solutions are separately identified.

## 6. Workstream 2: Adaptive Chunking

### Goal

Build self-contained evidence units suitable for planning, solving, explaining, and validating questions.

### Tasks

1. Detect semantic anchors: concepts, definitions, laws, formulae, examples, exercises, cases, diagrams, and tables.
2. Build concept chunks with the minimum context required for independent interpretation.
3. Keep formulae with variable meanings, assumptions, units, and applicable examples.
4. Keep diagrams with labels, captions, references, and explanatory text.
5. Keep complete worked examples while identifying statement and solution regions.
6. Create linked parent and child segments only when model packaging limits require them.
7. Remove duplicate and near-duplicate chunks.
8. Score completeness, extraction quality, educational value, formula quality, diagram quality, and generation suitability.
9. Exclude source exercises from direct reproduction while retaining their assessment pattern as controlled context.
10. Produce an approved chunk manifest before embedding.

### Deliverables

- Versioned chunk schema.
- Deterministic chunk identifiers.
- Approved chunk repository.
- Rejected chunk report with reasons.
- Chunk quality benchmark and thresholds.

### Acceptance criteria

- No accepted chunk ends mid-sentence, mid-formula, mid-table, or mid-example.
- Every accepted chunk contains valid source pages and source-block identifiers.
- Required formula and diagram references resolve.
- Duplicate rate after normalization is below 1%.
- Expert reviewers rate at least 95% of sampled chunks as complete for their declared purpose.

## 7. Workstream 3: Qdrant Indexing

### Goal

Index only approved chunks and retrieve them using semantic and exact educational context.

### Tasks

1. Select and freeze the initial embedding model using subject retrieval benchmarks.
2. Create a versioned `educational_chunks_<embedding_version>` collection.
3. Configure named dense and sparse vectors.
4. Define payload indexes for document, version, subject, chapter, topic, chunk type, language, quality, and generation status.
5. Generate deterministic point identifiers from source and embedding versions.
6. Validate vector dimensions, finite values, payload completeness, and provenance before upsert.
7. Reconcile indexed points with the approved chunk manifest.
8. Build a new collection offline for embedding or payload migrations.
9. Promote validated collections through the `educational_chunks_current` alias.
10. Retain the previous collection for rollback.

### Deliverables

- Qdrant collection specification.
- Versioned indexing manifest.
- Payload and filter contract.
- Reconciliation report.
- Snapshot, restore, promotion, and rollback procedure.

### Acceptance criteria

- Zero unapproved chunks in the serving alias.
- Zero mixed embedding versions in one collection.
- Every hit returns complete provenance and quality metadata.
- Alias promotion occurs only after retrieval evaluation passes.
- Reconciliation accounts for 100% of approved chunks.

## 8. Workstream 4: Contextual Retrieval

### Goal

Return complete, minimal, and source-grounded context for the requested question type, subject, difficulty, and cognitive level.

### Tasks

1. Define retrieval requests with subject, topic, type, difficulty, cognitive level, formula requirement, diagram requirement, and document filters.
2. Apply hard source, version, quality, language, and chunk-type filters.
3. Run dense and sparse Qdrant searches.
4. Fuse candidate rankings deterministically.
5. Expand context only with required formula, example, diagram, table, or neighboring semantic segments.
6. Rerank by educational relevance, source quality, difficulty fit, question-type fit, and evidence completeness.
7. Detect insufficient and conflicting evidence.
8. Assemble primary evidence, supporting evidence, formulae, diagrams, and citations.
9. Build expert-labeled query/evidence datasets for every supported subject.
10. Block generation when retrieval coverage is incomplete.

### Deliverables

- Retrieval request and response contracts.
- Hybrid search and reranking specification.
- Subject-specific evaluation sets.
- Retrieval validation report.
- Insufficient and conflicting evidence behavior.

### Acceptance criteria

- Recall@5 is at least 0.90.
- MRR is at least 0.85.
- nDCG@5 is at least 0.85.
- Formula and diagram recall is at least 0.95 when required.
- Accepted questions have 100% source citation coverage.
- Excluded document versions never appear in results.

## 9. Workstream 5: Deterministic Question Workflow

### Goal

Implement question generation as ten independently validated stages. Each stage consumes typed prior state and emits one bounded artifact.

### Stage 1: Question Planning

Input:

- retrieval package;
- requested subject, type, level, and difficulty.

Output:

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

Validation:

- requested type is supported;
- concepts and objective are supported by evidence;
- difficulty and cognitive level are feasible;
- required formula and diagram evidence is available.

### Stage 2: Question Stem Generation

Output only the stem. Do not generate options, answer, hint, or explanation.

Validation:

- clear, self-contained, original, and grammatically complete;
- no unsupported facts or assumptions;
- no answer leakage;
- correct subject terminology;
- appropriate cognitive demand.

### Stage 3: Diagram Planning

Output:

```json
{
  "requires_diagram": false,
  "diagram_type": "",
  "diagram_description": "",
  "svg_specification": {},
  "source_diagram_ids": []
}
```

Validation:

- the selected diagram type is supported;
- all information needed for rendering is available;
- the diagram adds necessary or meaningful information;
- the plan does not reveal the answer.

### Stage 4: Answer Generation

Generate and store the correct answer before distractors.

Validation:

- source support;
- independent mathematical calculation;
- scientific correctness;
- units, tolerance, and significant figures;
- case or scenario consistency;
- diagram consistency.

### Stage 5: Distractor Generation

Generate each distractor from a named misconception or typical error:

- concept confusion;
- wrong formula;
- sign error;
- unit error;
- arithmetic error;
- ignored condition;
- misread graph or diagram;
- historically or geographically plausible confusion;
- language interpretation error;
- program execution misconception.

Validation:

- plausible but incorrect;
- educationally meaningful;
- comparable in style and length;
- traceable to an error rationale;
- not equivalent to the answer or another distractor.

### Stage 6: Option Validation

Validation:

- exactly one correct option for MCQ;
- one or more correct options for Multiple Select;
- unique normalized option text;
- no semantically equivalent options;
- no ambiguous choices;
- no grammatical, positional, length, or unit clues;
- all incorrect choices are demonstrably wrong under the stem.

### Stage 7: Hint Generation

Generate no more than two sentences.

Validation:

- suggests a useful concept, first step, or formula-selection strategy;
- does not state the answer;
- does not reproduce the decisive calculation.

### Stage 8: Explanation Generation

Generate:

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

Validation:

- every option receives a specific rationale;
- the worked solution reproduces the validated answer;
- concepts, formulae, and diagram labels are referenced correctly;
- no unsupported information is introduced.

### Stage 9: LaTeX Formatting

Convert every mathematical expression to valid LaTeX.

Validation:

- balanced delimiters and braces;
- supported commands and environments;
- successful parsing and rendering;
- formula equivalence before and after formatting;
- units and chemical notation remain correct.

### Stage 10: Final Question Validation

Run all schema, source, subject, calculation, option, explanation, LaTeX, SVG, originality, difficulty, and cognitive-level checks.

Decision:

- `accept` only when every mandatory check passes;
- `retry_stage` only for a correctable stage with remaining retry budget;
- `reject` when evidence is insufficient, correctness fails, ambiguity remains, or retries are exhausted.

### Workflow controls

- Persist the output, validator result, model or rule version, evidence identifiers, and rejection reason for each stage.
- Use bounded retries per stage.
- Never restart the whole workflow to hide a failed validator.
- Never let a later stage silently rewrite a validated earlier artifact.
- Revalidate dependent stages when an upstream artifact changes.
- Publish only final accepted questions.

## 10. Workstream 6: Explanation Generation

### Goal

Produce explanations that teach the concept, justify the answer, diagnose each distractor, and show a complete solution where applicable.

### Tasks

1. Define subject-specific explanation patterns without forcing identical prose.
2. Reference the governing concept before procedural detail.
3. Include formulae in LaTeX with variable definitions and conditions.
4. Show substitutions, units, transformations, and intermediate calculations.
5. Explain the misconception behind every incorrect option.
6. Reference diagram labels exactly as rendered.
7. Distinguish source evidence from derived calculations.
8. Validate consistency among stem, options, answer, and worked solution.
9. Apply target-level language and detail rules.
10. Create expert-rated explanation benchmarks.

### Deliverables

- Explanation schema.
- Subject-specific explanation rubric.
- Option-level misconception taxonomy.
- Worked-solution validator.
- Explanation evaluation set.

### Acceptance criteria

- 100% of options in accepted selected-response questions have a specific rationale.
- 100% of formula-dependent explanations define used variables or reference their definitions.
- Worked solutions reproduce the validated answer.
- Expert-rated explanation completeness is at least 0.95.
- No accepted explanation introduces an unsupported decisive claim.

## 11. Workstream 7: SVG Diagram Generation

### Goal

Generate safe, accurate, and accessible diagrams for questions that require visual information.

### Tasks

1. Define typed SVG specifications for Triangle, Circle, Coordinate Geometry, Graph, Bar Chart, Pie Chart, Flow Chart, Physics Diagram, Circuit, and Biology Diagram.
2. Define deterministic primitives, coordinate systems, label rules, and style constraints.
3. Validate geometry and data before rendering.
4. Render SVG only from validated typed specifications.
5. Sanitize scripts, external resources, event handlers, and unsupported markup.
6. Check view box, overlap, contrast, label uniqueness, and accessibility text.
7. Validate scientific direction, circuit polarity, axes, scale, units, and biological labels.
8. Compare the rendered result with the stem, answer, and explanation.
9. Detect accidental answer leakage.
10. Build visual regression and expert-review datasets.

### Deliverables

- SVG specification schemas for all supported types.
- Deterministic renderer contract.
- SVG safety policy.
- Geometry and semantic validators.
- Visual regression corpus.

### Acceptance criteria

- 100% SVG parse and sanitization success for accepted diagrams.
- Zero scripts, external resources, or event handlers.
- All solution-referenced labels are present and unique.
- No accepted diagram reveals the answer unintentionally.
- Expert-rated diagram correctness is at least 0.98.
- Every accepted SVG includes an accessible title and description.

## 12. Workstream 8: Evaluation Framework

### Goal

Establish objective evidence that accepted questions are correct, grounded, unambiguous, educationally useful, and appropriate for the target level.

### Benchmark design

Create a stratified benchmark across:

- eight supported subjects;
- six question types;
- target difficulty levels;
- recall, understanding, application, analysis, and advanced reasoning;
- formula-dependent and non-formula questions;
- diagram-dependent and non-diagram questions;
- born-digital and scanned PDFs;
- CBSE, ICSE, JEE Main, JEE Advanced, and NEET styles where applicable.

Each benchmark item includes source evidence, expected plan, answer, accepted reasoning, known misconceptions, formulae, diagram expectations, and expert ratings.

### Automated validators

- Schema and required-field validation.
- Provenance and citation resolution.
- Duplicate and source-copy detection.
- MCQ and Multiple Select answer constraints.
- Numerical recalculation, tolerance, units, and significant figures.
- LaTeX parsing, rendering, and equivalence checks.
- SVG safety, geometry, labels, and accessibility.
- Scientific terminology and dimensional consistency.
- Case and scenario evidence consistency.
- Explanation-answer consistency.

### Human review

Qualified subject experts score:

- factual correctness;
- answer correctness;
- clarity;
- ambiguity;
- target difficulty;
- cognitive-level fit;
- distractor plausibility;
- explanation quality;
- worked-solution completeness;
- formula correctness;
- diagram correctness;
- originality.

### Release gates

| Gate | Threshold |
|---|---:|
| Deterministic answer validation | 100% |
| Source citation coverage | 100% |
| Required field completion | 100% |
| MCQ and Multiple Select option validity | 100% |
| LaTeX validity | 100% |
| SVG safety and validity | 100% |
| Expert factual correctness | At least 0.98 |
| Expert non-ambiguity | At least 0.97 |
| Explanation completeness | At least 0.95 |
| Distractor plausibility | At least 0.90 |
| Retrieval Recall@5 | At least 0.90 |
| Retrieval MRR | At least 0.85 |

Release gates apply separately to each supported subject and question type with sufficient benchmark coverage.

## 13. Delivery Milestones

### Milestone 0: Contracts and quality baseline

Deliver:

- canonical schemas;
- benchmark corpus design;
- quality rubrics;
- source-provenance rules;
- question-type validation rules;
- initial release thresholds.

Exit criteria:

- contracts reviewed by engineering and subject experts;
- benchmark coverage approved;
- no unresolved ambiguity in question output or stage ownership.

### Milestone 1: Trusted PDF evidence

Deliver:

- native extraction;
- selective OCR;
- educational structure detection;
- formula extraction;
- diagram extraction;
- integrity reports.

Exit criteria:

- extraction benchmark passes;
- every accepted record has valid provenance;
- failed pages cannot enter chunking.

### Milestone 2: Approved chunks and Qdrant index

Deliver:

- adaptive chunking;
- chunk quality gates;
- dense and sparse embeddings;
- Qdrant collection and payload indexes;
- reconciliation and alias promotion.

Exit criteria:

- approved chunk benchmark passes;
- serving alias contains only approved chunks;
- rollback is verified.

### Milestone 3: Contextual retrieval

Deliver:

- filtered hybrid search;
- context expansion;
- reranking;
- evidence assembly;
- retrieval evaluation.

Exit criteria:

- retrieval thresholds pass by initial subject;
- formula and diagram retrieval passes;
- insufficient evidence blocks generation.

### Milestone 4: Core question workflow

Deliver:

- all ten workflow stages;
- MCQ, Multiple Select, Numerical, and Short Answer;
- answer and option validators;
- hint and explanation generation;
- LaTeX formatting;
- final acceptance and rejection handling.

Exit criteria:

- no single-call generation path exists;
- deterministic mandatory checks pass at 100%;
- expert correctness and ambiguity gates pass for initial subjects.

### Milestone 5: Diagram, case, and scenario quality

Deliver:

- typed SVG specifications and renderer;
- diagram validators;
- Case Study and Scenario Based generation;
- expanded explanation validators;
- visual and stimulus benchmarks.

Exit criteria:

- SVG safety and validity pass at 100%;
- diagram expert correctness passes;
- case and scenario grounding and ambiguity gates pass.

### Milestone 6: Full subject and examination coverage

Deliver:

- benchmark and validator coverage for all eight subjects;
- validated CBSE, ICSE, JEE Main, JEE Advanced, and NEET profiles where applicable;
- subject-specific formula, diagram, distractor, and explanation policies;
- release dashboards segmented by subject and type.

Exit criteria:

- every advertised subject and question type meets its release gates;
- no low-performing category is hidden by aggregate metrics;
- rollback and reproducibility are verified.

## 14. Initial Release Scope

The initial production slice should prove the full quality path rather than maximize breadth:

1. Use a small, expert-approved PDF corpus.
2. Start with Mathematics and one science subject.
3. Support MCQ, Numerical, and Short Answer first.
4. Include formula extraction and LaTeX from the beginning.
5. Add diagram-dependent questions only after SVG validation is operational.
6. Expand to Multiple Select, Case Study, and Scenario Based after answer and explanation gates are stable.
7. Add remaining subjects only with subject-specific benchmarks and expert review.

This sequencing does not relax the final requirements. It reduces simultaneous uncertainty while preserving the complete architecture.

## 15. Definition of Done

The focused question-generation system is complete when:

- approved PDFs produce source-traceable text, formulae, and diagram records;
- concept-complete chunks pass quality validation before embedding;
- Qdrant indexes only approved, version-compatible chunks;
- contextual retrieval meets release thresholds for every advertised subject;
- all six question types run through the ten-stage deterministic workflow;
- no production path generates a complete question in one model call;
- every accepted question includes difficulty, cognitive level, concepts, answer, hint, explanation, formula references, diagram when required, citations, and worked solution where applicable;
- every incorrect option has a specific misconception or error explanation;
- all mathematical content uses validated LaTeX;
- all generated diagrams use validated and sanitized SVG specifications;
- deterministic mandatory checks pass at 100%;
- expert correctness, non-ambiguity, distractor, explanation, and diagram thresholds pass by subject and question type;
- failed questions are rejected with auditable reasons and cannot be published.

The governing architecture is [QUESTION_GENERATION_ARCHITECTURE.md](QUESTION_GENERATION_ARCHITECTURE.md).
