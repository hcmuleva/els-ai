# Topic Learning Package Template

Use this file before creating worksheet content files.
This is the master input for one topic.
It connects teaching content, worksheet generation counts, and learning-level measurement.

## Metadata
- package_id: PKG_SXXX_TOPIC_01
- student_id: SXXX
- grade: 6
- topic: <replace>
- language: English
- generated_for_cycle: 2026-05-17

## Topic Goal
- What should the learner understand after studying this topic?
- What practical knowledge should be checked using Logico Piccolo worksheets?

## Learning Objectives
- LO1: <replace>
- LO2: <replace>
- LO3: <replace>

## Teaching Content Inputs

### Text Content
- required: yes
- title: <replace>
- source_type: lesson_note | explanation_sheet | story | article
- source_path_or_url: <replace>
- summary_for_agent: <replace>

### Image Content
- required: yes | no
- source_path_or_url: <replace>
- image_purpose: concept explanation | labeling | comparison | observation
- summary_for_agent: <replace>

### Audio Content
- required: yes | no
- source_path_or_url: <replace>
- audio_purpose: pronunciation | listening comprehension | explanation | narration
- summary_for_agent: <replace>

### Video Content
- required: yes | no
- source_path_or_url: <replace>
- video_purpose: concept teaching | demonstration | experiment | story
- summary_for_agent: <replace>

## Concept Coverage Map
List the exact concepts that worksheets should test.

| concept_id | concept_name | source_modality | priority | notes |
| ---------- | ------------ | --------------- | -------- | ----- |
| C1         |              | text            | high     |       |
| C2         |              | image           | medium   |       |
| C3         |              | audio           | medium   |       |
| C4         |              | video           | high     |       |

## Worksheet Generation Request
Define how many worksheets must be generated for each level.

- easy_count: 0
- medium_count: 0
- hard_count: 0
- total_expected_worksheets: 0

## Difficulty Rules

### Easy Worksheet Rules
- Test direct recall, recognition, labeling, or simple matching.
- Use one concept focus per worksheet.
- Avoid multi-step reasoning.

### Medium Worksheet Rules
- Test understanding, comparison, classification, or cause-effect.
- Combine 2 related concepts when needed.
- Require concept understanding, not just memorization.

### Hard Worksheet Rules
- Test transfer, deeper reasoning, multi-concept connection, or applied classification.
- Use distractor-like similarity carefully while preserving one correct mapping.
- Do not make the worksheet ambiguous.

## Worksheet Blueprint Table
Create one row per worksheet that must be generated from this topic package.

| worksheet_id        | difficulty | concept_focus | source_modality_used | instruction_type | target_skill  | pair_ids                              |
| ------------------- | ---------- | ------------- | -------------------- | ---------------- | ------------- | ------------------------------------- |
| WS_SXXX_SET01_TOPIC | easy       |               | text                 | match            | recall        | P1,P2,P3,P4,P5,P6,P7,P8,P9,P10       |
| WS_SXXX_SET02_TOPIC | medium     |               | image                | match            | understanding | P1,P2,P3,P4,P5,P6,P7,P8,P9,P10       |
| WS_SXXX_SET03_TOPIC | hard       |               | video                | match            | application   | P1,P2,P3,P4,P5,P6,P7,P8,P9,P10       |

## Worksheet Pair Bank
Define the actual left/right pairs that the generator can use.
Each worksheet blueprint row must reference exactly 10 `pair_id` values.

| pair_id | left_label | left_icon_key | right_label | concept_focus | source_modality | difficulty_tags |
| ------- | ---------- | ------------- | ----------- | ------------- | --------------- | --------------- |
| P1      |            |               |             |               | text            | easy            |
| P2      |            |               |             |               | image           | easy            |
| P3      |            |               |             |               | audio           | medium          |
| P4      |            |               |             |               | video           | hard            |

## Generation Rules For Agents
- Every worksheet blueprint row must become one worksheet content file.
- Each worksheet content file must still follow `WORKSHEET_CONTENT_TEMPLATE.md`.
- Each worksheet must use exactly 10 pairs from `Worksheet Pair Bank`.
- `pair_ids` in the worksheet blueprint must resolve to valid pair rows.
- Left column order must be randomized.
- Right column order must be randomized.
- Flip side must preserve front order and show correct answer buttons.
- Use only concepts supported by the provided source content.
- Difficulty count must exactly match `easy_count`, `medium_count`, and `hard_count`.

## Level Measurement Plan
Use worksheet performance to estimate achieved level for the topic.

- easy_mastery_threshold: 80%
- medium_mastery_threshold: 70%
- hard_mastery_threshold: 60%

## Achievement Decision Rules
- Emerging: learner clears easy only.
- Developing: learner clears easy and some medium.
- Proficient: learner clears easy and medium.
- Advanced: learner clears easy, medium, and hard.

## Assessment Capture Template
Fill this after worksheet evaluation.

Status rules:
- `pending`: worksheet not checked yet
- `evaluated`: raw score entered, generator should convert to `pass` or `fail`
- `pass` / `fail`: allowed final values after score update

| worksheet_id        | difficulty | total_items | correct_items | score_percent | status  |
| ------------------- | ---------- | ----------- | ------------- | ------------- | ------- |
| WS_SXXX_SET01_TOPIC | easy       | 10          | 0             | 0             | pending |

## Final Topic-Level Output
- achieved_level: Emerging | Developing | Proficient | Advanced
- strengths_observed: <replace>
- gaps_observed: <replace>
- recommended_next_content: text | image | audio | video
- recommended_next_worksheet_difficulty: easy | medium | hard