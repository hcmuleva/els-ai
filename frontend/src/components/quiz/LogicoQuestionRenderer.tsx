import React, { useMemo, useState } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Maximize2, X } from 'lucide-react-native';
import type { QuestionTheme } from './QuizRenderer';
import { resolveMediaUrl } from './QuizRenderer';
import SafeImage from './SafeImage';

type LogicoOptionSlot = { id: number; value?: string };

type Props = {
  questionData: {
    prompt_image?: string;
    button_slot_map?: Record<string, number>;
    option_slots?: LogicoOptionSlot[];
    logico_buttons?: string[];
  };
  onComplete: (isCorrect: boolean, responseData: any) => void;
  theme?: QuestionTheme;
};

const DEFAULT_BUTTONS = [
  'red-solid', 'green-solid', 'blue-solid', 'yellow-solid', 'orange-solid',
  'red-ring',  'green-ring',  'blue-ring',  'yellow-ring',  'orange-ring',
];
const CARD_ASPECT       = 526 / 725;
const SLOT_RAIL_WIDTH   = 54;
const RAIL_GAP          = 2;
const HEADER_HEIGHT_RATIO = 0.08;

const parseButton = (buttonId: string) => {
  const [color = 'gray', variant = 'solid'] = buttonId.toLowerCase().split('-');
  return { color, variant };
};
const colorHex: Record<string, string> = {
  red: '#ef4444', green: '#22c55e', blue: '#3b82f6', yellow: '#facc15', orange: '#f59e0b',
};
const buttonColor = (buttonId: string) => colorHex[parseButton(buttonId).color] ?? '#525C6B';

