import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, Animated } from 'react-native';
import { Volume2 } from 'lucide-react-native';
import { AudioManager } from '../../utils/audio';
import { resolveMediaUrl } from './QuizRenderer';
import type { QuestionTheme } from './QuizRenderer';

type ImageOption = {
  id: string;
  image: string;
  is_correct: boolean;
  label?: string;
};

type Props = {
  questionData: {
    prompt_audio?: string;
    prompt_image?: string;
    options: ImageOption[];
  };
  onComplete: (isCorrect: boolean, responseData: any) => void;
  theme?: QuestionTheme;
};

// ELS subject tile color palette
const FRAME_COLORS = [
  { border: '#B5D4FF', bg: '#D6EAFF' }, // blue
  { border: '#FFCCB3', bg: '#FFE8D6' }, // peach
  { border: '#A5D6A7', bg: '#D6F5D6' }, // green
  { border: '#C5B3E6', bg: '#EDE4FF' }, // lavender
];

export default function ImageSelectRenderer({ questionData, onComplete, theme }: Props) {
  const { prompt_audio, prompt_image, options } = questionData;
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const resolvedPromptImage = resolveMediaUrl(prompt_image);
  const speakerPulse = useRef(new Animated.Value(1)).current;
  const shakeAnims = useRef<Record<string, Animated.Value>>({});

  options.forEach((opt) => {
    if (!shakeAnims.current[opt.id]) {
      shakeAnims.current[opt.id] = new Animated.Value(0);
    }
  });

  // Auto-play the animal sound prompt on mount or question load
  useEffect(() => {
    if (prompt_audio) {
      const resolvedPrompt = resolveMediaUrl(prompt_audio);
      if (resolvedPrompt) {
        const timer = setTimeout(() => {
          AudioManager.playSound(resolvedPrompt);
        }, 300);
        return () => clearTimeout(timer);
      }
    }
    // Pulse speaker orb continuously
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(speakerPulse, { toValue: 1.1, duration: 700, useNativeDriver: true }),
        Animated.timing(speakerPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [prompt_audio]);

  const handlePlayPrompt = () => {
    const resolvedPrompt = resolveMediaUrl(prompt_audio);
    if (resolvedPrompt) AudioManager.playSound(resolvedPrompt);
  };

  const shakeWrong = (optId: string) => {
    const anim = shakeAnims.current[optId];
    if (!anim) return;
    Animated.sequence([
      Animated.timing(anim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 7, duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -7, duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleOptionPress = (option: ImageOption) => {
    if (selectedOptionId !== null) return;
    setSelectedOptionId(option.id);
    const soundPath = option.is_correct
      ? '/media/sound-effects/correct.mp3'
      : '/media/sound-effects/incorrect.mp3';
    const resolvedSound = resolveMediaUrl(soundPath);
    if (resolvedSound) AudioManager.playSound(resolvedSound);
    if (!option.is_correct) shakeWrong(option.id);
    setTimeout(() => {
      onComplete(option.is_correct, { selected_id: option.id });
    }, 1000);
  };

  const LETTERS = ['A', 'B', 'C', 'D'];

  return (
    <View style={styles.container}>
      {resolvedPromptImage ? (
        <View style={styles.promptSection}>
          <Text style={styles.promptLabel}>Find the match</Text>
          <View style={[styles.promptImageCard, { borderColor: theme?.accent ?? '#4A90E2' }]}>
            <Image source={{ uri: resolvedPromptImage }} style={styles.promptImage} resizeMode="contain" />
          </View>
        </View>
      ) : null}

      {prompt_audio && (
        <View style={styles.speakerSection}>
          <Animated.View style={{ transform: [{ scale: speakerPulse }] }}>
            <Pressable onPress={handlePlayPrompt} style={styles.speakerOrb}>
              <Volume2 size={40} color="#fff" />
            </Pressable>
          </Animated.View>
          <Text style={[styles.speakerHint, { color: theme?.accent ?? '#4A90E2' }]}>
            Tap to hear the sound!
          </Text>
        </View>
      )}

      {/* separator */}
      <View style={styles.optionsSeparator}>
        <View style={styles.sepLine} />
        <Text style={styles.sepLabel}>Choose the right one</Text>
        <View style={styles.sepLine} />
      </View>

      <View style={styles.optionsGrid}>
        {options.map((option, i) => {
          const isSelected = selectedOptionId === option.id;
          const isCorrect = isSelected && option.is_correct;
          const isWrong = isSelected && !option.is_correct;
          const frame = FRAME_COLORS[i % FRAME_COLORS.length];
          const resolvedImage = resolveMediaUrl(option.image);
          const shakeX = shakeAnims.current[option.id] ?? new Animated.Value(0);
          return (
            <Animated.View
              key={option.id}
              style={[styles.optionCardWrap, { transform: [{ translateX: shakeX }] }]}
            >
              <Pressable
                disabled={selectedOptionId !== null}
                onPress={() => handleOptionPress(option)}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: frame.bg,
                    borderColor: isSelected ? (isCorrect ? '#22c55e' : '#ef4444') : frame.border,
                    borderWidth: isSelected ? 3 : 2,
                  },
                ]}
              >
                {/* Letter badge */}
                <View style={styles.letterBadge}>
                  <Text style={styles.letterBadgeText}>{LETTERS[i]}</Text>
                </View>
                {resolvedImage ? (
                  <Image source={{ uri: resolvedImage }} style={styles.optionImage} resizeMode="contain" />
                ) : null}
                {option.label ? <Text style={styles.optionLabel}>{option.label}</Text> : null}
                {isCorrect && (
                  <View style={styles.badgeCorrect}><Text style={styles.badgeText}>✓</Text></View>
                )}
                {isWrong && (
                  <View style={styles.badgeWrong}><Text style={styles.badgeText}>✗</Text></View>
                )}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12, paddingTop: 8, gap: 10,
  },
  promptSection: { gap: 4 },
  promptLabel: {
    fontSize: 11, fontWeight: '800', color: '#4A90E2',
    textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center',
  },
  promptImageCard: {
    borderWidth: 3, borderRadius: 16,
    overflow: 'hidden', backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 3,
  },
  promptImage: { width: '100%', height: 110 },
  optionsSeparator: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  sepLine: { flex: 1, height: 1, backgroundColor: '#B5D4FF' },
  sepLabel: { fontSize: 11, fontWeight: '700', color: '#4A90E2' },
  speakerSection: { alignItems: 'center', gap: 10 },
  speakerOrb: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#4A90E2', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#4A90E2', shadowOpacity: 0.35, shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18, elevation: 6,
  },
  speakerHint: { fontSize: 14, fontWeight: '700' },
  optionsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center',
  },
  optionCardWrap: { width: '46%' },
  optionCard: {
    borderRadius: 18, padding: 8, aspectRatio: 0.85,
    alignItems: 'center', justifyContent: 'center',
    gap: 4, position: 'relative',
    shadowColor: '#000', shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 2,
  },
  optionImage: { width: '65%', height: '65%', resizeMode: 'contain' },
  optionLabel: { fontSize: 12, fontWeight: '800', color: '#1e293b', textAlign: 'center' },
  letterBadge: {
    position: 'absolute', top: 4, left: 4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#4A90E2', alignItems: 'center', justifyContent: 'center',
  },
  letterBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  badgeCorrect: {
    position: 'absolute', top: -10, right: -10,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#22c55e', shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 6, elevation: 4,
  },
  badgeWrong: {
    position: 'absolute', top: -10, right: -10,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#ef4444', shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 6, elevation: 4,
  },
  badgeText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
