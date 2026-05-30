import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { resolveMediaUrl } from './QuizRenderer';
import { AudioManager } from '../../utils/audio';
import type { QuestionTheme } from './QuizRenderer';

export type FillBlankData = {
  sentence: string;
  answer: string;
  hint?: string;
  options: string[];
};

type Props = {
  questionData: FillBlankData;
  onComplete: (isCorrect: boolean, responseData: any) => void;
  theme?: QuestionTheme;
};

const SFX_CORRECT = resolveMediaUrl('/media/sound-effects/correct.mp3');
const SFX_WRONG   = resolveMediaUrl('/media/sound-effects/incorrect.mp3');

// ── Animated sentence with blank slot ─────────────────────────────────────────
function SentenceCard({
  sentence, answer, hint, selected, submitted, accent,
}: {
  sentence: string; answer: string; hint?: string;
  selected: string | null; submitted: boolean; accent: string;
}) {
  const parts   = sentence.split('___');
  const before  = parts[0] ?? '';
  const after   = parts[1] ?? '';
  const filled  = selected ?? '';
  const isOk    = submitted && filled.toLowerCase() === answer.toLowerCase();
  const isWrong = submitted && filled !== '' && !isOk;

  const blankColor = !submitted
    ? (filled ? accent : '#B0B8D0')
    : isOk ? '#4CAF50' : '#FF5252';

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (submitted && isOk) {
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 120, useNativeDriver: true }),
        Animated.spring(pulseAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();
    }
  }, [submitted, isOk, pulseAnim]);

  return (
    <Animated.View style={[sc.card, { transform: [{ scale: pulseAnim }] }]}>
      {/* Question label */}
      <View style={[sc.label, { backgroundColor: accent + '18' }]}>
        <Text style={[sc.labelTxt, { color: accent }]}>Fill in the blank</Text>
      </View>

      {/* Sentence */}
      <Text style={sc.sentence}>
        <Text style={sc.plain}>{before}</Text>
        <Text style={[sc.blank, { color: blankColor, borderBottomColor: blankColor }]}>
          {filled ? ` ${filled} ` : '          '}
        </Text>
        <Text style={sc.plain}>{after}</Text>
      </Text>

      {/* Result feedback */}
      {submitted && (
        <View style={[sc.result, { backgroundColor: isOk ? '#E8F5E9' : '#FFF3F0', borderColor: isOk ? '#A5D6A7' : '#FFCDD2' }]}>
          <Text style={[sc.resultIcon]}>{isOk ? '🎉' : '💡'}</Text>
          <Text style={[sc.resultTxt, { color: isOk ? '#2E7D32' : '#C62828' }]}>
            {isOk ? 'Correct!' : `Answer: "${answer}"`}
          </Text>
        </View>
      )}

      {/* Hint badge (before submission) */}
      {hint && !submitted && !selected && (
        <View style={[sc.hint, { backgroundColor: accent + '12', borderColor: accent + '30' }]}>
          <Text style={sc.hintIcon}>💡</Text>
          <Text style={[sc.hintTxt, { color: accent }]}>Starts with "<Text style={{ fontWeight: '900' }}>{hint}</Text>"</Text>
        </View>
      )}
    </Animated.View>
  );
}

const sc = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 22, padding: 22, marginBottom: 20,
    shadowColor: '#4A90E2', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 4,
    borderWidth: 1, borderColor: '#EEF4FF',
  },
  label: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 14 },
  labelTxt: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  sentence: { fontSize: 20, lineHeight: 32, color: '#1a1a2e', fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  plain:    { fontWeight: '600', color: '#1a1a2e' },
  blank: {
    fontWeight: '900', borderBottomWidth: 2.5, letterSpacing: 1,
    paddingHorizontal: 4, textDecorationLine: 'none',
  },
  result: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1,
    alignSelf: 'center',
  },
  resultIcon: { fontSize: 16 },
  resultTxt:  { fontSize: 14, fontWeight: '800' },
  hint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'center',
  },
  hintIcon: { fontSize: 13 },
  hintTxt:  { fontSize: 13, fontWeight: '600' },
});

