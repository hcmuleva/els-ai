import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Volume2 } from 'lucide-react-native';
import { AudioManager } from '../../utils/audio';
import { resolveMediaUrl } from './QuizRenderer';

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
};

export default function ImageSelectRenderer({ questionData, onComplete }: Props) {
  const { prompt_audio, prompt_image, options } = questionData;
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const resolvedPromptImage = resolveMediaUrl(prompt_image);

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
  }, [prompt_audio]);

  const handlePlayPrompt = () => {
    const resolvedPrompt = resolveMediaUrl(prompt_audio);
    if (resolvedPrompt) {
      AudioManager.playSound(resolvedPrompt);
    }
  };

  const handleOptionPress = (option: ImageOption) => {
    setSelectedOptionId(option.id);

    const soundPath = option.is_correct
      ? '/media/sound-effects/correct.mp3'
      : '/media/sound-effects/incorrect.mp3';
    const resolvedSound = resolveMediaUrl(soundPath);
    if (resolvedSound) {
      AudioManager.playSound(resolvedSound);
    }

    // Call onComplete after brief delay
    setTimeout(() => {
      onComplete(option.is_correct, { selected_id: option.id });
    }, 1000);
  };

  return (
    <View style={styles.container}>
      {resolvedPromptImage ? (
        <View style={styles.promptImageCard}>
          <Image source={{ uri: resolvedPromptImage }} style={styles.promptImage} />
        </View>
      ) : null}

      {prompt_audio && (
        <View style={styles.promptContainer}>
          <Pressable onPress={handlePlayPrompt} style={styles.speakerButton}>
            <Volume2 size={36} color="#ffffff" />
          </Pressable>
          <Text style={styles.promptText}>Tap the speaker to hear the sound!</Text>
        </View>
      )}

      <View style={styles.optionsGrid}>
        {options.map((option) => {
          const isSelected = selectedOptionId === option.id;
          const showAnswerStyle = isSelected
            ? option.is_correct
              ? styles.optionCorrect
              : styles.optionIncorrect
            : null;

          const resolvedImage = resolveMediaUrl(option.image);

          return (
            <Pressable
              key={option.id}
              disabled={selectedOptionId !== null}
              onPress={() => handleOptionPress(option)}
              style={[styles.optionCard, showAnswerStyle]}
            >
              {resolvedImage ? (
                <Image source={{ uri: resolvedImage }} style={styles.optionImage} />
              ) : null}
              {option.label ? <Text style={styles.optionLabel}>{option.label}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 20,
    justifyContent: 'center',
  },
  promptContainer: {
    alignItems: 'center',
    gap: 8,
    marginVertical: 10,
  },
  promptImageCard: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  promptImage: {
    width: 220,
    height: 150,
    resizeMode: 'contain',
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  speakerButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  promptText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  optionCard: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 12,
    width: '45%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  optionCorrect: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  optionIncorrect: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  optionImage: {
    width: '70%',
    height: '70%',
    resizeMode: 'contain',
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 8,
  },
});
