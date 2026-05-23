import { SlotPosition } from '../types';
import { LOGICO_OPTION_BOX_HEIGHT_FRAC } from '../constants/logicoLayout';

export interface AlignedRowLayout {
  cardWidth: number;
  cardHeight: number;
  leftWidth: number;
  optionsWidth: number;
  frameRailWidth: number;
  gap: number;
}

/**
 * Card + frame rail: card uses full width of left+options;
 * frame rail sits beside the options column only.
 */
export function computeAlignedRowLayout(
  stageWidth: number,
  stageHeight: number,
  cardAspectRatio: number,
  optionsColumnWidthFrac: number,
  frameRailWidth: number,
  gap = 8
): AlignedRowLayout {
  const leftFrac = 1 - optionsColumnWidthFrac;
  const maxH = stageHeight;
  const maxCardPlusRail = stageWidth - frameRailWidth - gap;

  let cardHeight = maxH;
  let cardWidth = cardHeight * cardAspectRatio;

  if (cardWidth > maxCardPlusRail) {
    cardWidth = maxCardPlusRail;
    cardHeight = cardWidth / cardAspectRatio;
  }

  return {
    cardWidth,
    cardHeight,
    leftWidth: cardWidth * leftFrac,
    optionsWidth: cardWidth * optionsColumnWidthFrac,
    frameRailWidth,
    gap,
  };
}

/** Equal divisions: slot i center Y in 0–1 (for metadata / scoring) */
export function buildEqualDivisionSlotPositions(
  slotCount: number,
  headerHeight = 0.145,
  bottomInset = 0.02
): SlotPosition[] {
  const contentTop = headerHeight;
  const contentBottom = 1 - bottomInset;
  const contentHeight = contentBottom - contentTop;
  const cellH = contentHeight / slotCount;

  return Array.from({ length: slotCount }, (_, i) => ({
    id: i + 1,
    y: contentTop + cellH * i + cellH / 2,
    height: cellH * 0.9,
  }));
}

export function buildEvenSlotPositions(
  count: number,
  topInset = 0.14,
  bottomInset = 0.05
): SlotPosition[] {
  return buildEqualDivisionSlotPositions(count, topInset, bottomInset);
}