// ── Option chip ───────────────────────────────────────────────────────────────
function OptionChip({
  label, selected, correct, wrongSelected, submitted, onPress, accent,
}: {
  label: string; selected: boolean; correct: boolean;
  wrongSelected: boolean; submitted: boolean; onPress: () => void; accent: string;
}) {
  const shakeX  = useRef(new Animated.Value(0)).current;
  const scaleA  = useRef(new Animated.Value(1)).current;
  const bounceA = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (wrongSelected && submitted) {
      Animated.sequence([
        Animated.timing(shakeX, { toValue: 7,  duration: 55, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -7, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 5,  duration: 45, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -5, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 0,  duration: 40, useNativeDriver: true }),
      ]).start();
    }
    if (correct && submitted) {
      Animated.sequence([
        Animated.timing(scaleA, { toValue: 1.06, duration: 100, useNativeDriver: true }),
        Animated.spring(scaleA, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
      ]).start();
    }
  }, [wrongSelected, correct, submitted]);

  // Idle bounce on mount
  useEffect(() => {
    Animated.timing(bounceA, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, []);

  let bg     = '#F4F6FF';
  let border = '#E0E4F8';
  let txtC   = '#3A3A5A';

  if (selected && !submitted)  { bg = accent + '18'; border = accent;    txtC = accent; }
  if (submitted && correct)    { bg = '#E8F5E9';     border = '#4CAF50'; txtC = '#2E7D32'; }
  if (submitted && wrongSelected) { bg = '#FFF3F0';  border = '#FF5252'; txtC = '#C62828'; }

  return (
    <Animated.View style={{ transform: [{ translateX: shakeX }, { scale: scaleA }], opacity: bounceA }}>
      <Pressable
        onPress={onPress}
        disabled={submitted}
        style={({ pressed }) => [oc.chip, { backgroundColor: bg, borderColor: border },
          pressed && !submitted && oc.pressed]}
      >
        {/* Left indicator dot */}
        <View style={[oc.dot, {
          backgroundColor: (submitted && correct) ? '#4CAF50' : (submitted && wrongSelected) ? '#FF5252' : (selected ? accent : '#D0D4E8'),
        }]} />
        <Text style={[oc.label, { color: txtC }]} numberOfLines={2}>{label}</Text>
        {submitted && correct    && <Text style={oc.badge}>✓</Text>}
        {submitted && wrongSelected && <Text style={[oc.badge, { color: '#FF5252' }]}>✗</Text>}
      </Pressable>
    </Animated.View>
  );
}

const oc = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 16, borderWidth: 2, paddingVertical: 14, paddingHorizontal: 16,
    shadowColor: '#1a1a3e', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  pressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
  dot:     { width: 10, height: 10, borderRadius: 5 },
  label:   { fontSize: 15, fontWeight: '700', flex: 1 },
  badge:   { fontSize: 17, fontWeight: '900', color: '#4CAF50' },
});

// ── Main ──────────────────────────────────────────────────────────────────────
export default function FillBlankRenderer({ questionData, onComplete, theme }: Props) {
  const { sentence, answer, hint, options } = questionData;
  const [selected,  setSelected]  = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const accent = theme?.accent ?? '#4A90E2';

  // Shuffle options once on mount
  const shuffled = useRef([...options].sort(() => Math.random() - 0.5)).current;

  const handlePick = (opt: string) => {
    if (submitted) return;
    setSelected(opt);
    setTimeout(() => {
      setSubmitted(true);
      const correct = opt.toLowerCase() === answer.toLowerCase();
      if (correct) AudioManager.playSound(SFX_CORRECT ?? '').catch(() => {});
      else         AudioManager.playSound(SFX_WRONG   ?? '').catch(() => {});
      setTimeout(() => onComplete(correct, { selected: opt, answer, isCorrect: correct }), 1200);
    }, 360);
  };

  // Use 2-col grid when all options are short (≤10 chars)
  const useGrid = shuffled.every((o) => o.length <= 12) && shuffled.length >= 2;

  return (
    <View style={fb.wrapper}>
      <SentenceCard
        sentence={sentence} answer={answer} hint={hint}
        selected={selected} submitted={submitted} accent={accent}
      />

      {/* Options */}
      {useGrid ? (
        <View style={fb.grid}>
          {shuffled.map((opt) => {
            const isSel  = selected === opt;
            const isOk   = opt.toLowerCase() === answer.toLowerCase();
            return (
              <View key={opt} style={fb.gridCell}>
                <OptionChip
                  label={opt} selected={isSel} correct={submitted && isOk}
                  wrongSelected={submitted && isSel && !isOk}
                  submitted={submitted} onPress={() => handlePick(opt)} accent={accent}
                />
              </View>
            );
          })}
        </View>
      ) : (
        <View style={fb.list}>
          {shuffled.map((opt) => {
            const isSel = selected === opt;
            const isOk  = opt.toLowerCase() === answer.toLowerCase();
            return (
              <OptionChip
                key={opt} label={opt} selected={isSel} correct={submitted && isOk}
                wrongSelected={submitted && isSel && !isOk}
                submitted={submitted} onPress={() => handlePick(opt)} accent={accent}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

const fb = StyleSheet.create({
  wrapper: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 },
  grid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCell:{ width: '48%' },
  list:    { gap: 10 },
});
