import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Dimensions, Image, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { resolveMediaUrl } from './QuizRenderer';
import { AudioManager } from '../../utils/audio';
import type { QuestionTheme } from './QuizRenderer';

// ── Types ─────────────────────────────────────────────────────────────────────
export type MemoryPair = {
  id: number;
  label: string;
  emoji?: string;
  imageUrl?: string;
};

export type MemoryMatchData = {
  grid: '2x2' | '4x4' | '6x6';
  pairs: MemoryPair[];
  clickLimit?: number; // 10 | 20 | 30 | 40
};

type GameCard = {
  uniqueId: number;
  pairId: number;
  label: string;
  emoji?: string;
  imageUrl?: string;
};

type Props = {
  questionData: MemoryMatchData;
  onComplete: (isCorrect: boolean, responseData: any) => void;
  theme?: QuestionTheme;
  apiBase?: string;
};

// ── Grid config ───────────────────────────────────────────────────────────────
const GRID_CONFIG: Record<string, { cols: number; totalCards: number; pairsNeeded: number }> = {
  '2x2': { cols: 2, totalCards: 4,  pairsNeeded: 2 },
  '4x4': { cols: 4, totalCards: 8,  pairsNeeded: 4 },
  '6x6': { cols: 4, totalCards: 12, pairsNeeded: 6 },
};

