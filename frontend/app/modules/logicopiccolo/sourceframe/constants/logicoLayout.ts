import { CardLayoutSplit } from '../types';
import { buildEqualDivisionSlotPositions } from '../utils/cardLayout';

export const LOGICO_CARD_WIDTH = 526;
export const LOGICO_CARD_HEIGHT = 725;
export const LOGICO_SLOT_COUNT = 10;

export const LOGICO_LAYOUT_SPLIT: CardLayoutSplit = {
  optionsColumnStartX: 0.82,
  optionsColumnWidth: 0.18,
  headerHeight: 0.145,
  railOffsetRows: -0.58,
};

export const LOGICO_OPTION_BOX_HEIGHT_FRAC = 0.052;

/** 10 equal rows below header — card options + frame slots share this grid */
export function buildLogicoTenSlotPositions(): ReturnType<typeof buildEqualDivisionSlotPositions> {
  return buildEqualDivisionSlotPositions(
    LOGICO_SLOT_COUNT,
    LOGICO_LAYOUT_SPLIT.headerHeight ?? 0.145,
    0.02
  );
}
