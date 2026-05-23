import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, Animated } from 'react-native';
import { Volume2 } from 'lucide-react-native';
import { AudioManager } from '../../utils/audio';
import { resolveMediaUrl } from './QuizRenderer';
import type { QuestionTheme } from './QuizRenderer';

type ChoiceOption = {
  id: string;
  label?: string;
  image?: string;
  audio?: string;
  is_correct: boolean;
};

type Props = {
  questionType: string;
  questionAudio?: string;
  questionData: {
    prompt_audio?: string;
    options: ChoiceOption[];
  };
  onComplete: (isCorrect: boolean, responseData: any) => void;
  theme?: QuestionTheme;
};

const normalizeType = (questionType: string) => {
  if (questionType === 'image_select') return 'guess_image';
  if (questionType === 'sound_match') return 'guess_audio';
  if (questionType === 'memory_game') return 'multi_choice';
  return questionType;
};

export default function ChoiceQuestionRenderer({ questionType, questionAudio, questionData, onComplete, theme }: Props) {
  const normalizedType = normalizeType(questionType);
  const isMultiChoice = normalizedType === 'multi_choice';
  const isTrueFalse = normalizedType === 'true_false';
  const isGuessAudio = normalizedType === 'guess_audio';
  const promptAudio = questionAudio || questionData.prompt_audio;
  const options = questionData.options || [];

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const speakerPulse = useRef(new Animated.Value(1)).current;

  // Per-option press scale animations
  const pressAnims = useRef(options.map(() => new Animated.Value(1))).current;

  const correctIds = useMemo(
    () => options.filter((o) => o.is_correct).map((o) => o.id),
    [options],
  );

  useEffect(() => {
    if (!promptAudio) return;
    const resolved = resolveMediaUrl(promptAudio);
    if (!resolved) return;
    const timer = setTimeout(() => AudioManager.playSound(resolved), 250);
    return () => clearTimeout(timer);
  }, [promptAudio]);

  useEffect(() => {
    if (!isGuessAudio) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(speakerPulse, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(speakerPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [isGuessAudio]);

  const playPrompt = () => {
    const resolved = resolveMediaUrl(promptAudio);
    if (resolved) AudioManager.playSound(resolved);
  };

  const playFeedback = (correct: boolean) => {
    const path = correct ? '/media/sound-effects/correct.mp3' : '/media/sound-effects/incorrect.mp3';
    const resolved = resolveMediaUrl(path);
    if (resolved) AudioManager.playSound(resolved);
  };

  const animatePress = (idx: number, cb: () => void) => {
    const anim = pressAnims[idx];
    if (!anim) { cb(); return; }
    Animated.sequence([
      Animated.timing(anim, { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.spring(anim, { toValue: 1, useNativeDriver: true }),
    ]).start();
    cb();
  };

  const handleSingleChoice = (optionId: string, idx: number) => {
    if (submitted) return;
    animatePress(idx, () => {
      const isCorrect = correctIds.includes(optionId) && correctIds.length === 1;
      setSelectedIds([optionId]);
      setSubmitted(true);
      playFeedback(isCorrect);
      setTimeout(() => onComplete(isCorrect, { selected_ids: [optionId] }), 900);
    });
  };

  const handleMultiChoiceToggle = (optionId: string, idx: number) => {
    if (submitted) return;
    animatePress(idx, () => {
      setSelectedIds((cur) =>
        cur.includes(optionId) ? cur.filter((id) => id !== optionId) : [...cur, optionId],
      );
    });
  };

  const handleSubmitMultiChoice = () => {
    if (submitted || selectedIds.length === 0) return;
    const selectedSet = new Set(selectedIds);
    const correctSet = new Set(correctIds);
    const isCorrect = selectedSet.size === correctSet.size && [...selectedSet].every((id) => correctSet.has(id));
    setSubmitted(true);
    playFeedback(isCorrect);
    setTimeout(() => onComplete(isCorrect, { selected_ids: selectedIds }), 900);
  };

  const getPillStyle = (option: ChoiceOption, idx: number) => {
    const selected = selectedIds.includes(option.id);
    const showCorrect = submitted && option.is_correct;
    const showWrong = submitted && selected && !option.is_correct;
    if (showCorrect) return styles.pillCorrect;
    if (showWrong) return styles.pillWrong;
    if (selected) return styles.pillSelected;
    return null;
  };

  const getPillTextStyle = (option: ChoiceOption) => {
    const selected = selectedIds.includes(option.id);
    const showCorrect = submitted && option.is_correct;
    const showWrong = submitted && selected && !option.is_correct;
    if (showCorrect) return styles.pillTextCorrect;
    if (showWrong) return styles.pillTextWrong;
    if (selected) return styles.pillTextSelected;
    return null;
  };

  // ── TRUE / FALSE ─────────────────────────────────────────────────────────
  if (isTrueFalse) {
    const trueOpt = options.find((o) => o.label?.toLowerCase() === 'true' || o.label?.toLowerCase() === 'yes') ?? options[0];
    const falseOpt = options.find((o) => o.label?.toLowerCase() === 'false' || o.label?.toLowerCase() === 'no') ?? options[1];
    return (
      <View style={styles.tfContainer}>
        {[trueOpt, falseOpt].filter(Boolean).map((option, idx) => {
          const isTrue = idx === 0;
          const selected = selectedIds.includes(option.id);
          const showCorrect = submitted && option.is_correct;
          const showWrong = submitted && selected && !option.is_correct;
          const anim = pressAnims[options.indexOf(option)] ?? new Animated.Value(1);
          return (
            <Animated.View key={option.id} style={[styles.optionWrap, { transform: [{ scale: anim }] }]} >
              <Pressable
                disabled={submitted}
                onPress={() => handleSingleChoice(option.id, options.indexOf(option))}
                style={[
                  styles.tfPill, styles.tfPillFill,
                  isTrue ? styles.tfPillTrue : styles.tfPillFalse,
                  selected && !submitted && styles.tfPillSelected,
                  showCorrect && styles.tfPillCorrect,
                  showWrong && styles.tfPillWrong,
                ]}
              >
                <Text style={styles.tfLabel}>{option.label?.toUpperCase() ?? (isTrue ? 'TRUE' : 'FALSE')}</Text>
                {submitted && selected && (
                  <View style={[styles.tfFeedback, option.is_correct ? styles.tfFeedbackOk : styles.tfFeedbackBad]}>
                    <Text style={styles.tfFeedbackText}>{option.is_correct ? '✓' : '✗'}</Text>
                  </View>
                )}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    );
  }

  // ── GUESS AUDIO ──────────────────────────────────────────────────────────
  if (isGuessAudio) {
    return (
      <ScrollView contentContainerStyle={styles.audioContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.audioCenterBlock}>
          <Animated.View style={{ transform: [{ scale: speakerPulse }] }}>
            <Pressable onPress={playPrompt} style={styles.speakerOrb}>
              <View style={styles.speakerRing} />
              <Volume2 size={46} color="#fff" />
            </Pressable>
          </Animated.View>
          <Text style={styles.speakerHint}>Tap to hear again</Text>
        </View>
        <View style={styles.pillsWrap}>
          {options.map((option, i) => {
            const anim = pressAnims[i] ?? new Animated.Value(1);
            return (
              <Animated.View key={option.id} style={[styles.optionWrap, { transform: [{ scale: anim }] }]}>
                <Pressable
                  disabled={submitted}
                  onPress={() => handleSingleChoice(option.id, i)}
                  style={[styles.pill, getPillStyle(option, i)]}
                >
                  <Text style={[styles.pillText, getPillTextStyle(option)]}>{option.label}</Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  // ── SINGLE / MULTI CHOICE ────────────────────────────────────────────────
  return (
    <ScrollView contentContainerStyle={styles.choiceContainer} showsVerticalScrollIndicator={false}>
      {promptAudio ? (
        <Pressable onPress={playPrompt} style={styles.inlineAudioBtn}>
          <Volume2 size={16} color="#fff" />
          <Text style={styles.inlineAudioText}>Play audio</Text>
        </Pressable>
      ) : null}

      <View style={styles.pillsWrap}>
        {options.map((option, i) => {
          const anim = pressAnims[i] ?? new Animated.Value(1);
          const optImage = resolveMediaUrl(option.image);
          const optAudio = resolveMediaUrl(option.audio);
          return (
            <Animated.View key={option.id} style={[styles.optionWrap, { transform: [{ scale: anim }] }]}>
              <Pressable
                disabled={submitted}
                onPress={() => isMultiChoice ? handleMultiChoiceToggle(option.id, i) : handleSingleChoice(option.id, i)}
                style={[styles.pill, getPillStyle(option, i), optImage && styles.pillWithImage]}
              >
                {isMultiChoice && (
                  <View style={[
                    styles.checkDot,
                    selectedIds.includes(option.id) && styles.checkDotActive,
                  ]}>
                    {selectedIds.includes(option.id) && <Text style={styles.checkDotText}>✓</Text>}
                  </View>
                )}
                {optImage ? (
                  <Image source={{ uri: optImage }} style={styles.pillImage} resizeMode="contain" />
                ) : null}
                {option.label ? (
                  <Text style={[styles.pillText, getPillTextStyle(option)]}>{option.label}</Text>
                ) : null}
                {optAudio ? (
                  <Pressable
                    style={styles.pillAudioBtn}
                    onPress={() => AudioManager.playSound(optAudio)}
                  >
                    <Volume2 size={13} color="#4A90E2" />
                  </Pressable>
                ) : null}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      {isMultiChoice && (
        <Pressable
          style={[styles.submitBtn, (submitted || selectedIds.length === 0) && styles.submitBtnDisabled]}
          onPress={handleSubmitMultiChoice}
          disabled={submitted || selectedIds.length === 0}
        >
          <Text style={styles.submitBtnText}>Submit Answer  ✓</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // ── TRUE / FALSE ──────────────────────────────────────────────────────────
  tfContainer: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 2, paddingTop: 6, paddingBottom: 12,
  },
  tfPill: {
    borderRadius: 18, borderWidth: 2, paddingVertical: 14, paddingHorizontal: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderColor: '#EBEBF5', position: 'relative',
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8, elevation: 2,
  },
  tfPillTrue: { borderColor: '#A5D6A7' },
  tfPillFalse: { borderColor: '#EF9A9A' },
  tfPillSelected: { backgroundColor: '#D6EAFF', borderColor: '#4A90E2' },
  tfPillCorrect: { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' },
  tfPillWrong: { backgroundColor: '#FFEBEE', borderColor: '#F44336' },
  tfPillFill: { width: '100%' },
  tfLabel: { fontSize: 16, fontWeight: '900', color: '#1a1a2e', textTransform: 'uppercase' },
  tfFeedback: {
    position: 'absolute', top: 10, right: 10,
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  tfFeedbackOk: { backgroundColor: '#4CAF50' },
  tfFeedbackBad: { backgroundColor: '#F44336' },
  tfFeedbackText: { color: '#fff', fontSize: 13, fontWeight: '900' },

  // ── AUDIO ─────────────────────────────────────────────────────────────────
  audioContainer: {
    alignItems: 'stretch', paddingTop: 10, paddingBottom: 20, gap: 12, paddingHorizontal: 4,
  },
  audioCenterBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 2,
  },
  speakerOrb: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#4A90E2', alignItems: 'center', justifyContent: 'center',
    overflow: 'visible',
    shadowColor: '#4A90E2', shadowOpacity: 0.35, shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16, elevation: 6,
  },
  speakerRing: {
    position: 'absolute', width: 130, height: 130, borderRadius: 65,
    borderWidth: 2, borderColor: '#B5D4FF', opacity: 0.6,
  },
  speakerHint: { fontSize: 12, fontWeight: '700', color: '#4A90E2' },

  // ── PILLS (shared) ────────────────────────────────────────────────────────
  pillsWrap: {
    gap: 10,
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  optionWrap: {
    width: '48%',
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 16, borderWidth: 2, borderColor: '#EBEBF5',
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5, elevation: 1,
    width: '100%',
  },
  pillWithImage: { paddingVertical: 10, paddingHorizontal: 14 },
  pillSelected: { backgroundColor: '#D6EAFF', borderColor: '#4A90E2' },
  pillCorrect: { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' },
  pillWrong: { backgroundColor: '#FFEBEE', borderColor: '#F44336' },
  pillText: { fontSize: 14, fontWeight: '700', color: '#1a1a2e', flexShrink: 1, lineHeight: 20 },
  pillTextSelected: { color: '#2C6BC9' },
  pillTextCorrect: { color: '#2E7D32' },
  pillTextWrong: { color: '#C62828' },
  pillImage: { width: 28, height: 28 },
  pillAudioBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#EBF4FF', alignItems: 'center', justifyContent: 'center',
  },

  // ── MULTI-CHOICE CHECK DOT ────────────────────────────────────────────────
  checkDot: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#C8C8D8',
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  checkDotActive: { backgroundColor: '#4A90E2', borderColor: '#4A90E2' },
  checkDotText: { color: '#fff', fontSize: 10, fontWeight: '900' },

  // ── CHOICE CONTAINER ──────────────────────────────────────────────────────
  choiceContainer: {
    paddingHorizontal: 4, paddingTop: 4, paddingBottom: 20, gap: 12, alignItems: 'stretch',
  },
  inlineAudioBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#4A90E2', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999,
    shadowColor: '#4A90E2', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8, elevation: 3,
  },
  inlineAudioText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // ── SUBMIT BUTTON ─────────────────────────────────────────────────────────
  submitBtn: {
    backgroundColor: '#FF7043', height: 50, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', width: '100%',
    shadowColor: '#FF7043', shadowOpacity: 0.35, shadowOffset: { width: 0, height: 5 },
    shadowRadius: 12, elevation: 4,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
