import React, { useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AudioManager } from '../../utils/audio';
import { resolveMediaUrl } from './QuizRenderer';
import type { QuestionTheme } from './QuizRenderer';

type JigsawQuestionData = {
  image?: string;
  prompt_image?: string;
  gridSize?: '2x2' | '3x3' | '4x4' | '5x5';
  difficulty?: 'easy' | 'medium' | 'hard';
  clickLimit?: number;
};

type Props = {
  questionData: JigsawQuestionData;
  onComplete: (isCorrect: boolean, responseData: any) => void;
  theme?: QuestionTheme;
  autoStart?: boolean;
  showControls?: boolean;
};

const SFX_CORRECT = resolveMediaUrl('/media/sound-effects/correct.mp3');
const SFX_WRONG   = resolveMediaUrl('/media/sound-effects/incorrect.mp3');
const SFX_WIN     = resolveMediaUrl('/media/sound-effects/you-won.mp3');

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const CELL_GAP = 3;

export default function JigsawRenderer({
  questionData,
  onComplete,
  theme,
  autoStart = true,
  showControls = true,
}: Props) {
  const imageUrl   = resolveMediaUrl(questionData.image || questionData.prompt_image || '');
  const gridSize   = (['2x2','3x3','4x4','5x5'].includes(String(questionData.gridSize)) ? questionData.gridSize : '3x3') as '2x2'|'3x3'|'4x4'|'5x5';
  const difficulty = (['easy','medium','hard'].includes(String(questionData.difficulty)) ? questionData.difficulty : 'medium') as 'easy'|'medium'|'hard';
  const clickLimit = Number(questionData.clickLimit ?? 0);
  const n     = Number(gridSize.split('x')[0]);
  const total = n * n;
  const accent = theme?.accent ?? '#0EA5E9';

  // Measure actual container width via onLayout
  const [containerW, setContainerW] = useState(0);

  // Grid sizing — subtract horizontal padding (12 each side) and gaps between cells
  const HPAD        = 12;
  const innerW      = containerW > 0 ? containerW - HPAD * 2 : 0;
  const pieceSize   = innerW > 0 ? Math.floor((innerW - (n - 1) * CELL_GAP) / n) : 0;
  const gridW       = pieceSize * n + (n - 1) * CELL_GAP;

  // Tray piece size: must fit many per row; smaller than grid piece
  const traySize = Math.max(32, Math.min(56, Math.floor(pieceSize * 0.55)));

  const buildStartState = () => ({
    slots: Array.from({ length: total }, () => null as number | null),
    tray:  shuffle(Array.from({ length: total }, (_, i) => i)),
    locked: new Set<number>(),
  });

  const initial = buildStartState();
  const [gameState,      setGameState]      = useState<'not_started'|'in_progress'|'completed'|'failed'>(autoStart ? 'in_progress' : 'not_started');
  const [slotToPiece,    setSlotToPiece]    = useState<Array<number|null>>(initial.slots);
  const [trayPieces,     setTrayPieces]     = useState<number[]>(initial.tray);
  const [lockedSlots,    setLockedSlots]    = useState<Set<number>>(initial.locked);
  const [selectedPiece,  setSelectedPiece]  = useState<number|null>(null);
  const [moves,          setMoves]          = useState(0);
  const startTimeRef   = useRef<number>(autoStart ? Date.now() : 0);
  const completedRef   = useRef(false);

  const playSound = (url: string | undefined) => { if (url) AudioManager.playSound(url).catch(() => {}); };

  const finishGame = (completed: boolean, m: number) => {
    if (completedRef.current) return;
    completedRef.current = true;
    const timeTaken = startTimeRef.current > 0 ? Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000)) : 0;
    setGameState(completed ? 'completed' : 'failed');
    onComplete(completed, { gridSize, difficulty, moves: m, clickLimit: clickLimit > 0 ? clickLimit : null, completed, timeTaken, slotArrangement: [...slotToPiece] });
  };

  const restart = () => {
    const s = buildStartState();
    setSlotToPiece(s.slots);
    setTrayPieces(s.tray);
    setLockedSlots(new Set());
    setSelectedPiece(null);
    setMoves(0);
    setGameState(autoStart ? 'in_progress' : 'not_started');
    completedRef.current = false;
    startTimeRef.current = autoStart ? Date.now() : 0;
  };

  const startGame = () => {
    if (!imageUrl || gameState !== 'not_started') return;
    startTimeRef.current = Date.now();
    setGameState('in_progress');
  };

  const afterMove = (nextSlots: Array<number|null>, nextTray: number[], m: number) => {
    const nextLocked = new Set<number>(lockedSlots);
    nextSlots.forEach((pid, slot) => { if (pid === slot) nextLocked.add(slot); });
    setLockedSlots(nextLocked);
    setSlotToPiece(nextSlots);
    setTrayPieces(nextTray);
    if (nextLocked.size === total) { finishGame(true, m); return; }
    if (clickLimit > 0 && m >= clickLimit) finishGame(false, m);
  };

  const onTrayPress = (pieceId: number) => {
    if (gameState !== 'in_progress') return;
    setSelectedPiece((cur) => (cur === pieceId ? null : pieceId));
  };

  const onSlotPress = (slot: number) => {
    if (gameState !== 'in_progress') return;
    if (lockedSlots.has(slot)) return;

    if (selectedPiece === null) {
      // pick up piece already in a slot
      const existing = slotToPiece[slot];
      if (existing === null) return;
      const next = [...slotToPiece]; next[slot] = null;
      setSlotToPiece(next);
      setTrayPieces([...trayPieces, existing]);
      return;
    }

    if (!trayPieces.includes(selectedPiece)) { setSelectedPiece(null); return; }

    const m = moves + 1; setMoves(m);
    const nextSlots = [...slotToPiece];
    const nextTray  = trayPieces.filter((p) => p !== selectedPiece);
    const replaced  = nextSlots[slot];
    if (replaced !== null) nextTray.push(replaced);
    nextSlots[slot] = selectedPiece;
    setSelectedPiece(null);
    afterMove(nextSlots, nextTray, m);
  };

  const renderPiece = (pieceId: number, size: number) => {
    const row = Math.floor(pieceId / n);
    const col = pieceId % n;
    return (
      <Image
        source={{ uri: imageUrl }}
        resizeMode="stretch"
        style={{ width: size * n, height: size * n, position: 'absolute', left: -(col * size), top: -(row * size) }}
      />
    );
  };

  // Render grid as explicit rows (no flexWrap) to avoid wrapping bugs
  const gridRows: number[][] = [];
  for (let r = 0; r < n; r++) gridRows.push(Array.from({ length: n }, (_, c) => r * n + c));

  if (!imageUrl) {
    return (
      <View style={s.emptyBox}>
        <Text style={s.emptyText}>No puzzle image configured</Text>
      </View>
    );
  }

  return (
    <View style={s.root} onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}>
      {containerW === 0 ? null : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
        >
          {/* ── Stats ── */}
          <View style={s.statsRow}>
            <View style={[s.badge, { backgroundColor: accent + '22' }]}>
              <Text style={[s.badgeVal, { color: accent }]}>{gridSize}</Text>
              <Text style={s.badgeKey}>Grid</Text>
            </View>
            <View style={s.badge}>
              <Text style={s.badgeVal}>{moves}{clickLimit > 0 ? `/${clickLimit}` : ''}</Text>
              <Text style={s.badgeKey}>Moves</Text>
            </View>
            <View style={s.badge}>
              <Text style={[s.badgeVal, { color: lockedSlots.size === total ? '#16A34A' : '#0F172A' }]}>{lockedSlots.size}/{total}</Text>
              <Text style={s.badgeKey}>Placed</Text>
            </View>
            <View style={[s.badge, {
              backgroundColor: difficulty === 'easy' ? '#DCFCE7' : difficulty === 'medium' ? '#FEF9C3' : '#FEE2E2',
            }]}>
              <Text style={[s.badgeVal, {
                color: difficulty === 'easy' ? '#15803D' : difficulty === 'medium' ? '#A16207' : '#B91C1C',
              }]}>{difficulty}</Text>
            </View>
          </View>

          {/* ── Instruction ── */}
          <View style={s.instructRow}>
            {selectedPiece !== null
              ? <Text style={[s.instr, { color: accent }]}>Piece #{selectedPiece + 1} selected — tap a grid slot</Text>
              : gameState === 'not_started'
              ? <Text style={s.instr}>Press Start to begin the puzzle</Text>
              : gameState === 'in_progress'
              ? <Text style={s.instr}>Tap a piece from the tray, then tap a slot</Text>
              : null
            }
          </View>

          {/* ── Puzzle Grid ── */}
          <View style={[s.section, { paddingHorizontal: HPAD }]}>
            <Text style={s.secLabel}>PUZZLE GRID</Text>
            <View style={{ alignItems: 'center' }}>
              {gridRows.map((row, ri) => (
                <View key={`row-${ri}`} style={[s.gridRow, { gap: CELL_GAP, marginBottom: ri < n - 1 ? CELL_GAP : 0 }]}>
                  {row.map((slot) => {
                    const pid       = slotToPiece[slot];
                    const isLocked  = lockedSlots.has(slot);
                    const isTarget  = selectedPiece !== null && !isLocked;
                    return (
                      <Pressable
                        key={`slot-${slot}`}
                        onPress={() => onSlotPress(slot)}
                        style={[
                          s.slot,
                          { width: pieceSize, height: pieceSize },
                          isLocked && s.slotLocked,
                          isTarget && [s.slotTarget, { borderColor: accent }],
                        ]}
                      >
                        {pid !== null ? (
                          <View style={{ width: pieceSize, height: pieceSize, overflow: 'hidden' }}>
                            {renderPiece(pid, pieceSize)}
                          </View>
                        ) : (
                          <Text style={s.slotNum}>{slot + 1}</Text>
                        )}

                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>

          {/* ── Piece Tray ── */}
          <View style={[s.section, { paddingHorizontal: HPAD }]}>
            <Text style={s.secLabel}>PIECE TRAY</Text>
            {trayPieces.length === 0 && gameState === 'in_progress' ? (
              <View style={s.trayEmpty}>
                <Text style={[s.trayEmptyText, { color: lockedSlots.size === total ? '#16A34A' : accent }]}>
                  {lockedSlots.size === total ? 'All pieces correct! 🎉' : 'All pieces placed — tap Finish to submit!'}
                </Text>
              </View>
            ) : (
              <View style={s.trayGrid}>
                {trayPieces.map((pid) => {
                  const sel = selectedPiece === pid;
                  return (
                    <Pressable
                      key={`piece-${pid}`}
                      onPress={() => onTrayPress(pid)}
                      disabled={gameState !== 'in_progress'}
                      style={[
                        s.trayPiece,
                        { width: traySize, height: traySize },
                        sel && [s.trayPieceSel, { borderColor: accent, shadowColor: accent }],
                        gameState !== 'in_progress' && { opacity: 0.5 },
                      ]}
                    >
                      <View style={{ width: traySize, height: traySize, overflow: 'hidden', borderRadius: 4 }}>
                        {renderPiece(pid, traySize)}
                      </View>
                      <Text style={s.trayNum}>#{pid + 1}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* ── Controls ── */}
          {showControls && (
            <View style={s.ctrlRow}>
              {gameState === 'not_started' ? (
                <Pressable style={[s.startBtn, { backgroundColor: accent }]} onPress={startGame}>
                  <Text style={s.startBtnTxt}>▶  Start Puzzle</Text>
                </Pressable>
              ) : gameState === 'in_progress' ? (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {trayPieces.length === 0 && (
                    <Pressable
                      style={[s.startBtn, { backgroundColor: '#16A34A' }]}
                      onPress={() => finishGame(lockedSlots.size === total, moves)}
                    >
                      <Text style={s.startBtnTxt}>✓  Finish</Text>
                    </Pressable>
                  )}
                  <Pressable style={s.restartBtn} onPress={restart}>
                    <Text style={s.restartBtnTxt}>↺  Restart</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={s.restartBtn} onPress={restart}>
                  <Text style={s.restartBtnTxt}>↺  Restart</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* ── End State ── */}
          {gameState === 'completed' && (
            <View style={[s.endCard, { borderColor: '#4CAF50' + '44', backgroundColor: '#F0FFF4' }]}>
              <Text style={s.endEmoji}>🎉</Text>
              <Text style={[s.endTitle, { color: '#15803D' }]}>Puzzle Complete!</Text>
              <Text style={s.endSub}>Solved in {moves} move{moves !== 1 ? 's' : ''}</Text>
            </View>
          )}
          {gameState === 'failed' && (
            <View style={[s.endCard, { borderColor: '#EF4444' + '44', backgroundColor: '#FFF5F5' }]}>
              <Text style={s.endEmoji}>⏱</Text>
              <Text style={[s.endTitle, { color: '#B91C1C' }]}>Out of moves!</Text>
              {showControls && <Text style={s.endSub}>Tap Restart to try again</Text>}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, width: '100%' },
  scroll: { paddingVertical: 12, gap: 12 },

  emptyBox:  { paddingVertical: 36, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: 6, justifyContent: 'center', flexWrap: 'wrap', paddingHorizontal: 12 },
  badge:    { backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center', minWidth: 56 },
  badgeVal: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  badgeKey: { fontSize: 9, fontWeight: '600', color: '#94A3B8', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 1 },

  instructRow: { minHeight: 20, alignItems: 'center', paddingHorizontal: 12 },
  instr: { fontSize: 11, color: '#64748B', fontWeight: '600', textAlign: 'center' },

  section:  { gap: 8 },
  secLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase' },

  gridRow: { flexDirection: 'row' },
  slot: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#F0F5FF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 6,
  },
  slotLocked: { borderColor: '#CBD5E1', borderWidth: 1.5 },
  slotTarget: { borderWidth: 2, backgroundColor: 'rgba(14,165,233,0.07)' },
  slotNum:    { fontSize: 11, color: '#CBD5E1', fontWeight: '700' },
  checkDot:   { position: 'absolute', bottom: 2, right: 2, width: 13, height: 13, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  checkMark:  { fontSize: 8, color: '#fff', fontWeight: '900' },

  trayGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trayPiece:     { borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1', backgroundColor: '#fff', overflow: 'visible', position: 'relative', alignItems: 'center' },
  trayPieceSel:  { borderWidth: 2.5, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 6, elevation: 5 },
  trayNum:       { position: 'absolute', bottom: 1, right: 2, fontSize: 7, color: '#94A3B8', fontWeight: '700' },
  trayEmpty:     { paddingVertical: 10, alignItems: 'center' },
  trayEmptyText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },

  ctrlRow:       { alignItems: 'center', paddingHorizontal: 12 },
  startBtn:      { borderRadius: 14, paddingHorizontal: 36, paddingVertical: 13, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  startBtnTxt:   { color: '#fff', fontWeight: '800', fontSize: 15 },
  restartBtn:    { borderRadius: 14, paddingHorizontal: 28, paddingVertical: 11, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  restartBtnTxt: { color: '#334155', fontWeight: '800', fontSize: 13 },

  endCard:  { marginHorizontal: 12, borderRadius: 14, borderWidth: 1.5, padding: 16, alignItems: 'center', gap: 4 },
  endEmoji: { fontSize: 26 },
  endTitle: { fontSize: 15, fontWeight: '900' },
  endSub:   { fontSize: 12, color: '#64748B', fontWeight: '600' },
});
