# Worksheet Content Template

## Metadata
- worksheet_id: WS_SXXX_SETXX_TOPIC
- student_id: SXXX
- grade: 6
- topic: <replace>
- language: English
- structure_version: LP_FIXED_V1

## Instruction
Match each left item with the correct right option.

## Slot Contract (Do Not Change)
- Total slots: 10
- Slot IDs: S1, S2, S3, S4, S5, S6, S7, S8, S9, S10
- These map to fixed button IDs from `visual/fixed_frame_palette.json`

## Item Table
| slot_id | left_label | left_icon_key | right_option_id | right_label |
| ------- | ---------- | ------------- | --------------- | ----------- |
| S1      |            |               | R1              |             |
| S2      |            |               | R2              |             |
| S3      |            |               | R3              |             |
| S4      |            |               | R4              |             |
| S5      |            |               | R5              |             |
| S6      |            |               | R6              |             |
| S7      |            |               | R7              |             |
| S8      |            |               | R8              |             |
| S9      |            |               | R9              |             |
| S10     |            |               | R10             |             |

## Left Column Display Order
Front side left cards must be shown in randomized visual order (not S1..S10 sequence).
Each card must still display its original slot ID and fixed slot button.
Flip side must reuse the exact same left card order as front side.

Example randomized left order:
- S4
- S1
- S7
- S10
- S2
- S9
- S5
- S3
- S8
- S6

## Right Column Display Order
Front side right options should be shown in randomized display order while preserving unique IDs R1..R10.
- R1
- R2
- R3
- R4
- R5
- R6
- R7
- R8
- R9
- R10

## Flip Side Right Column (Answer View)
Flip side must reuse the same right option order as the front side.
For each right option row, include the fixed slot button of the correct answer slot.
Example row structure:
- right_option_id: R4
- right_label: Den
- correct_slot_id: S4
- button_file: `visual/buttons/btn-04-yellow.svg`

## Answer Mapping
- S1 -> R1
- S2 -> R2
- S3 -> R3
- S4 -> R4
- S5 -> R5
- S6 -> R6
- S7 -> R7
- S8 -> R8
- S9 -> R9
- S10 -> R10