function LogicoButton({ buttonId, size = 28 }: { buttonId: string; size?: number }) {
  const { variant } = parseButton(buttonId);
  const color = buttonColor(buttonId);
  return (
    <View style={[s.buttonOuter, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      {variant === 'ring' ? (
        <View style={[s.buttonInnerRing, { width: size * 0.44, height: size * 0.44, borderRadius: (size * 0.44) / 2 }]} />
      ) : null}
    </View>
  );
}

type Phase = 'playing' | 'review';

export default function LogicoQuestionRenderer({ questionData, onComplete, theme }: Props) {
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const isDesktop = screenWidth >= 640;
  const accent = theme?.accent || '#2D5DC9';
  const rawQuestionData = questionData as Record<string, unknown>;

  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const [draggedHoverSlotId, setDraggedHoverSlotId] = useState<number | null>(null);

  const cardImage = resolveMediaUrl(
    String(
      questionData.prompt_image ??
        rawQuestionData.promptImage ??
        rawQuestionData.mainImage ??
        rawQuestionData.main_image ??
        rawQuestionData.worksheetImage ??
        rawQuestionData.worksheet_image ??
        rawQuestionData.image ??
        rawQuestionData.imageUrl ??
        '',
    ).trim(),
  );
  const optionSlots = useMemo(() => {
    const source = Array.isArray(questionData.option_slots) ? questionData.option_slots : [];
    return source.length === 10 ? source : Array.from({ length: 10 }, (_, i) => ({ id: i + 1, value: '' }));
  }, [questionData.option_slots]);
  const buttonIds  = questionData.logico_buttons?.length === 10 ? questionData.logico_buttons : DEFAULT_BUTTONS;
  const expectedMap = questionData.button_slot_map || {};

  const [selectedButtonId, setSelectedButtonId] = useState<string | null>(null);
  const [placements, setPlacements]             = useState<Record<number, string>>({});
  const [errorText, setErrorText]               = useState('');
  const [phase, setPhase]                       = useState<Phase>('playing');

  const maxBoardH = isDesktop
    ? Math.max(500, screenHeight - 190)
    : Math.min(560, Math.max(320, screenHeight * 0.62));
  const boardHeight = maxBoardH;
  const compact       = screenWidth < 480;
  const slotBtnSize   = compact ? 18 : 22;
  const trayBtnSize   = compact ? 20 : 26;

  const trayWidth = isDesktop ? 70 : 0;
  const availableCardW = Math.max(140, screenWidth - trayWidth - SLOT_RAIL_WIDTH - 60);
  const cardHeight    = Math.min(boardHeight, availableCardW / CARD_ASPECT);
  const cardWidth     = Math.max(120, cardHeight * CARD_ASPECT);
  const headerHeight  = cardHeight * HEADER_HEIGHT_RATIO;

  const placedCount = Object.keys(placements).length;
  const placedSet   = useMemo(() => new Set(Object.values(placements)), [placements]);

  // Per-slot correctness in review phase
  const slotResult = useMemo((): Record<number, 'correct' | 'wrong' | 'empty'> => {
    if (phase !== 'review') return {};
    const out: Record<number, 'correct' | 'wrong' | 'empty'> = {};
    for (let id = 1; id <= 10; id++) {
      const placed   = placements[id];
      const expected = buttonIds.find((b) => Number(expectedMap[b]) === id) ?? null;
      if (!placed)                    out[id] = 'empty';
      else if (placed === expected)   out[id] = 'correct';
      else                            out[id] = 'wrong';
    }
    return out;
  }, [phase, placements, buttonIds, expectedMap]);

  const correctCount = useMemo(
    () => Object.values(slotResult).filter((v) => v === 'correct').length,
    [slotResult],
  );

  const expectedButtonForSlot = (slotId: number) =>
    buttonIds.find((b) => Number(expectedMap[b]) === slotId) ?? null;

  // ── Drag & Drop Handlers (Web) ──────────────────────────────────────────────
  const getWebDragProps = (buttonId: string) =>
    Platform.OS === 'web'
      ? ({
          draggable: true,
          onDragStart: (e: any) => {
            if (e?.dataTransfer) {
              e.dataTransfer.setData('text/plain', buttonId);
              e.dataTransfer.effectAllowed = 'move';
            }
            setSelectedButtonId(buttonId);
          },
        } as any)
      : {};

  const getWebDropProps = (slotId: number) =>
    Platform.OS === 'web'
      ? ({
          onDragOver: (e: any) => {
            if (e?.preventDefault) e.preventDefault();
            if (e?.dataTransfer) e.dataTransfer.dropEffect = 'move';
            setDraggedHoverSlotId(slotId);
          },
          onDragLeave: () => {
            setDraggedHoverSlotId((curr) => (curr === slotId ? null : curr));
          },
          onDrop: (e: any) => {
            if (e?.preventDefault) e.preventDefault();
            setDraggedHoverSlotId(null);
            const draggedId = e?.dataTransfer?.getData('text/plain') || selectedButtonId;
            if (draggedId && phase === 'playing') {
              setPlacements((prev) => ({ ...prev, [slotId]: draggedId }));
              setSelectedButtonId(null);
            }
          },
        } as any)
      : {};

  // ── Slot press (playing only) ───────────────────────────────────────────────
  const onSlotPress = (slotId: number) => {
    if (phase !== 'playing') return;
    setErrorText('');
    const existing = placements[slotId];
    if (existing) {
      const next = { ...placements };
      delete next[slotId];
      setPlacements(next);
      return;
    }
    if (!selectedButtonId) return;
    setPlacements((prev) => ({ ...prev, [slotId]: selectedButtonId }));
    setSelectedButtonId(null);
  };

  // ── Done → enter review ─────────────────────────────────────────────────────
  const handleDone = () => {
    if (placedCount !== 10) { setErrorText('Place all 10 buttons first.'); return; }
    setErrorText('');
    setPhase('review');
  };

  // ── Confirm → finish ────────────────────────────────────────────────────────
  const handleConfirm = () => {
    const isCorrect = correctCount === 10;
    onComplete(isCorrect, { placements, expected: expectedMap, correctCount, totalSlots: 10 });
  };

  // ── Slot hole colour in review ──────────────────────────────────────────────
  const slotHoleBg   = (slotId: number) => {
    if (phase !== 'review') return '#1f2937';
    const r = slotResult[slotId];
    if (r === 'correct') return '#16a34a';
    if (r === 'wrong')   return '#dc2626';
    return '#1f2937';
  };

  const renderParkingTray = (isVertical = false) => (
    <View
      style={[
        isVertical ? s.parkingTrayVertical : s.parkingTray,
        phase === 'review' && { opacity: 0.45 },
      ]}
    >
      {buttonIds.map((buttonId) => {
        const occupied = placedSet.has(buttonId);
        const selected = selectedButtonId === buttonId;
        return (
          <Pressable
            key={buttonId}
            disabled={occupied || phase === 'review'}
            onPress={() => setSelectedButtonId(selected ? null : buttonId)}
            style={[
              s.parkingItem,
              selected && s.parkingItemSelected,
              occupied && s.parkingItemDisabled,
            ]}
            {...getWebDragProps(buttonId)}
          >
            <LogicoButton buttonId={buttonId} size={isVertical ? 24 : trayBtnSize} />
            {selected ? (
              <View style={s.selectedCheckBadge}>
                <Text style={s.selectedCheckBadgeText}>✓</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={s.container}>

      {/* ── Review banner ─────────────────────────────────────────────────── */}
      {phase === 'review' && (
        <View style={s.resultBanner}>
          <Text style={s.resultScore}>{correctCount}/10</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.resultLabel}>
              {correctCount === 10 ? '🎉 Perfect score!' : correctCount >= 7 ? '👍 Good job!' : '💡 Keep practising!'}
            </Text>
            <Text style={s.resultSub}>Correct answers shown on the card. Review then confirm.</Text>
          </View>
        </View>
      )}

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <View style={s.toolbar}>
        {phase === 'playing' ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={s.progressPill}>
                <Text style={s.progressTxt}>{placedCount}/10 placed</Text>
              </View>
              {cardImage ? (
                <Pressable style={s.expandBtn} onPress={() => setIsImageExpanded(true)}>
                  <Maximize2 size={13} color="#4F46E5" />
                  <Text style={s.expandBtnText}>Expand Image</Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable
              disabled={placedCount !== 10}
              style={[s.doneBtn, { backgroundColor: placedCount === 10 ? accent : '#D0D4E8' }]}
              onPress={handleDone}
            >
              <Text style={s.doneBtnText}>Done ✓</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[s.progressPill, { backgroundColor: correctCount === 10 ? '#DCFCE7' : '#FFF3E0' }]}>
                <Text style={[s.progressTxt, { color: correctCount === 10 ? '#16a34a' : '#F97316' }]}>
                  {correctCount === 10 ? '✓ All correct' : `${10 - correctCount} incorrect`}
                </Text>
              </View>
              {cardImage ? (
                <Pressable style={s.expandBtn} onPress={() => setIsImageExpanded(true)}>
                  <Maximize2 size={13} color="#4F46E5" />
                  <Text style={s.expandBtnText}>Expand Image</Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable style={[s.doneBtn, { backgroundColor: '#4CAF50' }]} onPress={handleConfirm}>
              <Text style={s.doneBtnText}>Confirm →</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* ── Board Shell ─────────────────────────────────────────────────── */}
      <View style={s.boardShell}>
        <View style={s.mainLayoutRow}>

          {/* Left: Button Tray (Desktop / Larger screens) */}
          {isDesktop ? (
            <View style={s.leftTrayPanel}>
              <Text style={s.trayTitle}>Buttons</Text>
              {renderParkingTray(true)}
            </View>
          ) : null}

          {/* Middle: Card Image + Right: Slot Rail */}
          <View style={s.cardAndRailWrap}>
            {/* Card Frame */}
            <Pressable
              onPress={() => setIsImageExpanded(true)}
              style={[s.cardFrame, { height: cardHeight, width: cardWidth }]}
            >
              {cardImage ? <SafeImage uri={cardImage} style={s.cardImage} resizeMode="stretch" /> : null}
              {/* Correct-answer overlay — shown only in review */}
              <View style={s.optionOverlayCol}>
                <View style={[s.optionHeaderSpacer, { height: headerHeight }]} />
                <View style={s.optionRowsWrap}>
                  {optionSlots.map((slot) => {
                    const expectedBtn = expectedButtonForSlot(slot.id);
                    return (
                      <View key={slot.id} style={s.optionRow}>
                        {phase === 'review' && expectedBtn ? (
                          <LogicoButton buttonId={expectedBtn} size={slotBtnSize} />
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            </Pressable>

            {/* Slot Rail */}
            <View style={[s.slotRail, { height: cardHeight }]}>
              <View style={[s.railHeaderSpacer, { height: headerHeight }]} />
              <View style={s.railRowsWrap}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((slotId) => {
                  const isHovered = draggedHoverSlotId === slotId;
                  return (
                    <Pressable
                      key={slotId}
                      style={[s.slotCell, isHovered && s.slotCellHovered]}
                      onPress={() => onSlotPress(slotId)}
                      {...getWebDropProps(slotId)}
                    >
                      <View style={[s.slotHole, { backgroundColor: slotHoleBg(slotId) }, isHovered && s.slotHoleHovered]}>
                        {placements[slotId] ? <LogicoButton buttonId={placements[slotId]} size={slotBtnSize} /> : null}
                      </View>
                      {/* Review: small tick/cross overlay */}
                      {phase === 'review' && slotResult[slotId] && (
                        <View style={[s.slotBadge, { backgroundColor: slotResult[slotId] === 'correct' ? '#16a34a' : '#dc2626' }]}>
                          <Text style={s.slotBadgeText}>{slotResult[slotId] === 'correct' ? '✓' : '✗'}</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        {/* Bottom Tray (Mobile / Smaller screens) */}
        {!isDesktop ? renderParkingTray(false) : null}
      </View>

      {errorText ? <Text style={s.errorText}>{errorText}</Text> : null}

      {/* Review legend */}
      {phase === 'review' && (
        <View style={s.legend}>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: '#16a34a' }]} />
            <Text style={s.legendTxt}>Correct slot</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: '#dc2626' }]} />
            <Text style={s.legendTxt}>Wrong slot</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: '#2D5DC9' }]} />
            <Text style={s.legendTxt}>Answer shown on card</Text>
          </View>
        </View>
      )}

      {/* Expanded Worksheet Image Lightbox Modal */}
      {isImageExpanded && cardImage ? (
        <Modal
          visible={isImageExpanded}
          transparent
          animationType="fade"
          onRequestClose={() => setIsImageExpanded(false)}
        >
          <View style={s.modalBackdrop}>
            <View style={s.modalHeaderRow}>
              <Text style={s.modalImageTitle}>Logico Worksheet Image</Text>
              <Pressable style={s.modalCloseBtn} onPress={() => setIsImageExpanded(false)}>
                <X size={20} color="#fff" />
              </Pressable>
            </View>
            <View style={s.modalBody}>
              <SafeImage uri={cardImage} style={s.expandedImage} resizeMode="contain" />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 8, paddingHorizontal: 0, paddingBottom: 4 },

  // Result banner
  resultBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F0F7FF', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#C5D8F8',
  },
  resultScore: { fontSize: 28, fontWeight: '900', color: '#1a1a2e', minWidth: 52, textAlign: 'center' },
  resultLabel: { fontSize: 15, fontWeight: '800', color: '#1a1a2e', marginBottom: 2 },
  resultSub:   { fontSize: 11, color: '#525C6B', fontWeight: '500' },

  // Toolbar
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  progressPill: {
    backgroundColor: '#F0F4FF', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  progressTxt: { fontSize: 12, fontWeight: '800', color: '#2D5DC9' },
  doneBtn: {
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  doneBtnText: { fontSize: 13, fontWeight: '800', color: '#fff' },

  // Board Shell
  boardShell: {
    borderRadius: 16, borderWidth: 0, padding: 8,
    backgroundColor: 'transparent', gap: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  mainLayoutRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 18, width: '100%',
  },
  leftTrayPanel: {
    alignItems: 'center', gap: 8, paddingRight: 14,
    borderRightWidth: 1.5, borderRightColor: '#e2e8f0',
  },
  trayTitle: {
    fontSize: 11, fontWeight: '800', color: '#4B5768',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  parkingTrayVertical: {
    flexDirection: 'column', flexWrap: 'nowrap',
    width: 44, gap: 6,
    borderRadius: 12, backgroundColor: '#ffffff',
    borderWidth: 1, borderColor: '#cbd5e1', paddingVertical: 8, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'space-around',
  },
  cardAndRailWrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 2,
  },
  cardWrap: { alignItems: 'center' },
  cardFrame: {
    aspectRatio: CARD_ASPECT, borderRadius: 8,
    overflow: 'hidden', borderWidth: 0, backgroundColor: '#ffffff',
  },
  cardImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  optionOverlayCol: {
    position: 'absolute', right: 0, top: 0, width: '18%', height: '100%',
    backgroundColor: 'transparent',
  },
  optionHeaderSpacer: {},
  optionRowsWrap:     { flex: 1, flexDirection: 'column', justifyContent: 'flex-start', gap: 2, paddingVertical: '1%' },
  optionRow: {
    height: '9.3%', alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 2,
  },

  // Slot rail
  slotRail: {
    width: SLOT_RAIL_WIDTH, borderRadius: 8, backgroundColor: '#f1f5f9',
    borderWidth: 1, borderColor: '#cbd5e1', overflow: 'visible',
  },
  railHeaderSpacer: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  railRowsWrap: { flex: 1, flexDirection: 'column', justifyContent: 'flex-start', gap: 2, paddingVertical: '1%' },
  slotCell: {
    height: '9.3%', borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
    alignItems: 'center', justifyContent: 'center',
  },
  slotCellHovered: {
    backgroundColor: '#EDE4FF',
  },
  slotHole: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    borderColor: '#334155', alignItems: 'center', justifyContent: 'center',
  },
  slotHoleHovered: {
    borderColor: '#7B4FCA',
    borderWidth: 3,
    transform: [{ scale: 1.15 }],
  },
  slotBadge: {
    position: 'absolute', top: 1, right: 1,
    width: 13, height: 13, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  slotBadgeText: { fontSize: 7, fontWeight: '900', color: '#fff' },

  // Tray
  parkingTray: {
    flexDirection: 'row', flexWrap: 'nowrap', gap: 0, borderRadius: 12,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    paddingVertical: 5, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'space-between',
    width: '100%',
  },
  parkingItem: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#E2E8F0',
    cursor: 'pointer' as any,
  },
  parkingItemSelected: {
    borderColor: '#4F46E5', borderWidth: 3, backgroundColor: '#EEF2FF',
    transform: [{ scale: 1.22 }],
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 6, elevation: 6, zIndex: 10,
  },
  parkingItemDisabled: { opacity: 0.25, cursor: 'not-allowed' as any },
  selectedCheckBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#FFFFFF',
  },
  selectedCheckBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },

  // Button
  buttonOuter: { borderWidth: 2, borderColor: '#1f2937', alignItems: 'center', justifyContent: 'center' },
  buttonInnerRing: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#9ca3af' },

  // Misc
  errorText: { fontSize: 12, fontWeight: '700', color: '#dc2626', textAlign: 'center' },
  legend: { flexDirection: 'row', gap: 14, justifyContent: 'center', flexWrap: 'wrap', paddingTop: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendTxt: { fontSize: 11, fontWeight: '600', color: '#525C6B' },

  expandBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#C7D2FE' },
  expandBtnText: { fontSize: 12, fontWeight: '700', color: '#4F46E5' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalHeaderRow: { width: '100%', maxWidth: 960, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalImageTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  modalCloseBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255, 255, 255, 0.2)', alignItems: 'center', justifyContent: 'center' },
  modalBody: { width: '100%', maxWidth: 960, height: '82%', alignItems: 'center', justifyContent: 'center' },
  expandedImage: { width: '100%', height: '100%' },
});