const SFX_CORRECT = resolveMediaUrl('/media/sound-effects/correct.mp3');
const SFX_WRONG   = resolveMediaUrl('/media/sound-effects/wrong.mp3');
const SFX_WIN     = resolveMediaUrl('/media/sound-effects/you-won.mp3');

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Single Card ───────────────────────────────────────────────────────────────
function FlipCard({
  card, isFlipped, isMatched, size, onPress, disabled, apiBase,
}: {
  card: GameCard;
  isFlipped: boolean;
  isMatched: boolean;
  size: number;
  onPress: () => void;
  disabled: boolean;
  apiBase: string;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevFlipped = useRef(isFlipped);

  useEffect(() => {
    if (prevFlipped.current === isFlipped) return;
    prevFlipped.current = isFlipped;
    // Bounce on reveal
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
    ]).start();
  }, [isFlipped, scaleAnim]);

  useEffect(() => {
    if (!isMatched) return;
    // Pulse on match
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.15, duration: 120, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true }),
    ]).start();
  }, [isMatched, scaleAnim]);

  const fontSize = size > 64 ? 32 : size > 44 ? 22 : 16;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || isFlipped || isMatched}
      style={({ pressed }) => [
        fc.card,
        { width: size, height: size },
        isFlipped && !isMatched && fc.cardFlipped,
        isMatched && fc.cardMatched,
        pressed && !isFlipped && !isMatched && fc.cardPressed,
      ]}
    >
      <Animated.View style={[fc.inner, { transform: [{ scale: scaleAnim }] }]}>
        {!isFlipped && !isMatched ? (
          <Text style={[fc.backText, { fontSize: fontSize + 2 }]}>?</Text>
        ) : (
          <View style={fc.frontContent}>
            {card.imageUrl ? (
              <Image
                source={{ uri: card.imageUrl.startsWith('/media') ? `${apiBase}${card.imageUrl}` : card.imageUrl }}
                style={{ width: size * 0.58, height: size * 0.58 }}
                resizeMode="contain"
              />
            ) : card.emoji ? (
              <Text style={{ fontSize }}>{card.emoji}</Text>
            ) : (
              <Text style={[fc.label, { fontSize: Math.max(9, size / 6) }]} numberOfLines={2}>
                {card.label}
              </Text>
            )}
            {isMatched && <View style={fc.matchTickBadge}><Text style={fc.matchTick}>✓</Text></View>}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const fc = StyleSheet.create({
  card: {
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#4A90E2',
    shadowColor: '#1a2e6a', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  cardFlipped: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#4A90E2' },
  cardMatched: { backgroundColor: '#D6F5D6', borderWidth: 2, borderColor: '#4CAF50' },
  cardPressed: { opacity: 0.75, transform: [{ scale: 0.94 }] },
  inner:       { alignItems: 'center', justifyContent: 'center', flex: 1, width: '100%' },
  backText:    { fontWeight: '900', color: '#fff' },
  frontContent:{ alignItems: 'center', justifyContent: 'center', gap: 2 },
  label:       { fontWeight: '800', color: '#1a1a2e', textAlign: 'center', paddingHorizontal: 4 },
  matchTickBadge: { position: 'absolute', bottom: 3, right: 3, backgroundColor: '#4CAF50', borderRadius: 99, width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  matchTick:   { fontSize: 8, color: '#fff', fontWeight: '900' },
});

// ── Main Renderer ─────────────────────────────────────────────────────────────
export default function MemoryMatchRenderer({ questionData, onComplete, theme, apiBase = '' }: Props) {
  const grid       = (questionData.grid ?? '4x4') as keyof typeof GRID_CONFIG;
  const cfg        = GRID_CONFIG[grid] ?? GRID_CONFIG['4x4'];
  const clickLimit = questionData.clickLimit ?? 0; // 0 = unlimited

  const usedPairs: MemoryPair[] = useMemo(() => {
    const raw = questionData.pairs ?? [];
    // Pad with placeholder pairs if not enough provided
    const padded = [...raw];
    while (padded.length < cfg.pairsNeeded) {
      padded.push({ id: padded.length + 1, label: `Card ${padded.length + 1}`, emoji: '🃏' });
    }
    return padded.slice(0, cfg.pairsNeeded);
  }, [questionData.pairs, cfg.pairsNeeded]);

  const [cards] = useState<GameCard[]>(() =>
    shuffle(
      usedPairs.flatMap((p) => [
        { uniqueId: p.id * 2 - 1, pairId: p.id, label: p.label, emoji: p.emoji, imageUrl: p.imageUrl },
        { uniqueId: p.id * 2,     pairId: p.id, label: p.label, emoji: p.emoji, imageUrl: p.imageUrl },
      ]),
    ),
  );

  const [flipped,      setFlipped]     = useState<Set<number>>(new Set());
  const [matched,      setMatched]     = useState<Set<number>>(new Set());
  const [disabled,     setDisabled]    = useState(false);
  const [moves,        setMoves]       = useState(0);
  const [clickCount,   setClickCount]  = useState(0);
  const [completed,    setCompleted]   = useState(false);
  const [limitHit,     setLimitHit]    = useState(false);

  const pendingRef       = useRef<number[]>([]);
  const wrongAttemptsRef = useRef<number>(0);

  const buildResult = useCallback((
    finalMatched: Set<number>,
    finalClicks: number,
    allDone: boolean,
  ) => {
    const correctMatches = Array.from(finalMatched).map((pairId) => {
      const p = usedPairs.find((x) => x.id === pairId);
      return { pairId, label: p?.label ?? '', imageUrl: p?.imageUrl };
    });
    const totalPairs = usedPairs.length;
    return {
      clickLimit:     clickLimit || null,
      clicksUsed:     finalClicks,
      completed:      allDone,
      pairsMatched:   finalMatched.size,
      totalPairs,
      accuracy:       Math.round((finalMatched.size / totalPairs) * 100),
      correctMatches,
      wrongAttempts:  wrongAttemptsRef.current,
    };
  }, [clickLimit, usedPairs]);

  const handlePress = useCallback((uniqueId: number, pairId: number) => {
    if (disabled || matched.has(pairId) || flipped.has(uniqueId) || limitHit || completed) return;
    if (pendingRef.current.length >= 2) return;

    const nextClicks = clickCount + 1;
    setClickCount(nextClicks);

    const newFlipped = new Set(flipped);
    newFlipped.add(uniqueId);
    setFlipped(newFlipped);
    pendingRef.current = [...pendingRef.current, uniqueId];
    setMoves((m) => m + 1);

    if (pendingRef.current.length === 2) {
      const [uid1, uid2] = pendingRef.current;
      const c1 = cards.find((c) => c.uniqueId === uid1)!;
      const c2 = cards.find((c) => c.uniqueId === uid2)!;
      setDisabled(true);

      if (c1.pairId === c2.pairId) {
        if (SFX_CORRECT) AudioManager.playSound(SFX_CORRECT).catch(() => {});
        const newMatched = new Set(matched);
        newMatched.add(c1.pairId);
        setMatched(newMatched);
        pendingRef.current = [];
        setDisabled(false);

        const allDone = newMatched.size === usedPairs.length;
        // Also check if next click would breach limit
        const limitBreached = clickLimit > 0 && nextClicks >= clickLimit && !allDone;
        if (allDone || limitBreached) {
          setCompleted(true);
          if (limitBreached) setLimitHit(true);
          if (allDone && SFX_WIN) AudioManager.playSound(SFX_WIN).catch(() => {});
          const result = buildResult(newMatched, nextClicks, allDone);
          setTimeout(() => onComplete(allDone, result), 900);
        }
      } else {
        wrongAttemptsRef.current += 1;
        if (SFX_WRONG) AudioManager.playSound(SFX_WRONG).catch(() => {});
        const limitBreached = clickLimit > 0 && nextClicks >= clickLimit;
        setTimeout(() => {
          const revert = new Set(flipped);
          revert.delete(uid1);
          revert.delete(uid2);
          setFlipped(revert);
          pendingRef.current = [];
          if (limitBreached) {
            setLimitHit(true);
            setCompleted(true);
            setDisabled(true);
            const result = buildResult(matched, nextClicks, false);
            setTimeout(() => onComplete(false, result), 1200);
          } else {
            setDisabled(false);
          }
        }, 750);
      }
    }
  }, [disabled, matched, flipped, cards, moves, clickCount, clickLimit, limitHit, completed, usedPairs, onComplete, buildResult]);

  const { width: SW } = Dimensions.get('window');
  const GAP      = 8;
  const PADDING  = 20;
  const cardSize = Math.floor((SW - PADDING * 2 - GAP * (cfg.cols - 1)) / cfg.cols);
  const gridW    = cardSize * cfg.cols + GAP * (cfg.cols - 1);

  // Split flat cards array into rows
  const rows: GameCard[][] = [];
  for (let i = 0; i < cards.length; i += cfg.cols) {
    rows.push(cards.slice(i, i + cfg.cols));
  }

  const accentColor   = theme?.accent ?? '#4A90E2';
  // Accuracy = pairs matched / total pairs (e.g. 2/4 = 50%)
  const accuracy      = Math.round((matched.size / usedPairs.length) * 100);
  const accuracyColor = accuracy >= 80 ? '#4CAF50' : accuracy >= 50 ? '#E6A020' : accuracy > 0 ? '#FF7043' : accentColor;

  const clicksLeft    = Math.max(0, clickLimit - clickCount);
  const clickPct      = clickLimit > 0 ? clickCount / clickLimit : 0;
  const clickColor    = clickPct >= 1 ? '#D32F2F' : clickPct >= 0.75 ? '#FF7043' : clickPct >= 0.5 ? '#E6A020' : '#4CAF50';

  // Fixed chip width so both sides are identical
  const CHIP_W = Math.floor(gridW * 0.22);

  return (
    <View style={mm.wrapper}>
      {/* Everything is centred and locked to gridW */}
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: gridW }}>

          {/* ── Stats row ── */}
          <View style={mm.statsRow}>
            <View style={[mm.statChip, { width: CHIP_W, backgroundColor: accentColor + '20' }]}>
              <Text style={[mm.statLabel, { color: accentColor }]}>Pairs</Text>
              <Text style={[mm.statVal, { color: accentColor }]}>{matched.size}/{usedPairs.length}</Text>
            </View>

            <View style={mm.progressWrap}>
              <View style={mm.progressTrack}>
                <View style={[mm.progressFill, { width: `${accuracy}%` as any, backgroundColor: accuracyColor }]} />
              </View>
              <Text style={[mm.progressText, { color: accuracyColor }]}>{accuracy}% accuracy</Text>
            </View>

            {clickLimit > 0 ? (
              <View style={[mm.statChip, { width: CHIP_W, backgroundColor: clickColor + '20' }]}>
                <Text style={[mm.statLabel, { color: clickColor }]}>Used</Text>
                <Text style={[mm.statVal, { color: clickColor }]}>{clickCount}/{clickLimit}</Text>
              </View>
            ) : (
              <View style={[mm.statChip, { width: CHIP_W, backgroundColor: '#D6F5D6' }]}>
                <Text style={[mm.statLabel, { color: '#4CAF50' }]}>Score</Text>
                <Text style={[mm.statVal, { color: '#4CAF50' }]}>{matched.size * 10}</Text>
              </View>
            )}
          </View>

          {/* ── Click limit meter ── */}
          {clickLimit > 0 && (
            <View style={mm.clickMeter}>
              <View style={mm.clickMeterLabelRow}>
                <Text style={mm.clickMeterTitle}>Click Limit</Text>
                <View style={[mm.clicksLeftPill, { backgroundColor: clickColor + '18', borderColor: clickColor + '50' }]}>
                  <Text style={[mm.clicksLeftNum, { color: clickColor }]}>{clicksLeft}</Text>
                  <Text style={[mm.clicksLeftSub, { color: clickColor }]}>
                    {clicksLeft === 0 ? 'limit reached' : clicksLeft === 1 ? 'click left' : 'clicks left'}
                  </Text>
                </View>
              </View>
              <View style={mm.clickSegTrack}>
                <View style={[mm.clickSegFill, {
                  width: `${Math.min(100, clickPct * 100)}%` as any,
                  backgroundColor: clickColor,
                }]} />
              </View>
            </View>
          )}

          {/* ── Banners ── */}
          {limitHit && (
            <View style={[mm.banner, { backgroundColor: '#FFF3E0', borderColor: '#FF7043' }]}>
              <Text style={[mm.bannerText, { color: '#E65100' }]}>
                Limit reached — {matched.size}/{usedPairs.length} pairs found
              </Text>
            </View>
          )}
          {completed && !limitHit && (
            <View style={[mm.banner, { backgroundColor: '#D6F5D6', borderColor: '#4CAF50' }]}>
              <Text style={[mm.bannerText, { color: '#2E7D32' }]}>All pairs found!</Text>
            </View>
          )}

          {/* ── Grid ── */}
          <View style={{ gap: GAP }}>
            {rows.map((row, rIdx) => (
              <View key={rIdx} style={{ flexDirection: 'row', gap: GAP }}>
                {row.map((card) => (
                  <FlipCard
                    key={card.uniqueId}
                    card={card}
                    isFlipped={flipped.has(card.uniqueId)}
                    isMatched={matched.has(card.pairId)}
                    size={cardSize}
                    onPress={() => handlePress(card.uniqueId, card.pairId)}
                    disabled={disabled || completed}
                    apiBase={apiBase}
                  />
                ))}
              </View>
            ))}
          </View>

        </View>
      </View>

      <Text style={mm.hintText}>Tap cards to find matching pairs</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const mm = StyleSheet.create({
  wrapper:      { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  statsRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  statChip:     { borderRadius: 12, paddingVertical: 8, alignItems: 'center', gap: 1 },
  statLabel:    { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  statVal:      { fontSize: 18, fontWeight: '900', lineHeight: 22 },
  progressWrap: { flex: 1, gap: 4 },
  progressTrack:{ height: 10, backgroundColor: '#E8ECFF', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  progressText: { fontSize: 10, fontWeight: '700', color: '#9A9AB0', textAlign: 'center' },

  // click meter
  clickMeter:        { backgroundColor: '#F8F9FF', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#ECEEFF' },
  clickMeterLabelRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  clickMeterTitle:   { fontSize: 11, fontWeight: '800', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.5 },
  clicksLeftPill:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, borderWidth: 1 },
  clicksLeftNum:     { fontSize: 16, fontWeight: '900', lineHeight: 20 },
  clicksLeftSub:     { fontSize: 10, fontWeight: '700' },
  clickSegTrack:     { height: 8, backgroundColor: '#ECEEFF', borderRadius: 999, overflow: 'hidden' },
  clickSegFill:      { height: '100%', borderRadius: 999 },
  // banners
  banner:     { borderRadius: 14, padding: 12, marginBottom: 10, alignItems: 'center', borderWidth: 1 },
  bannerText: { fontSize: 14, fontWeight: '900' },
  hintText:   { textAlign: 'center', fontSize: 11, color: '#B0B8CC', fontWeight: '600', marginTop: 12 },
});
