import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { QuestionTheme } from './QuizRenderer';
import { resolveMediaUrl } from './QuizRenderer';

type LogicoOptionSlot = {
  id: number;
  value?: string;
};

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
  'red-solid',
  'green-solid',
  'blue-solid',
  'yellow-solid',
  'orange-solid',
  'red-ring',
  'green-ring',
  'blue-ring',
  'yellow-ring',
  'orange-ring',
];
const CARD_ASPECT = 526 / 725;
const SLOT_RAIL_WIDTH = 54;
const RAIL_GAP = 2;
const HEADER_HEIGHT_RATIO = 0.04;

const parseButton = (buttonId: string) => {
  const [color = 'gray', variant = 'solid'] = buttonId.toLowerCase().split('-');
  return { color, variant };
};

const colorHex: Record<string, string> = {
  red: '#ef4444',
  green: '#22c55e',
  blue: '#3b82f6',
  yellow: '#facc15',
  orange: '#f59e0b',
};

const buttonColor = (buttonId: string) => colorHex[parseButton(buttonId).color] ?? '#6b7280';

function LogicoButton({ buttonId, size = 28 }: { buttonId: string; size?: number }) {
  const { variant } = parseButton(buttonId);
  const color = buttonColor(buttonId);
  return (
    <View
      style={[
        styles.buttonOuter,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
      ]}
    >
      {variant === 'ring' ? (
        <View
          style={[
            styles.buttonInnerRing,
            { width: size * 0.44, height: size * 0.44, borderRadius: (size * 0.44) / 2 },
          ]}
        />
      ) : null}
    </View>
  );
}

export default function LogicoQuestionRenderer({ questionData, onComplete, theme }: Props) {
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const accent = theme?.accent || '#4A90E2';
  const cardImage = resolveMediaUrl(questionData.prompt_image);
  const optionSlots = useMemo(() => {
    const source = Array.isArray(questionData.option_slots) ? questionData.option_slots : [];
    if (source.length === 10) return source;
    return Array.from({ length: 10 }, (_, i) => ({ id: i + 1, value: '' }));
  }, [questionData.option_slots]);
  const buttonIds = questionData.logico_buttons?.length === 10 ? questionData.logico_buttons : DEFAULT_BUTTONS;
  const expectedMap = questionData.button_slot_map || {};

  const [selectedButtonId, setSelectedButtonId] = useState<string | null>(null);
  const [placements, setPlacements] = useState<Record<number, string>>({});
  const [showClip, setShowClip] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [rowWidth, setRowWidth] = useState(0);
  const boardHeight = Math.min(560, Math.max(320, screenHeight * 0.62));
  const compact = screenWidth < 420;
  const slotButtonSize = compact ? 18 : 20;
  const trayButtonSize = compact ? 18 : 20;
  const availableCardWidth = Math.max(140, rowWidth - SLOT_RAIL_WIDTH - RAIL_GAP);
  const cardHeight = Math.min(boardHeight, availableCardWidth / CARD_ASPECT);
  const cardWidth = Math.max(120, cardHeight * CARD_ASPECT);

  const headerHeight = cardHeight * HEADER_HEIGHT_RATIO;
  const placedSet = useMemo(() => new Set(Object.values(placements)), [placements]);

  const onSlotPress = (slotId: number) => {
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

  const handleCheck = () => {
    if (Object.keys(placements).length !== 10) {
      setErrorText('Place all 10 buttons before checking.');
      return;
    }
    const isCorrect = buttonIds.every((buttonId) => {
      const expectedSlot = Number(expectedMap[buttonId]);
      if (!Number.isInteger(expectedSlot)) return false;
      return placements[expectedSlot] === buttonId;
    });
    onComplete(isCorrect, { placements, expected: expectedMap, showClip });
  };

  const expectedButtonForSlot = (slotId: number) =>
    buttonIds.find((buttonId) => Number(expectedMap[buttonId]) === slotId) || null;

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Pressable style={[styles.toolbarBtn, { borderColor: accent }]} onPress={() => setShowClip((v) => !v)}>
          <Text style={[styles.toolbarBtnText, { color: accent }]}>{showClip ? 'Hide Clip' : 'Clip'}</Text>
        </Pressable>
        <Pressable style={[styles.checkBtn, { backgroundColor: accent }]} onPress={handleCheck}>
          <Text style={styles.checkBtnText}>Check</Text>
        </Pressable>
      </View>

      <View style={[styles.boardShell, { borderColor: `${accent}40` }]}>
        <View style={styles.cardAndRailRow} onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
          <View style={styles.cardWrap}>
            <View style={[styles.cardFrame, { height: cardHeight, width: cardWidth }]}>
              {cardImage ? <Image source={{ uri: cardImage }} style={styles.cardImage} resizeMode="stretch" /> : null}
              <View style={styles.optionOverlayCol}>
                <View style={[styles.optionHeaderSpacer, { height: headerHeight }]} />
                <View style={styles.optionRowsWrap}>
                  {optionSlots.map((slot) => {
                    const expectedButton = expectedButtonForSlot(slot.id);
                    return (
                      <View key={slot.id} style={styles.optionRow}>
                        {showClip && expectedButton ? <LogicoButton buttonId={expectedButton} size={slotButtonSize} /> : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>

          <View style={[styles.slotRail, { height: cardHeight }]}>
            <View style={[styles.railHeaderSpacer, { height: headerHeight }]} />
            <View style={styles.railRowsWrap}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((slotId) => (
                <Pressable key={slotId} style={styles.slotCell} onPress={() => onSlotPress(slotId)}>
                  <View style={styles.slotHole}>
                    {placements[slotId] ? <LogicoButton buttonId={placements[slotId]} size={slotButtonSize} /> : null}
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.parkingTray}>
          {buttonIds.map((buttonId) => {
            const occupied = placedSet.has(buttonId);
            const selected = selectedButtonId === buttonId;
            return (
              <Pressable
                key={buttonId}
                disabled={occupied}
                onPress={() => setSelectedButtonId(selected ? null : buttonId)}
                style={[styles.parkingItem, selected && { borderColor: accent, borderWidth: 2 }, occupied && styles.parkingItemDisabled]}
              >
                <LogicoButton buttonId={buttonId} size={trayButtonSize} />
              </Pressable>
            );
          })}
        </View>
      </View>

      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, paddingHorizontal: 0, paddingBottom: 4 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  toolbarBtn: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
  },
  toolbarBtnText: { fontSize: 12, fontWeight: '800' },
  checkBtn: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  checkBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  boardShell: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 4,
    gap: 6,
  },
  cardAndRailRow: { flexDirection: 'row', gap: 8 },
  cardWrap: { flex: 1, alignItems: 'center' },
  cardFrame: {
    aspectRatio: 526 / 725,
    maxWidth: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  cardImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  optionOverlayCol: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: '18%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderLeftWidth: 1,
    borderLeftColor: '#cbd5e1',
  },
  optionHeaderSpacer: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  optionRowsWrap: {
    flex: 1,
  },
  optionRow: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 2,
  },
  slotRail: {
    width: 40,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    overflow: 'hidden',
  },
  railHeaderSpacer: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  railRowsWrap: {
    flex: 1,
  },
  slotCell: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotHole: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#334155',
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  parkingTray: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 0,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 5,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  parkingItem: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderColor: 'transparent',
  },
  parkingItemDisabled: { opacity: 0.55 },
  buttonOuter: {
    borderWidth: 2,
    borderColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonInnerRing: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#9ca3af',
  },
  errorText: { fontSize: 12, fontWeight: '700', color: '#dc2626', textAlign: 'center' },
});
