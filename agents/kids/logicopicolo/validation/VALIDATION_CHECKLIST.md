# Worksheet Validation Checklist

## Structure Checks
- [ ] Front file exists: `<worksheet_id>_front.html`
- [ ] Flip file exists: `<worksheet_id>_flip.html`
- [ ] Exactly 10 left slots are present
- [ ] Exactly 10 right options are present
- [ ] Slot IDs are S1..S10 with no duplicates
- [ ] Front left card display order is randomized (not S1..S10 sequence)

## Fixed Frame Checks
- [ ] Fixed palette `LP_FIXED_V1` used
- [ ] Button files used from `visual/buttons/`
- [ ] Color/button order not changed
- [ ] White-top variants remain S6..S10

## Answer Integrity Checks
- [ ] Every slot has exactly one answer mapping
- [ ] Flip side left-card order matches front side left-card order
- [ ] Flip side right-option rows match front side right-option order
- [ ] Flip side shows corresponding correct slot button for each right option
- [ ] No duplicate right_option_id in correct answers unless explicitly required

## Print Checks
- [ ] A4 portrait layout
- [ ] Legible text at print scale
- [ ] Borders and separators visible in black/gray print
