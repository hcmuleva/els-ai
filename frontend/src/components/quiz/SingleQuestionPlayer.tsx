import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { API_BASE_URL } from '../../context/AuthContext';
import ChoiceQuestionRenderer from './ChoiceQuestionRenderer';
import DragDropRenderer from './DragDropRenderer';
import FillBlankRenderer from './FillBlankRenderer';
import ImageSelectRenderer from './ImageSelectRenderer';
import JigsawRenderer from './JigsawRenderer';
import LogicoQuestionRenderer from './LogicoQuestionRenderer';
import MemoryMatchRenderer from './MemoryMatchRenderer';
import { normalizeQuestionType, type QuestionTheme } from './QuizRenderer';

type Props = {
  questionType: string;
  questionTitle?: string;
  questionInstruction?: string;
  questionAudio?: string;
  questionData: unknown;
};

const QUESTION_THEMES: Record<string, QuestionTheme> = {
  true_false: {
    bg: '#D6EAFF',
    cardBg: '#EBF4FF',
    accent: '#4A90E2',
    textColor: '#1e3a8a',
    emoji: '🤔',
    label: 'True or False?',
  },
  guess_audio: {
    bg: '#D6EAFF',
    cardBg: '#EBF4FF',
    accent: '#4A90E2',
    textColor: '#1e3a8a',
    emoji: '🎵',
    label: 'Listen carefully!',
  },
  single_choice: {
    bg: '#D6EAFF',
    cardBg: '#EBF4FF',
    accent: '#4A90E2',
    textColor: '#2C6BC9',
    emoji: '💡',
    label: 'Pick the right one!',
  },
  multi_choice: {
    bg: '#D6EAFF',
    cardBg: '#EBF4FF',
    accent: '#4A90E2',
    textColor: '#2C6BC9',
    emoji: '✅',
    label: 'Select all correct!',
  },
  guess_image: {
    bg: '#D6EAFF',
    cardBg: '#EBF4FF',
    accent: '#4A90E2',
    textColor: '#2C6BC9',
    emoji: '👀',
    label: 'Find the match!',
  },
  drag_drop_match: {
    bg: '#D6EAFF',
    cardBg: '#EBF4FF',
    accent: '#4A90E2',
    textColor: '#2C6BC9',
    emoji: '🎯',
    label: 'Match them up!',
  },
  logico: {
    bg: '#D6EAFF',
    cardBg: '#EBF4FF',
    accent: '#4A90E2',
    textColor: '#2C6BC9',
    emoji: '🧩',
    label: 'Align the Logico clips!',
  },
  memory_match: {
    bg: '#EDE4FF',
    cardBg: '#F3ECFF',
    accent: '#7B4FCA',
    textColor: '#4A2E8C',
    emoji: '🃏',
    label: 'Match the pairs!',
  },
  fill_blank: {
    bg: '#FFF5CC',
    cardBg: '#FFFAE5',
    accent: '#E6A020',
    textColor: '#7A4A00',
    emoji: '✍️',
    label: 'Fill in the blank!',
  },
  jigsaw: {
    bg: '#E0F2FE',
    cardBg: '#F0F9FF',
    accent: '#0EA5E9',
    textColor: '#0C4A6E',
    emoji: '🧩',
    label: 'Rebuild the image!',
  },
};

const defaultTheme: QuestionTheme = {
  bg: '#D6EAFF',
  cardBg: '#EBF4FF',
  accent: '#4A90E2',
  textColor: '#2C6BC9',
  emoji: '🎯',
  label: 'Question',
};

