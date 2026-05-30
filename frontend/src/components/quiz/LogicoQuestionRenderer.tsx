import React, { useMemo, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { QuestionTheme } from './QuizRenderer';
import { resolveMediaUrl } from './QuizRenderer';

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
const HEADER_HEIGHT_RATIO = 0.04;

const parseButton = (buttonId: string) => {
  const [color = 'gray', variant = 'solid'] = buttonId.toLowerCase().split('-');
  return { color, variant };
};
const colorHex: Record<string, string> = {
  red: '#ef4444', green: '#22c55e', blue: '#3b82f6', yellow: '#facc15', orange: '#f59e0b',
};
const buttonColor = (buttonId: string) => colorHex[parseButton(buttonId).color] ?? '#6b7280';

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
  const accent = theme?.accent || '#4A90E2';

  const cardImage   = resolveMediaUrl(questionData.prompt_image);
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
  const [rowWidth, setRowWidth]                 = useState(0);

  const boardHeight   = Math.min(560, Math.max(320, screenHeight * 0.62));
  const compact       = screenWidth < 420;
  const slotBtnSize   = compact ? 18 : 20;
  const trayBtnSize   = compact ? 18 : 20;
  const availableCardW = Math.max(140, rowWidth - SLOT_RAIL_WIDTH - RAIL_GAP);
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
            <View style={s.progressPill}>
              <Text style={s.progressTxt}>{placedCount}/10 placed</Text>
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
            <View style={[s.progressPill, { backgroundColor: correctCount === 10 ? '#DCFCE7' : '#FFF3E0' }]}>
              <Text style={[s.progressTxt, { color: correctCount === 10 ? '#16a34a' : '#F97316' }]}>
                {correctCount === 10 ? '✓ All correct' : `${10 - correctCount} incorrect`}
              </Text>
            </View>
            <Pressable style={[s.doneBtn, { backgroundColor: '#4CAF50' }]} onPress={handleConfirm}>
              <Text style={s.doneBtnText}>Confirm →</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* ── Board ─────────────────────────────────────────────────────────── */}
      <View style={[s.boardShell, { borderColor: `${accent}40` }]}>
        <View style={s.cardAndRailRow} onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>

          {/* Card */}
          <View style={s.cardWrap}>
            <View style={[s.cardFrame, { height: cardHeight, width: cardWidth }]}>
              {cardImage ? <Image source={{ uri: cardImage }} style={s.cardImage} resizeMode="stretch" /> : null}
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
            </View>
          </View>

          {/* Slot rail */}
          <View style={[s.slotRail, { height: cardHeight }]}>
            <View style={[s.railHeaderSpacer, { height: headerHeight }]} />
            <View style={s.railRowsWrap}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((slotId) => (
                <Pressable key={slotId} style={s.slotCell} onPress={() => onSlotPress(slotId)}>
                  <View style={[s.slotHole, { backgroundColor: slotHoleBg(slotId) }]}>
                    {placements[slotId] ? <LogicoButton buttonId={placements[slotId]} size={slotBtnSize} /> : null}
                  </View>
                  {/* Review: small tick/cross overlay */}
                  {phase === 'review' && slotResult[slotId] && (
                    <View style={[s.slotBadge, { backgroundColor: slotResult[slotId] === 'correct' ? '#16a34a' : '#dc2626' }]}>
                      <Text style={s.slotBadgeText}>{slotResult[slotId] === 'correct' ? '✓' : '✗'}</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Button tray */}
        <View style={[s.parkingTray, phase === 'review' && { opacity: 0.45 }]}>
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
                  selected && { borderColor: accent, borderWidth: 2 },
                  occupied && s.parkingItemDisabled,
                ]}
              >
                <LogicoButton buttonId={buttonId} size={trayBtnSize} />
              </Pressable>
            );
          })}
        </View>
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
            <View style={[s.legendDot, { backgroundColor: '#4A90E2' }]} />
            <Text style={s.legendTxt}>Answer shown on card</Text>
          </View>
        </View>
      )}
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
  resultSub:   { fontSize: 11, color: '#6B7280', fontWeight: '500' },

  // Toolbar
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  progressPill: {
    flex: 1, backgroundColor: '#F0F4FF', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  progressTxt: { fontSize: 12, fontWeight: '700', color: '#4A90E2' },
  doneBtn:     { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 9 },
  doneBtnText: { color: '#fff', fontSize: 13, fontWeight: '900' },

  // Board
  boardShell: {
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, padding: 4, gap: 6,
  },
  cardAndRailRow: { flexDirection: 'row', gap: RAIL_GAP },
  cardWrap:       { flex: 1, alignItems: 'center' },
  cardFrame: {
    aspectRatio: CARD_ASPECT, maxWidth: '100%', borderRadius: 8,
    overflow: 'hidden', borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#f8fafc',
  },
  cardImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  optionOverlayCol: {
    position: 'absolute', right: 0, top: 0, width: '18%', height: '100%',
    backgroundColor: 'transparent',
  },
  optionHeaderSpacer: {},
  optionRowsWrap:     { flex: 1 },
  optionRow: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 2,
  },

  // Slot rail
  slotRail: {
    width: SLOT_RAIL_WIDTH, borderRadius: 8, backgroundColor: '#f1f5f9',
    borderWidth: 1, borderColor: '#cbd5e1', overflow: 'visible',
  },
  railHeaderSpacer: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  railRowsWrap: { flex: 1 },
  slotCell: {
    flex: 1, borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
    alignItems: 'center', justifyContent: 'center',
  },
  slotHole: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    borderColor: '#334155', alignItems: 'center', justifyContent: 'center',
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
  },
  parkingItem: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderColor: 'transparent',
  },
  parkingItemDisabled: { opacity: 0 },

  // Button
  buttonOuter: { borderWidth: 2, borderColor: '#1f2937', alignItems: 'center', justifyContent: 'center' },
  buttonInnerRing: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#9ca3af' },

  // Misc
  errorText: { fontSize: 12, fontWeight: '700', color: '#dc2626', textAlign: 'center' },
  legend: { flexDirection: 'row', gap: 14, justifyContent: 'center', flexWrap: 'wrap', paddingTop: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendTxt: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
});
