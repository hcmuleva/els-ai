import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Volume2 } from 'lucide-react-native';
import { AudioManager } from '../../utils/audio';
import { resolveMediaUrl } from './QuizRenderer';

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
};

const normalizeType = (questionType: string) => {
  if (questionType === 'image_select') return 'guess_image';
  if (questionType === 'sound_match') return 'guess_audio';
  if (questionType === 'memory_game') return 'multi_choice';
  return questionType;
};

export default function ChoiceQuestionRenderer({ questionType, questionAudio, questionData, onComplete }: Props) {
  const normalizedType = normalizeType(questionType);
  const isMultiChoice = normalizedType === 'multi_choice';
  const promptAudio = questionAudio || questionData.prompt_audio;
  const options = questionData.options || [];

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const correctIds = useMemo(
    () => options.filter((option) => option.is_correct).map((option) => option.id),
    [options],
  );

  useEffect(() => {
    if (!promptAudio) return;
    const resolved = resolveMediaUrl(promptAudio);
    if (!resolved) return;
    const timer = setTimeout(() => {
      AudioManager.playSound(resolved);
    }, 250);
    return () => clearTimeout(timer);
  }, [promptAudio]);

  const playPrompt = () => {
    const resolved = resolveMediaUrl(promptAudio);
    if (resolved) {
      AudioManager.playSound(resolved);
    }
  };

  const playFeedback = (correct: boolean) => {
    const soundPath = correct ? '/media/sound-effects/correct.mp3' : '/media/sound-effects/incorrect.mp3';
    const resolved = resolveMediaUrl(soundPath);
    if (resolved) {
      AudioManager.playSound(resolved);
    }
  };

  const handleSingleChoice = (optionId: string) => {
    if (submitted) return;
    const isCorrect = correctIds.includes(optionId) && correctIds.length === 1;
    setSelectedIds([optionId]);
    setSubmitted(true);
    playFeedback(isCorrect);
    setTimeout(() => {
      onComplete(isCorrect, { selected_ids: [optionId] });
    }, 900);
  };

  const handleMultiChoiceToggle = (optionId: string) => {
    if (submitted) return;
    setSelectedIds((current) =>
      current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId],
    );
  };

  const handleSubmitMultiChoice = () => {
    if (submitted || selectedIds.length === 0) return;

    const selectedSet = new Set(selectedIds);
    const correctSet = new Set(correctIds);
    const isCorrect =
      selectedSet.size === correctSet.size && [...selectedSet].every((id) => correctSet.has(id));

    setSubmitted(true);
    playFeedback(isCorrect);
    setTimeout(() => {
      onComplete(isCorrect, { selected_ids: selectedIds });
    }, 900);
  };

  const handleOptionPress = (optionId: string) => {
    if (isMultiChoice) {
      handleMultiChoiceToggle(optionId);
      return;
    }
    handleSingleChoice(optionId);
  };

  return (
    <View style={styles.container}>
      {promptAudio ? (
        <View style={styles.promptRow}>
          <Pressable onPress={playPrompt} style={styles.speakerButton}>
            <Volume2 size={24} color="#fff" />
          </Pressable>
          <Text style={styles.promptText}>Play audio</Text>
        </View>
      ) : null}

      <View style={styles.optionsGrid}>
        {options.map((option) => {
          const selected = selectedIds.includes(option.id);
          const showCorrect = submitted && option.is_correct;
          const showWrong = submitted && selected && !option.is_correct;
          const optionAudio = resolveMediaUrl(option.audio);
          const optionImage = resolveMediaUrl(option.image);

          return (
            <Pressable
              key={option.id}
              disabled={submitted}
              onPress={() => handleOptionPress(option.id)}
              style={[
                styles.optionCard,
                selected && styles.optionSelected,
                showCorrect && styles.optionCorrect,
                showWrong && styles.optionWrong,
              ]}
            >
              {optionImage ? <Image source={{ uri: optionImage }} style={styles.optionImage} resizeMode="contain" /> : null}
              {option.label ? <Text style={styles.optionLabel}>{option.label}</Text> : null}
              {optionAudio ? (
                <Pressable
                  style={styles.optionAudioButton}
                  onPress={(event) => {
                    event.stopPropagation();
                    if (optionAudio) {
                      AudioManager.playSound(optionAudio);
                    }
                  }}
                >
                  <Volume2 size={14} color="#1d4ed8" />
                </Pressable>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {isMultiChoice ? (
        <Pressable
          style={[styles.submitButton, (submitted || selectedIds.length === 0) && styles.submitButtonDisabled]}
          onPress={handleSubmitMultiChoice}
          disabled={submitted || selectedIds.length === 0}
        >
          <Text style={styles.submitButtonText}>Submit Answer</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 14,
    justifyContent: 'center',
  },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  speakerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
  },
  promptText: {
    color: '#334155',
    fontWeight: '700',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  optionCard: {
    width: '46%',
    minHeight: 110,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    backgroundColor: '#fff',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  optionSelected: {
    borderColor: '#60a5fa',
    backgroundColor: '#eff6ff',
  },
  optionCorrect: {
    borderColor: '#10b981',
    backgroundColor: '#ecfdf5',
  },
  optionWrong: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  optionImage: {
    width: 64,
    height: 64,
  },
  optionLabel: {
    fontSize: 13,
    color: '#0f172a',
    textAlign: 'center',
    fontWeight: '700',
  },
  optionAudioButton: {
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  submitButton: {
    borderRadius: 12,
    backgroundColor: '#1d4ed8',
    alignItems: 'center',
    paddingVertical: 10,
  },
  submitButtonDisabled: {
    opacity: 0.55,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