export default function SingleQuestionPlayer({
  questionType,
  questionTitle,
  questionInstruction,
  questionAudio,
  questionData,
}: Props) {
  const [session, setSession] = useState(0);
  const [result, setResult] = useState<{ isCorrect: boolean; responseData: any } | null>(null);
  const normalizedType = normalizeQuestionType(questionType);
  const theme = useMemo(
    () => QUESTION_THEMES[normalizedType] ?? defaultTheme,
    [normalizedType],
  );

  const replay = () => {
    setSession((prev) => prev + 1);
    setResult(null);
  };

  const onComplete = (isCorrect: boolean, responseData: any) => {
    setResult({ isCorrect, responseData });
  };

  const rendererKey = `${normalizedType}-${session}`;

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={[s.badge, { backgroundColor: `${theme.accent}20` }]}>
          <Text style={[s.badgeText, { color: theme.accent }]}>
            {theme.emoji} {theme.label}
          </Text>
        </View>
        <Pressable style={s.replayBtn} onPress={replay}>
          <Text style={s.replayBtnText}>Replay</Text>
        </Pressable>
      </View>

      {questionTitle ? <Text style={s.title}>{questionTitle}</Text> : null}
      {questionInstruction ? <Text style={s.instruction}>{questionInstruction}</Text> : null}

      <View
        style={[
          s.rendererWrap,
          normalizedType === 'drag_drop_match' && s.rendererWrapOverflowVisible,
        ]}
      >
        {normalizedType === 'drag_drop_match' ? (
          <DragDropRenderer
            key={rendererKey}
            questionData={questionData as any}
            onComplete={onComplete}
            theme={theme}
          />
        ) : null}
        {normalizedType === 'guess_image' ? (
          <ImageSelectRenderer
            key={rendererKey}
            questionData={questionData as any}
            onComplete={onComplete}
            theme={theme}
          />
        ) : null}
        {['guess_audio', 'true_false', 'single_choice', 'multi_choice'].includes(normalizedType) ? (
          <ChoiceQuestionRenderer
            key={rendererKey}
            questionType={questionType}
            questionAudio={questionAudio}
            questionData={questionData as any}
            onComplete={onComplete}
            theme={theme}
          />
        ) : null}
        {normalizedType === 'logico' ? (
          <LogicoQuestionRenderer
            key={rendererKey}
            questionData={questionData as any}
            onComplete={onComplete}
            theme={theme}
          />
        ) : null}
        {normalizedType === 'memory_match' ? (
          <MemoryMatchRenderer
            key={rendererKey}
            questionData={questionData as any}
            onComplete={onComplete}
            theme={theme}
            apiBase={API_BASE_URL}
          />
        ) : null}
        {normalizedType === 'fill_blank' ? (
          <FillBlankRenderer
            key={rendererKey}
            questionData={questionData as any}
            onComplete={onComplete}
            theme={theme}
          />
        ) : null}
        {normalizedType === 'jigsaw' ? (
          <JigsawRenderer
            key={rendererKey}
            questionData={questionData as any}
            onComplete={onComplete}
            theme={theme}
            autoStart
          />
        ) : null}
      </View>

      {result ? (
        <View
          style={[
            s.resultPill,
            result.isCorrect ? s.resultPillSuccess : s.resultPillError,
          ]}
        >
          <Text
            style={[
              s.resultPillText,
              result.isCorrect ? s.resultPillTextSuccess : s.resultPillTextError,
            ]}
          >
            {result.isCorrect ? 'Correct answer flow works' : 'Incorrect answer flow works'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8ECF7',
    padding: 12,
    gap: 10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  replayBtn: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#CFE1FF',
    backgroundColor: '#EBF4FF',
  },
  replayBtnText: { fontSize: 11, fontWeight: '800', color: '#1A4DA2' },
  title: { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  instruction: { fontSize: 12, color: '#5A6A8A', lineHeight: 18 },
  rendererWrap: { borderRadius: 12, overflow: 'hidden' },
  rendererWrapOverflowVisible: { overflow: 'visible' },
  resultPill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  resultPillSuccess: { backgroundColor: '#DCFCE7' },
  resultPillError: { backgroundColor: '#FEE2E2' },
  resultPillText: { fontSize: 12, fontWeight: '700' },
  resultPillTextSuccess: { color: '#166534' },
  resultPillTextError: { color: '#B91C1C' },
});
