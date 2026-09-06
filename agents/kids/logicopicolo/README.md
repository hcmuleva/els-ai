# Logico Piccolo Worksheet System

This folder contains a fixed-structure worksheet generation system for Logico Piccolo.
It is split into three layers so content changes do not break frame compatibility.

## Folder Structure
- `content/`: worksheet content contract and data templates
- `visual/`: locked visual system (layout + fixed color buttons)
- `validation/`: rules to verify answer and frame mapping
- `results/`: generated worksheet files (front + flip side)

## End-To-End Topic Flow
Use the system in 3 steps when a topic includes teaching content plus assessment.

1. Create a topic package using `content/TOPIC_LEARNING_PACKAGE_TEMPLATE.md`.
2. Generate worksheet content files and result HTML from that package.
3. After worksheet completion, record level achievement using `content/TOPIC_ACHIEVEMENT_REPORT_TEMPLATE.md`.

This allows one topic to connect:
- teaching content from text, image, audio, and video
- worksheet counts by difficulty: easy, medium, hard
- topic-level achievement measurement

## Core Rule
The frame color/button order is frozen.
Do not change button order, button IDs, or slot mapping.
Always place the slot button inside each item box (next to the emoji/illustration), not in a bottom strip.

## Fixed Button Set (Always in Context)
Use these files from `visual/buttons/` in every worksheet:
1. `btn-01-red.svg`
2. `btn-02-green.svg`
3. `btn-03-blue.svg`
4. `btn-04-yellow.svg`
5. `btn-05-orange.svg`
6. `btn-06-red-white-top.svg`
7. `btn-07-green-white-top.svg`
8. `btn-08-blue-white-top.svg`
9. `btn-09-yellow-white-top.svg`
10. `btn-10-orange-white-top.svg`

## How To Generate A New Worksheet
1. If starting from a lesson/topic, first fill `content/TOPIC_LEARNING_PACKAGE_TEMPLATE.md`.
2. Fill `Worksheet Blueprint Table` and `Worksheet Pair Bank` in the topic package.
3. Run:
   `node agent/prompts/els-system/logicopicolo/generate-topic-package.js agent/prompts/els-system/logicopicolo/content/<package-file>.md`
4. The generator will create worksheet content files in `content/` and front/flip HTML files in `results/`.
5. Validate with `validation/VALIDATION_CHECKLIST.md`.

## Package Generator Contract
- `Worksheet Blueprint Table` controls how many worksheets are created.
- `pair_ids` must list exactly 10 pair IDs per worksheet.
- `Worksheet Pair Bank` provides the actual left/right matches used to build worksheets.
- Left and right display orders are randomized deterministically from `worksheet_id`.
- Slot-to-button mapping remains fixed as `S1..S10`.

## Example Package
- `content/PKG_S301_PLANT_SYSTEMS_01.md`
- Generate with:
  `node agent/prompts/els-system/logicopicolo/generate-topic-package.js agent/prompts/els-system/logicopicolo/content/PKG_S301_PLANT_SYSTEMS_01.md`

## Achievement Report Generation
After worksheet scores are filled into the package file's `Assessment Capture Template`, run:

`node agent/prompts/els-system/logicopicolo/update-package-scores.js agent/prompts/els-system/logicopicolo/content/<package-file>.md`

This updates `score_percent` and converts `status: evaluated` rows into `pass` or `fail` using the package thresholds.

Then run:

`node agent/prompts/els-system/logicopicolo/generate-achievement-report.js agent/prompts/els-system/logicopicolo/content/<package-file>.md`

This creates a topic-level achievement report in `results/`.
- If any worksheet remains `pending`, the achieved level is generated as `Not Assessed`.

## Topic Package Rules
- A topic package may include any mix of text, image, audio, and video content.
- Worksheet generation counts must be explicitly defined: `easy_count`, `medium_count`, `hard_count`.
- Every generated worksheet must map back to a concept and source modality from the package.
- Topic-level achievement must be decided from worksheet performance, not by content presence alone.

## Required Output Per Worksheet
For each worksheet, always generate both files:
- `<worksheet_id>_front.html`
- `<worksheet_id>_flip.html`

Flip side must contain the correct mapping for all 10 frame slots.
Front side must show one fixed frame button inside each of the 10 left item boxes.
Front side left card positions must be randomized (avoid S1..S10 visual order).
Flip side must reuse the same board layout as front and show the correct slot button next to each right-side option.
Flip side left card order must exactly match the randomized front-side left order.

## Example
- Topic: `Food Chain Matching`
- Outputs:
  - `results/WS_S301_SET02_FOOD_CHAIN_front.html`
  - `results/WS_S301_SET02_FOOD_CHAIN_flip.html`

## Change Guidance
- Change topic/content only: edit content file.
- Keep same structure output: do not edit visual layout template or slot schema.
- Keep fixed frame colors: do not edit `visual/buttons/` files or `visual/fixed_frame_palette.json`.
