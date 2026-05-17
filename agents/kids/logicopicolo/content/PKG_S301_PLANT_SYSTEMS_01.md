# Topic Learning Package: PKG_S301_PLANT_SYSTEMS_01

## Metadata
- package_id: PKG_S301_PLANT_SYSTEMS_01
- student_id: S301
- grade: 6
- topic: Plant Parts and Plant Systems
- language: English
- generated_for_cycle: 2026-05-17

## Topic Goal
- Learner should understand plant parts, their functions, and how these parts support plant growth, protection, and reproduction.

## Learning Objectives
- LO1: Identify major plant parts.
- LO2: Match plant parts with their functions.
- LO3: Connect plant structures with survival and reproduction.

## Teaching Content Inputs

### Text Content
- required: yes
- title: Plant Parts Overview
- source_type: lesson_note
- source_path_or_url: lesson/plant-parts-overview.md
- summary_for_agent: Explains root, stem, leaf, flower, fruit, seed, bark, petal, sepal, and stomata with examples.

### Image Content
- required: yes
- source_path_or_url: lesson/plant-parts-diagram.png
- image_purpose: labeling
- summary_for_agent: Labeled plant diagram showing external structures.

### Audio Content
- required: no
- source_path_or_url: none
- audio_purpose: explanation
- summary_for_agent: not used for this package.

### Video Content
- required: yes
- source_path_or_url: lesson/how-plants-grow.mp4
- video_purpose: concept teaching
- summary_for_agent: Demonstrates water absorption, growth, flowering, seed formation, and pollination.

## Concept Coverage Map
| concept_id | concept_name | source_modality | priority | notes |
| ---------- | ------------ | --------------- | -------- | ----- |
| C1         | Plant part identification | text  | high   | Base recognition |
| C2         | Plant part function       | image | high   | Match structure to role |
| C3         | Protection and reproduction | video | medium | Deeper conceptual link |
| C4         | Gas exchange and support systems | video | medium | Advanced application |

## Worksheet Generation Request
- easy_count: 1
- medium_count: 1
- hard_count: 1
- total_expected_worksheets: 3

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
| worksheet_id | difficulty | concept_focus | source_modality_used | instruction_type | target_skill | pair_ids |
| --- | --- | --- | --- | --- | --- | --- |
| WS_S301_SET11_PLANT_PARTS_BASICS | easy | plant part identification | text | match | recall | P1,P2,P3,P4,P5,P6,P7,P8,P9,P10 |
| WS_S301_SET12_PLANT_PARTS_FUNCTIONS | medium | plant functions | image | match | understanding | P1,P2,P3,P4,P5,P6,P7,P8,P9,P11 |
| WS_S301_SET13_PLANT_SYSTEMS_ADVANCED | hard | plant survival systems | video | match | application | P1,P2,P3,P4,P6,P7,P8,P9,P11,P12 |

## Worksheet Pair Bank
| pair_id | left_label | left_icon_key | right_label | concept_focus | source_modality | difficulty_tags |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | Root | root | Absorbs water and minerals | plant part identification | text | easy,medium,hard |
| P2 | Stem | stem | Supports plant and transports food | plant part identification | text | easy,medium,hard |
| P3 | Leaf | leaf | Makes food by photosynthesis | plant functions | image | easy,medium,hard |
| P4 | Flower | flower | Reproduction in plants | plant functions | image | easy,medium,hard |
| P5 | Fruit | fruit | Protects seeds | plant functions | image | easy,medium |
| P6 | Seed | seed | Grows into a new plant | plant survival systems | video | easy,medium,hard |
| P7 | Bud | bud | Develops into flower or leaf | plant part identification | text | easy,medium,hard |
| P8 | Bark | bark | Protects the stem | plant survival systems | video | easy,medium,hard |
| P9 | Vein | vein | Carries water and food in leaf | plant systems | image | easy,medium,hard |
| P10 | Petal | petal | Attracts pollinators | plant functions | image | easy |
| P11 | Sepal | sepal | Protects the flower bud | plant systems | video | medium,hard |
| P12 | Stomata | stomata | Helps gas exchange | plant systems | video | hard |

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
- easy_mastery_threshold: 80%
- medium_mastery_threshold: 70%
- hard_mastery_threshold: 60%

## Achievement Decision Rules
- Emerging: learner clears easy only.
- Developing: learner clears easy and some medium.
- Proficient: learner clears easy and medium.
- Advanced: learner clears easy, medium, and hard.

## Assessment Capture Template
Status rules:
- `pending`: worksheet not checked yet
- `evaluated`: raw score entered, generator should convert to `pass` or `fail`
- `pass` / `fail`: allowed final values after score update

| worksheet_id | difficulty | total_items | correct_items | score_percent | status |
| --- | --- | --- | --- | --- | --- |
| WS_S301_SET11_PLANT_PARTS_BASICS | easy | 10 | 0 | 0 | pending |
| WS_S301_SET12_PLANT_PARTS_FUNCTIONS | medium | 10 | 0 | 0 | pending |
| WS_S301_SET13_PLANT_SYSTEMS_ADVANCED | hard | 10 | 0 | 0 | pending |

## Final Topic-Level Output
- achieved_level: Not Assessed | Emerging | Developing | Proficient | Advanced
- strengths_observed: <replace>
- gaps_observed: <replace>
- recommended_next_content: text | image | audio | video
- recommended_next_worksheet_difficulty: easy | medium | hard

