import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Award,
  BookOpen,
  Check,
  CheckCircle,
  Copy,
  ExternalLink,
  Eye,
  HelpCircle,
  ListChecks,
  Play,
  RotateCcw,
  Sparkles,
  Users,
  Video,
  X,
  XCircle,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Colors, Radius, Shadow, Spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useAiChat } from '../../context/AiChatContext';
import {
  fetchGeneratedContent,
  findCompletedGeneration,
  listenGenerationStream,
  startGeneration,
  type GenerationProposalData,
  type RevisionProposalData,
  type EntityRevisionProposalData,
} from '../../services/aiChat';
import type { ClarifyingQuestionData } from './ClarifyingQuestionCard';
import { ChatMarkdown } from './ChatMarkdown';

interface ProposalCardProps {
  proposal: GenerationProposalData;
  conversationId?: string;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: any; color: string; bg: string }
> = {
  content: {
    label: 'Lesson / Content',
    icon: BookOpen,
    color: '#2D5DC9',
    bg: '#EEF4FF',
  },
  topic: {
    label: 'Curriculum Topic',
    icon: Sparkles,
    color: '#D33F13',
    bg: '#FFF0EB',
  },
  quiz: {
    label: 'Assessment Quiz',
    icon: HelpCircle,
    color: '#176B47',
    bg: '#EAF7F0',
  },
  question: {
    label: 'Question Bank',
    icon: HelpCircle,
    color: '#7C3AED',
    bg: '#F5F3FF',
  },
  classroom: {
    label: 'Classroom Plan',
    icon: Users,
    color: '#B45309',
    bg: '#FEF3C7',
  },
  story: {
    label: 'Illustrated Story',
    icon: Sparkles,
    color: '#BE185D',
    bg: '#FCE7F3',
  },
};

const ORDERED_STEPS = [
  { key: 'gathering_information', label: 'Gathering curriculum information' },
  { key: 'creating_entity', label: 'Creating entity' },
  { key: 'adding_content', label: 'Adding content & verified video' },
  { key: 'validating_context', label: 'Validating context' },
  { key: 'finalizing', label: 'Finalizing' },
];

function normalizeContentType(
  raw?: string,
): 'topic' | 'content' | 'quiz' | 'question' | 'classroom' | 'story' {
  const lower = (raw || '').toLowerCase().replace(/[-_]/g, '');
  if (lower.includes('lesson') || lower.includes('content') || lower.includes('plan')) return 'content';
  if (lower.includes('topic')) return 'topic';
  if (lower.includes('quiz')) return 'quiz';
  if (lower.includes('question')) return 'question';
  if (lower.includes('class')) return 'classroom';
  if (lower.includes('story') || lower.includes('stories')) return 'story';
  return 'content';
}

function normalizeGradeLevel(val?: string | number): string {
  if (val === undefined || val === null) return '';
  const str = String(val).trim();
  const match = str.match(/\b(1[0-2]|[1-9])\b/);
  if (match) return match[1];
  if (/lkg/i.test(str)) return 'LKG';
  if (/ukg/i.test(str)) return 'UKG';
  if (/any/i.test(str)) return 'ANY';
  return str;
}

export function extractProposalFromMessage(content: string): {
  cleanedContent: string;
  proposal?: GenerationProposalData;
  revision?: RevisionProposalData;
  entityRevision?: EntityRevisionProposalData;
  clarifyingQuestion?: ClarifyingQuestionData;
} {
  if (!content) return { cleanedContent: content };

  // 1. Try markdown code block: ```(?:json)? ... ```
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/g;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = codeBlockRegex.exec(content)) !== null) {
    try {
      let parsed = JSON.parse(blockMatch[1].trim());
      if (parsed) {
        // Robustness: if model outputted "type": "content" or "type": "topic" etc., normalize to generation_proposal
        if (
          !parsed.type ||
          ['content', 'topic', 'quiz', 'question', 'classroom', 'story'].includes(parsed.type)
        ) {
          if (parsed.contentType || parsed.params || parsed.title) {
            parsed.contentType = normalizeContentType(parsed.contentType || parsed.type);
            parsed.type = 'generation_proposal';
          }
        }

        if (
          parsed.type === 'generation_proposal' ||
          parsed.type === 'revision_proposal' ||
          parsed.type === 'entity_revision_proposal' ||
          parsed.type === 'clarifying_question'
        ) {
          if (parsed.type === 'generation_proposal') {
            parsed.contentType = normalizeContentType(parsed.contentType);
            if (parsed.params && typeof parsed.params.format === 'string') {
              parsed.params.format = parsed.params.format.toLowerCase();
            }
          }
          let cleaned = (
            content.substring(0, blockMatch.index) +
            content.substring(blockMatch.index + blockMatch[0].length)
          ).trim();

          // If the model dumped a full content draft before the proposal JSON, truncate the draft
          // so the user gets a clean, professional proposal card rather than messy draft text
          const draftCutoffRegex = /(?:Here(?:'s| is) (?:the )?content:?|Here are the \d+ questions|Notes for |Question Bank:|### Video 1)/i;
          const cutoffMatch = cleaned.match(draftCutoffRegex);
          if (cutoffMatch && cutoffMatch.index !== undefined && cutoffMatch.index > 20) {
            cleaned = cleaned.substring(0, cutoffMatch.index).trim();
          }

          return {
            cleanedContent: cleaned || (parsed.type === 'clarifying_question' ? '' : 'I have prepared a proposal based on your request:'),
            proposal: parsed.type === 'generation_proposal' ? (parsed as GenerationProposalData) : undefined,
            revision: parsed.type === 'revision_proposal' ? (parsed as RevisionProposalData) : undefined,
            entityRevision:
              parsed.type === 'entity_revision_proposal'
                ? (parsed as EntityRevisionProposalData)
                : undefined,
            clarifyingQuestion:
              parsed.type === 'clarifying_question'
                ? (parsed as ClarifyingQuestionData)
                : undefined,
          };
        }
      }
    } catch {
      // continue searching
    }
  }

  // 2. Try raw JSON object containing "type": "generation_proposal", "revision_proposal", "entity_revision_proposal", or "clarifying_question"
  const targetIndex = content.search(
    /"(?:type|contentType)"\s*:\s*"(?:generation_proposal|revision_proposal|entity_revision_proposal|clarifying_question|content|topic|quiz|question|classroom|story)"/,
  );
  if (targetIndex !== -1) {
    let startIndex = -1;
    for (let i = targetIndex; i >= 0; i--) {
      if (content[i] === '{') {
        startIndex = i;
        break;
      }
    }

    if (startIndex !== -1) {
      let depth = 0;
      let inString = false;
      let escape = false;
      let endIndex = -1;

      for (let i = startIndex; i < content.length; i++) {
        const c = content[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (c === '\\' && inString) {
          escape = true;
          continue;
        }
        if (c === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (c === '{') depth++;
          else if (c === '}') {
            depth--;
            if (depth === 0) {
              endIndex = i + 1;
              break;
            }
          }
        }
      }

      if (endIndex !== -1) {
        try {
          const rawJson = content.substring(startIndex, endIndex);
          let parsed = JSON.parse(rawJson);
          if (parsed) {
            if (
              !parsed.type ||
              ['content', 'topic', 'quiz', 'question', 'classroom', 'story'].includes(parsed.type)
            ) {
              if (parsed.contentType || parsed.params || parsed.title) {
                parsed.contentType = normalizeContentType(parsed.contentType || parsed.type);
                parsed.type = 'generation_proposal';
              }
            }

            if (
              parsed.type === 'generation_proposal' ||
              parsed.type === 'revision_proposal' ||
              parsed.type === 'entity_revision_proposal' ||
              parsed.type === 'clarifying_question'
            ) {
              if (parsed.type === 'generation_proposal') {
                parsed.contentType = normalizeContentType(parsed.contentType);
                if (parsed.params && typeof parsed.params.format === 'string') {
                  parsed.params.format = parsed.params.format.toLowerCase();
                }
              }
              let cleaned = (content.substring(0, startIndex) + content.substring(endIndex)).trim();
              const draftCutoffRegex = /(?:Here(?:'s| is) (?:the )?content:?|Here are the \d+ questions|Notes for |Question Bank:|### Video 1)/i;
              const cutoffMatch = cleaned.match(draftCutoffRegex);
              if (cutoffMatch && cutoffMatch.index !== undefined && cutoffMatch.index > 20) {
                cleaned = cleaned.substring(0, cutoffMatch.index).trim();
              }

              return {
                cleanedContent: cleaned || 'I have prepared a proposal based on your request:',
                proposal: parsed.type === 'generation_proposal' ? (parsed as GenerationProposalData) : undefined,
                revision: parsed.type === 'revision_proposal' ? (parsed as RevisionProposalData) : undefined,
                entityRevision:
                  parsed.type === 'entity_revision_proposal'
                    ? (parsed as EntityRevisionProposalData)
                    : undefined,
                clarifyingQuestion:
                  parsed.type === 'clarifying_question'
                    ? (parsed as ClarifyingQuestionData)
                    : undefined,
              };
            }
          }
        } catch {
          // ignore parsing error
        }
      } else if (
        content.includes('"type": "generation_proposal"') ||
        content.includes('"type": "entity_revision_proposal"') ||
        content.includes('"contentType": "content"') ||
        content.includes('"type": "content"')
      ) {
        // Stream in progress: hide partial raw JSON
        const cleaned = content.substring(0, startIndex).trim();
        return { cleanedContent: cleaned || 'Drafting proposal...' };
      }
    }
  }

  // 3. Handle unclosed streaming markdown fence
  const unclosedMatch = content.match(/```(?:json)?\s*(\{[\s\S]*)$/);
  if (
    unclosedMatch &&
    (content.includes('"type": "generation_proposal"') ||
      content.includes('"type": "entity_revision_proposal"'))
  ) {
    const cleaned = content.substring(0, content.indexOf(unclosedMatch[0])).trim();
    return { cleanedContent: cleaned || 'Drafting proposal...' };
  }

  return { cleanedContent: content };
}

export function extractClarifyingQuestion(content: string): ClarifyingQuestionData | null {
  const res = extractProposalFromMessage(content);
  return res.clarifyingQuestion || null;
}

function getDestinationName(contentType?: string): string {
  if (contentType === 'story') return 'Stories';
  if (contentType === 'classroom') return 'Classroom';
  if (contentType === 'quiz') return 'Quiz Manager';
  if (contentType === 'topic') return 'Topics';
  if (contentType === 'question') return 'Question Bank';
  return 'Content Manager';
}

export function ProposalCard({ proposal, conversationId }: ProposalCardProps) {
  const router = useRouter();
  const { close: closeChat } = useAiChat();
  const { apiFetch, user } = useAuth();

  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed' | 'cancelled'>('idle');
  const [activeStep, setActiveStep] = useState<string>('gathering_information');
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ contentId: string; name: string; preview: any; data?: any } | null>(null);

  // Role guard — only teachers and superadmins may generate content
  const CREATOR_ROLES = new Set(['teacher', 'superadmin']);
  const canCreate = CREATOR_ROLES.has(user?.activeRole ?? '');
  if (!canCreate) return null;

  // Preview Modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [fullData, setFullData] = useState<any>(null);
  const [isLoadingFull, setIsLoadingFull] = useState(false);
  const [copied, setCopied] = useState(false);
  const [persistedQuizId, setPersistedQuizId] = useState<string | null>(null);
  const [isSavingQuiz, setIsSavingQuiz] = useState(false);

  const cfg = TYPE_CONFIG[proposal.contentType] || TYPE_CONFIG.content;
  const Icon = cfg.icon;

  const cacheKey = `ai_proposal_${conversationId || 'default'}_${proposal.contentType}_${proposal.title.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  // Restore saved generation state so card never reverts to idle
  useEffect(() => {
    let isMounted = true;

    const restoreCompletedState = async () => {
      // 1. Try local AsyncStorage
      try {
        const cachedStr = await AsyncStorage.getItem(cacheKey);
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          if (isMounted && cached?.status === 'completed' && cached?.result) {
            setResult(cached.result);
            if (cached.fullData) setFullData(cached.fullData);
            if (cached.persistedQuizId) setPersistedQuizId(cached.persistedQuizId);
            setStatus('completed');
            return;
          }
        }
      } catch {
        // ignore storage error
      }

      // 2. Server lookup fallback
      if (conversationId) {
        try {
          const serverResult = await findCompletedGeneration(
            conversationId,
            proposal.title,
            proposal.contentType
          );
          if (isMounted && serverResult && serverResult.found) {
            const resObj = {
              contentId: serverResult.contentId || '',
              name: serverResult.name || proposal.title,
              preview: serverResult.preview || {},
              data: serverResult.data,
            };
            setResult(resObj);
            if (serverResult.data) setFullData(serverResult.data);
            setStatus('completed');

            AsyncStorage.setItem(
              cacheKey,
              JSON.stringify({
                status: 'completed',
                result: resObj,
                fullData: serverResult.data,
                completedAt: Date.now(),
              })
            ).catch(() => {});
          }
        } catch {
          // ignore lookup error
        }
      }
    };

    restoreCompletedState();

    return () => {
      isMounted = false;
    };
  }, [cacheKey, conversationId, proposal.title, proposal.contentType]);

  const handleOpenPreview = async () => {
    setShowPreviewModal(true);
    if (fullData) return;
    if (result?.data) {
      setFullData(result.data);
      return;
    }
    if (result?.contentId) {
      setIsLoadingFull(true);
      try {
        const item = await fetchGeneratedContent(result.contentId);
        const fetched = item?.data || item;
        setFullData(fetched);
        AsyncStorage.setItem(
          cacheKey,
          JSON.stringify({
            status: 'completed',
            result,
            fullData: fetched,
            completedAt: Date.now(),
          })
        ).catch(() => {});
      } catch {
        setFullData({
          title: result.name,
          body: result.preview?.excerpt,
          overview: result.preview?.excerpt,
          keyTakeaways: result.preview?.keyTakeaways,
          video: result.preview?.video,
        });
      } finally {
        setIsLoadingFull(false);
      }
    } else if (result?.preview) {
      setFullData({
        title: result.name,
        body: result.preview?.excerpt,
        overview: result.preview?.excerpt,
        keyTakeaways: result.preview?.keyTakeaways,
        video: result.preview?.video,
      });
    }
  };

  const createQuizInLibrary = async (targetFullData?: any, targetResult?: any): Promise<string | null> => {
    const dataToUse = targetFullData || fullData || result?.data;
    const resToUse = targetResult || result;

    if (persistedQuizId) {
      try {
        const verifyRes = await apiFetch(`/quizzes/${persistedQuizId}`);
        if (verifyRes.ok) {
          const verifyJson = await verifyRes.json();
          if (Array.isArray(verifyJson.questions) && verifyJson.questions.length > 0) {
            return persistedQuizId;
          }
        }
      } catch {
        // Continue to attach questions
      }
    }

    const quizQuestions: any[] =
      (Array.isArray(dataToUse?.questions) && dataToUse.questions.length > 0)
        ? dataToUse.questions
        : (Array.isArray(dataToUse?.quiz?.questions) && dataToUse.quiz.questions.length > 0)
        ? dataToUse.quiz.questions
        : (Array.isArray(resToUse?.preview?.sampleQuestions) && resToUse.preview.sampleQuestions.length > 0)
        ? resToUse.preview.sampleQuestions
        : [];

    if (quizQuestions.length === 0) {
      return null;
    }

    const normalizedGrade = normalizeGradeLevel(
      proposal.params?.gradeLevel || dataToUse?.gradeLevel
    );
    const rawSubject = String(proposal.params?.subject || dataToUse?.subject || '').trim();
    const normalizedSubject =
      /^math(s|ematics)?$/i.test(rawSubject) ? 'Mathematics'
      : /^evs$/i.test(rawSubject) || /environmental/i.test(rawSubject) ? 'Environmental Studies (EVS)'
      : /^comp(uter)?(\s*sci(ence)?)?$/i.test(rawSubject) || /^cs$/i.test(rawSubject) ? 'Computer Science'
      : /^social(\s*studies|\s*sci(ence)?)?$/i.test(rawSubject) || /^sst$/i.test(rawSubject) ? 'Social Science'
      : rawSubject;
    const quizTitle =
      dataToUse?.title ||
      dataToUse?.quiz?.title ||
      resToUse?.name ||
      proposal.title ||
      'Practice Quiz';

    const quizType =
      (proposal.params?.quizType as string) ||
      (proposal.params?.questionType as string) ||
      (dataToUse?.quizType as string) ||
      'multi_choice';

    const formattedQuestions = quizQuestions.map((q: any, i: number) => {
      const qType = q.questionType || (q.questionData?.grid ? 'memory_match' : q.questionData?.image ? 'jigsaw' : q.questionData?.sentence ? 'fill_blank' : q.questionData?.drag_items ? 'drag_drop_match' : quizType);
      const rawOptions = Array.isArray(q.options) ? q.options : [];
      const questionOptions = rawOptions.map((opt: any, optIdx: number) => {
        const optText = typeof opt === 'string' ? opt : (opt?.text || opt?.label || opt?.option_text || String(opt));
        const isCorrect = q.correctAnswer !== undefined && q.correctAnswer !== null && q.correctAnswer !== ''
          ? optText.trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase()
          : optIdx === (q.correctOptionIndex ?? 0);
        return {
          id: `opt-${optIdx + 1}`,
          label: optText,
          text: optText,
          is_correct: isCorrect,
          correct: isCorrect,
        };
      });

      const isBoolQuestion = questionOptions.length === 2 &&
        questionOptions.every((o: any) => /^(true|false|yes|no)$/i.test(o.text.trim()));

      if (!isBoolQuestion && questionOptions.length > 1) {
        // Randomize option positions so the correct answer is distributed across A, B, C, D
        for (let j = questionOptions.length - 1; j > 0; j--) {
          const k = Math.floor(Math.random() * (j + 1));
          [questionOptions[j], questionOptions[k]] = [questionOptions[k], questionOptions[j]];
        }
        questionOptions.forEach((opt: any, idx: number) => {
          opt.id = `opt-${idx + 1}`;
        });
      }

      const correctIdx = questionOptions.findIndex((o) => o.is_correct);
      const fallbackCorrect = correctIdx >= 0 ? correctIdx : 0;
      if (questionOptions[fallbackCorrect]) {
        questionOptions[fallbackCorrect].is_correct = true;
        questionOptions[fallbackCorrect].correct = true;
      }

      let qData = q.questionData;
      if (!qData) {
        if (qType === 'fill_blank') {
          qData = {
            sentence: q.sentence || q.prompt || `Question ${i + 1}`,
            answer: q.answer || q.correctAnswer || (questionOptions[0]?.text || ''),
            options: rawOptions.length > 0 ? rawOptions : questionOptions.map((o: any) => o.text),
            hint: q.hint || q.explanation || '',
          };
        } else if (qType === 'memory_match') {
          qData = {
            grid: q.grid || '4x4',
            pairs: q.pairs || [],
          };
        } else if (qType === 'drag_drop_match') {
          qData = {
            drag_items: q.drag_items || [],
            drop_targets: q.drop_targets || [],
            match_rules: q.match_rules || [],
          };
        } else if (qType === 'jigsaw') {
          qData = {
            image: q.image || q.prompt_image || '',
            gridSize: q.gridSize || '3x3',
            difficulty: q.difficulty || (proposal.params?.difficulty as string) || 'medium',
          };
        } else {
          qData = {
            question: q.prompt || q.question || `Question ${i + 1}`,
            options: questionOptions,
            correctOptionIndex: fallbackCorrect,
            correct_option: fallbackCorrect,
            explanation: q.explanation || '',
          };
        }
      }

      return {
        questionType: qType,
        questionTitle: q.prompt || q.question || `Question ${i + 1}`,
        explanation: q.explanation || '',
        points: 10,
        timeLimitSeconds: 30,
        sortOrder: i + 1,
        questionData: qData,
      };
    });

    try {
      setIsSavingQuiz(true);
      let targetQuizId = persistedQuizId;

      if (!targetQuizId) {
        const qRes = await apiFetch('/quizzes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: quizTitle,
            class_level: normalizedGrade,
            subject: normalizedSubject,
            quizType,
            difficultyLevel: (proposal.params?.difficulty as string) || 'Medium',
            isPublished: true,
            isAiGenerated: true,
            questions: formattedQuestions,
          }),
        });

        if (!qRes.ok) {
          const errJson = await qRes.json().catch(() => ({}));
          console.warn('[ProposalCard] Failed to create quiz in library:', errJson);
          return null;
        }

        const createdQuiz = await qRes.json();
        targetQuizId = String(createdQuiz.id);
        setPersistedQuizId(targetQuizId);

        // If backend didn't insert questions inline, insert them one by one
        if (!createdQuiz.total_questions || createdQuiz.total_questions === 0) {
          for (const fq of formattedQuestions) {
            await apiFetch(`/quizzes/${targetQuizId}/questions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(fq),
            }).catch((err) => console.warn('[ProposalCard] Error adding question to quiz:', err));
          }
        }
      } else {
        // Persisted quiz existed but had 0 questions, attach them now
        for (const fq of formattedQuestions) {
          await apiFetch(`/quizzes/${targetQuizId}/questions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fq),
          }).catch((err) => console.warn('[ProposalCard] Error adding question to existing quiz:', err));
        }
      }

      AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({
          status: 'completed',
          result: resToUse,
          fullData: dataToUse,
          persistedQuizId: targetQuizId,
          completedAt: Date.now(),
        })
      ).catch(() => {});

      return targetQuizId;
    } catch (err) {
      console.warn('[ProposalCard] Could not create quiz entity in library:', err);
      return null;
    } finally {
      setIsSavingQuiz(false);
    }
  };

  const handleGoToCreationPage = async () => {
    setShowPreviewModal(false);

    if (proposal.contentType === 'content') {
      const videoObj = fullData?.video || result?.preview?.video;
      const sectionsDraft: any[] = [];

      const normalizedGrade = normalizeGradeLevel(
        proposal.params?.gradeLevel || fullData?.gradeLevel
      );
      const normalizedSubject =
        proposal.params?.subject || fullData?.subject || '';

      const quizInfo =
        fullData?.quiz ||
        (Array.isArray(fullData?.questions) && fullData.questions.length > 0
          ? {
              title: `${result?.name || proposal.title} - Practice Quiz & PYQs`,
              questions: fullData.questions,
              yearsCovered: fullData?.quiz?.yearsCovered || [],
            }
          : null);

      // Auto-create persistent quiz in teacher library if questions exist
      let createdQuizId: string | null = persistedQuizId;
      if (!createdQuizId && quizInfo && Array.isArray(quizInfo.questions) && quizInfo.questions.length > 0) {
        createdQuizId = await createQuizInLibrary(fullData, result);
      }

      // Case 1: Structured sections already generated
      if (Array.isArray(fullData?.sections) && fullData.sections.length > 0) {
        fullData.sections.forEach((sec: any, idx: number) => {
          sectionsDraft.push({
            draftId: sec.draftId || `sec-ai-${idx + 1}`,
            title: sec.title || sec.heading || `Section ${idx + 1}`,
            contentType: sec.contentType || (sec.externalUrl ? 'youtube_url' : 'text'),
            mediaUrl: sec.mediaUrl || '',
            externalUrl: sec.externalUrl || '',
            textContent: sec.textContent || sec.content || sec.body || '',
            quizId: sec.quizId || (idx === 0 ? createdQuizId : null),
          });
        });
      } else {
        // Case 2: Multi-video fallback or single video
        const videoList: any[] =
          Array.isArray(fullData?.videos) && fullData.videos.length > 0
            ? fullData.videos
            : Array.isArray(result?.preview?.videos) && result.preview.videos.length > 0
            ? result.preview.videos
            : videoObj?.url
            ? [videoObj]
            : [];

        videoList.forEach((v: any, idx: number) => {
          if (v?.url) {
            sectionsDraft.push({
              draftId: `sec-ai-yt-${idx + 1}`,
              title: v.title || `Video Lesson ${idx + 1}`,
              contentType: 'youtube_url',
              mediaUrl: '',
              externalUrl: v.url,
              textContent: '',
              quizId: idx === 0 ? createdQuizId : null,
            });
          }
        });

        const textBody =
          fullData?.body ||
          fullData?.overview ||
          result?.preview?.excerpt ||
          proposal.summary ||
          '';

        if (textBody) {
          sectionsDraft.push({
            draftId: 'sec-ai-text',
            title: 'Lesson Notes & Outline',
            contentType: 'text',
            mediaUrl: '',
            externalUrl: '',
            textContent: textBody,
            quizId: null,
          });
        }
      }

      // Quiz is created as a real entity via POST /quizzes above.
      // Attach createdQuizId to the first video section if not already set.
      if (createdQuizId && sectionsDraft.length > 0) {
        const firstVideoSec = sectionsDraft.find((s) => s.contentType === 'youtube_url');
        if (firstVideoSec && !firstVideoSec.quizId) {
          firstVideoSec.quizId = createdQuizId;
        } else if (!sectionsDraft[0].quizId) {
          sectionsDraft[0].quizId = createdQuizId;
        }
      }

      if (sectionsDraft.length === 0) {
        sectionsDraft.push({
          draftId: 'sec-ai-1',
          title: '',
          contentType: 'youtube_url',
          mediaUrl: '',
          externalUrl: '',
          textContent: '',
          quizId: null,
        });
      }

      const draftPayload = {
        title: result?.name || proposal.title,
        classLevel: normalizedGrade,
        subject: normalizedSubject,
        sections: sectionsDraft,
      };

      try {
        await AsyncStorage.setItem('els_content_draft', JSON.stringify(draftPayload));
        await AsyncStorage.setItem('els_auto_open_create', 'true');
        await AsyncStorage.setItem('manage_active_tab', 'content');
      } catch {}

      DeviceEventEmitter.emit('els_open_content_create');

      closeChat();

      router.push({
        pathname: '/(tabs)/manage',
        params: { tab: 'content', action: 'create', _ts: String(Date.now()) },
      } as any);
      return;
    }

    if (proposal.contentType === 'topic') {
      const normalizedGrade = normalizeGradeLevel(
        proposal.params?.gradeLevel || fullData?.gradeLevel
      );
      const normalizedSubject =
        proposal.params?.subject || fullData?.subject || '';

      const topicDraftPayload = {
        title: result?.name || proposal.title,
        classLevel: normalizedGrade,
        subject: normalizedSubject,
      };

      try {
        await AsyncStorage.setItem('els_auto_open_create_topic', JSON.stringify(topicDraftPayload));
        await AsyncStorage.setItem('manage_active_tab', 'topic');
      } catch {}

      DeviceEventEmitter.emit('els_open_topic_create', topicDraftPayload);

      closeChat();

      router.push({
        pathname: '/(tabs)/manage',
        params: { tab: 'topic', action: 'create', _ts: String(Date.now()) },
      } as any);
      return;
    }

    if (proposal.contentType === 'quiz') {
      let targetQuizId = persistedQuizId;
      if (!targetQuizId) {
        targetQuizId = await createQuizInLibrary();
      }

      closeChat();

      if (targetQuizId) {
        DeviceEventEmitter.emit('els_open_quiz_review', {
          quizId: targetQuizId,
          action: 'preview',
        });
        router.push({
          pathname: '/(tabs)/manage',
          params: {
            tab: 'quiz',
            quizId: targetQuizId,
            action: 'preview',
            _ts: String(Date.now()),
          },
        } as any);
      } else {
        router.push('/(tabs)/manage?tab=quiz' as any);
      }
      return;
    }

    closeChat();
    if (proposal.contentType === 'story') {
      router.push('/(tabs)/stories' as any);
    } else if (proposal.contentType === 'classroom') {
      router.push('/(tabs)/classroom' as any);
    } else if (proposal.contentType === 'question') {
      router.push('/(tabs)/manage?tab=questions' as any);
    } else {
      router.push('/(tabs)/manage?tab=content' as any);
    }
  };

  const handleCopyAll = () => {
    let text = `${result?.name || proposal.title}\n\n`;
    if (fullData?.overview) text += `${fullData.overview}\n\n`;
    if (fullData?.body) text += `${fullData.body}\n\n`;
    if (fullData?.keyTakeaways?.length) {
      text += `Key Takeaways:\n${fullData.keyTakeaways.map((k: string) => `- ${k}`).join('\n')}\n\n`;
    }
    if (fullData?.video?.url) text += `Video: ${fullData.video.url}\n\n`;
    const copyQuestions =
      Array.isArray(fullData?.questions) && fullData.questions.length > 0
        ? fullData.questions
        : Array.isArray(fullData?.quiz?.questions)
        ? fullData.quiz.questions
        : [];
    if (copyQuestions.length) {
      text += `Questions:\n${copyQuestions.map((q: any, i: number) => `${i + 1}. ${q.prompt}\n${(q.options || []).map((o: string, oi: number) => `   ${String.fromCharCode(65 + oi)}. ${o}${oi === q.correctOptionIndex ? ' (Correct)' : ''}`).join('\n')}\nExplanation: ${q.explanation || ''}`).join('\n\n')}`;
    }
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleGenerate = async () => {
    setStatus('running');
    setError(null);
    setCompletedSteps([]);
    setActiveStep('gathering_information');

    try {
      const sanitizedProposal = {
        ...proposal,
        params: {
          ...proposal.params,
          topic: proposal.params?.topic || (proposal.params as any)?.title || proposal.title,
          title: (proposal.params as any)?.title || proposal.title,
          gradeLevel: proposal.params?.gradeLevel !== undefined ? String(proposal.params.gradeLevel) : '',
        },
      };

      const { jobId } = await startGeneration(sanitizedProposal, conversationId);

      await listenGenerationStream(jobId, {
        onStepStart: (step) => {
          setActiveStep(step);
        },
        onStepComplete: (step) => {
          setCompletedSteps((prev) => [...prev, step]);
        },
        onJobCompleted: async (res) => {
          setResult(res);
          const full = res.data || (res.preview ? { title: res.name, overview: res.preview.excerpt, video: res.preview.video } : null);
          if (full) setFullData(full);
          setStatus('completed');

          let autoCreatedQuizId: string | null = null;
          if (proposal.contentType === 'quiz') {
            autoCreatedQuizId = await createQuizInLibrary(full, res);
          }

          AsyncStorage.setItem(
            cacheKey,
            JSON.stringify({
              status: 'completed',
              result: res,
              fullData: full,
              persistedQuizId: autoCreatedQuizId,
              completedAt: Date.now(),
            })
          ).catch(() => {});
        },
        onJobFailed: (err) => {
          setError(err);
          setStatus('failed');
        },
      });
    } catch (err: any) {
      setError(err.message || 'Generation failed to start');
      setStatus('failed');
    }
  };

  const handleRegenerate = async () => {
    await AsyncStorage.removeItem(cacheKey).catch(() => {});
    handleGenerate();
  };

  const handleCancel = () => {
    setStatus('cancelled');
  };

  if (status === 'cancelled') {
    return (
      <View style={s.cancelledCard}>
        <Text style={s.cancelledText}>Generation cancelled</Text>
      </View>
    );
  }

  return (
    <View style={s.card}>
      {/* Header with Type Badge */}
      <View style={s.headerRow}>
        <View style={[s.badge, { backgroundColor: cfg.bg }]}>
          <Icon size={12} color={cfg.color} strokeWidth={2.5} />
          <Text style={[s.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        {status === 'idle' && (
          <Pressable onPress={handleCancel} hitSlop={8} style={s.cancelCrossBtn}>
            <X size={14} color="#9CA3AF" />
          </Pressable>
        )}
      </View>

      {/* Title & Summary */}
      <Text style={s.title}>{proposal.title}</Text>
      {proposal.summary ? <Text style={s.summary}>{proposal.summary}</Text> : null}

      {/* Rich param chips — all non-null params */}
      {status === 'idle' && proposal.params && (() => {
        const CHIP_LABELS: Record<string, string> = {
          subject: 'Subject',
          gradeLevel: 'Grade',
          grade: 'Grade',
          questionCount: 'Questions',
          difficulty: 'Difficulty',
          language: 'Language',
          topic: 'Topic',
          chapters: 'Chapters',
          sectionCount: 'Sections',
          videoCount: 'Videos',
          questionType: 'Type',
          examName: 'Exam',
        };
        const SKIP_KEYS = new Set(['title', 'summary', 'type', 'contentType', 'conversationId']);
        const chips = Object.entries(proposal.params)
          .filter(([k, v]) => !SKIP_KEYS.has(k) && v !== null && v !== undefined && v !== '')
          .map(([k, v]) => ({
            label: CHIP_LABELS[k] || k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
            value: Array.isArray(v) ? v.join(', ') : String(v),
          }));
        if (chips.length === 0) return null;
        return (
          <View style={s.chipsRow}>
            {chips.map((c) => (
              <View key={c.label} style={s.chip}>
                <Text style={s.chipLabel}>{c.label}: </Text>
                <Text style={s.chipVal} numberOfLines={1}>{c.value}</Text>
              </View>
            ))}
          </View>
        );
      })()}

      {/* Detail rows — structured preview of what will be generated */}
      {status === 'idle' && proposal.params && (() => {
        const DETAIL_FIELDS: Array<{ key: string; label: string }> = [
          { key: 'topic', label: 'Topic' },
          { key: 'chapters', label: 'Chapters' },
          { key: 'examName', label: 'Exam' },
          { key: 'language', label: 'Language' },
          { key: 'sectionCount', label: 'No. of Sections' },
          { key: 'videoCount', label: 'No. of Videos' },
          { key: 'questionCount', label: 'No. of Questions' },
          { key: 'difficulty', label: 'Difficulty' },
          { key: 'questionType', label: 'Question Type' },
        ];
        const rows = DETAIL_FIELDS.filter(({ key }) => {
          const v = proposal.params[key];
          return v !== null && v !== undefined && v !== '';
        });
        if (rows.length === 0) return null;
        return (
          <View style={s.detailBox}>
            <Text style={s.detailBoxHeading}>What will be generated</Text>
            {rows.map(({ key, label }) => {
              const v = proposal.params[key];
              const display = Array.isArray(v) ? v.join(', ') : String(v);
              return (
                <View key={key} style={s.detailRow}>
                  <Text style={s.detailRowLabel}>{label}</Text>
                  <Text style={s.detailRowVal} numberOfLines={2}>{display}</Text>
                </View>
              );
            })}
          </View>
        );
      })()}

      {/* State: Idle -> Action Buttons */}
      {status === 'idle' && (
        <View style={s.actionsRow}>
          <Pressable onPress={handleGenerate} style={s.generateBtn}>
            <Sparkles size={15} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={s.generateBtnText}>Generate Now</Text>
          </Pressable>
          <Pressable onPress={handleCancel} style={s.cancelBtn}>
            <Text style={s.cancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {/* State: Running -> 5-step Live Tracker */}
      {status === 'running' && (
        <View style={s.trackerBox}>
          <Text style={s.trackerHeading}>Building your educational content...</Text>
          {ORDERED_STEPS.map((step) => {
            const isDone = completedSteps.includes(step.key);
            const isActive = activeStep === step.key && !isDone;

            return (
              <View key={step.key} style={s.stepRow}>
                <View style={s.stepIconWrap}>
                  {isDone ? (
                    <CheckCircle size={15} color={Colors.success} strokeWidth={2.5} />
                  ) : isActive ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <View style={s.stepDotPending} />
                  )}
                </View>
                <Text
                  style={[
                    s.stepLabel,
                    isDone && s.stepLabelDone,
                    isActive && s.stepLabelActive,
                  ]}
                >
                  {step.label.replace('{contentType}', cfg.label)}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* State: Completed -> Green check + Preview */}
      {status === 'completed' && result && (
        <View style={s.completedBox}>
          <View style={s.completedHeader}>
            <CheckCircle size={18} color={Colors.success} strokeWidth={2.5} />
            <Text style={s.completedTitle}>Generated Successfully!</Text>
          </View>

          <Text style={s.resultName}>{result.name}</Text>

          {/* Verified YouTube Video Card */}
          {result.preview?.video?.url && (
            <View style={s.videoCard}>
              {result.preview.video.thumbnailUrl ? (
                <Image
                  source={{ uri: result.preview.video.thumbnailUrl }}
                  style={s.videoThumb}
                  resizeMode="cover"
                />
              ) : (
                <View style={s.videoPlaceholder}>
                  <Video size={24} color="#6B7280" />
                </View>
              )}
              <View style={s.videoInfo}>
                <View style={s.videoBadge}>
                  <Play size={10} color="#D33F13" fill="#D33F13" />
                  <Text style={s.videoBadgeText}>Verified YouTube Video</Text>
                </View>
                <Text style={s.videoTitle} numberOfLines={2}>
                  {result.preview.video.title}
                </Text>
                <Pressable
                  onPress={() => Linking.openURL(result.preview.video.url)}
                  style={s.watchBtn}
                >
                  <Text style={s.watchBtnText}>Watch Video</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Excerpt / Takeaways for Lesson */}
          {result.preview?.excerpt ? (
            <View style={s.previewExcerptBox}>
              <Text style={s.previewExcerptText} numberOfLines={4}>
                {result.preview.excerpt}
              </Text>
            </View>
          ) : null}

          {/* Question Count for Quiz */}
          {result.preview?.questionCount ? (
            <View style={s.previewMetaRow}>
              <Text style={s.previewMetaText}>
                {result.preview.questionCount} Questions generated with explanations & answers
              </Text>
            </View>
          ) : null}

          {/* Action Buttons: Open Preview & Go to Creation Page */}
          <View style={s.completedActionsRow}>
            <Pressable onPress={handleOpenPreview} style={s.openPreviewBtn}>
              <Eye size={15} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={s.openPreviewBtnText}>Open Preview</Text>
            </Pressable>

            <Pressable
              onPress={handleGoToCreationPage}
              style={[s.goToCreationBtn, isSavingQuiz && { opacity: 0.7 }]}
              disabled={isSavingQuiz}
            >
              {isSavingQuiz ? (
                <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 4 }} />
              ) : (
                <ExternalLink size={13} color={Colors.primary} strokeWidth={2.2} />
              )}
              <Text style={s.goToCreationBtnText}>
                {isSavingQuiz
                  ? 'Saving to Library...'
                  : proposal.contentType === 'quiz'
                  ? 'Review in Quiz Manager'
                  : `Open in ${getDestinationName(proposal.contentType)}`}
              </Text>
            </Pressable>

            <Pressable onPress={handleRegenerate} style={s.regenerateBtnSmall}>
              <RotateCcw size={12} color="#64748B" />
              <Text style={s.regenerateBtnSmallText}>Regenerate</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* State: Failed */}
      {status === 'failed' && (
        <View style={s.errorBox}>
          <View style={s.errorRow}>
            <XCircle size={16} color={Colors.error} />
            <Text style={s.errorText}>{error || 'Generation failed'}</Text>
          </View>
          <Pressable onPress={handleGenerate} style={s.retryBtn}>
            <RotateCcw size={12} color="#FFFFFF" />
            <Text style={s.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Full Content Preview Modal */}
      <Modal
        visible={showPreviewModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowPreviewModal(false)}
      >
        <View style={s.modalOverlay}>
          <Pressable style={s.modalBackdrop} onPress={() => setShowPreviewModal(false)} />
          <View style={s.modalContainer}>
            {/* Modal Header */}
            <View style={s.modalHeader}>
              <View style={s.modalHeaderTitleWrap}>
                <View style={[s.badge, { backgroundColor: cfg.bg }]}>
                  <Icon size={12} color={cfg.color} strokeWidth={2.5} />
                  <Text style={[s.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
                <Text style={s.modalHeaderTitle} numberOfLines={1}>
                  {result?.name || proposal.title}
                </Text>
              </View>

              <View style={s.modalHeaderActions}>
                <Pressable onPress={handleCopyAll} style={s.modalActionBtn}>
                  {copied ? (
                    <>
                      <Check size={13} color={Colors.success} strokeWidth={2.5} />
                      <Text style={[s.modalActionBtnText, { color: Colors.success }]}>Copied</Text>
                    </>
                  ) : (
                    <>
                      <Copy size={13} color={Colors.textSecondary} strokeWidth={2} />
                      <Text style={s.modalActionBtnText}>Copy</Text>
                    </>
                  )}
                </Pressable>

                <Pressable onPress={() => setShowPreviewModal(false)} style={s.modalCloseBtn}>
                  <X size={17} color="#6B7280" />
                </Pressable>
              </View>
            </View>

            {/* Modal Body */}
            {isLoadingFull ? (
              <View style={s.modalLoadingWrap}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={s.modalLoadingText}>Loading full generated content...</Text>
              </View>
            ) : (
              <ScrollView style={s.modalScrollView} contentContainerStyle={s.modalScrollContent}>
                {/* Meta Chips */}
                <View style={s.modalMetaRow}>
                  {proposal.params?.subject ? (
                    <View style={s.chip}>
                      <Text style={s.chipLabel}>Subject: </Text>
                      <Text style={s.chipVal}>{String(proposal.params.subject)}</Text>
                    </View>
                  ) : null}
                  {proposal.params?.gradeLevel ? (
                    <View style={s.chip}>
                      <Text style={s.chipLabel}>Grade: </Text>
                      <Text style={s.chipVal}>{String(proposal.params.gradeLevel)}</Text>
                    </View>
                  ) : null}
                  {proposal.params?.format ? (
                    <View style={s.chip}>
                      <Text style={s.chipLabel}>Format: </Text>
                      <Text style={s.chipVal}>{String(proposal.params.format)}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Verified YouTube Video Showcase (Single or Multiple) */}
                {(() => {
                  const videos: any[] = (Array.isArray(fullData?.videos) && fullData.videos.length > 0)
                    ? fullData.videos
                    : (Array.isArray(result?.preview?.videos) && result.preview.videos.length > 0)
                    ? result.preview.videos
                    : (fullData?.video?.url ? [fullData.video] : (result?.preview?.video?.url ? [result.preview.video] : []));

                  if (videos.length === 0) return null;

                  return (
                    <View style={s.modalVideosSection}>
                      <View style={s.modalVideosSectionHeader}>
                        <Video size={15} color="#D33F13" strokeWidth={2.2} />
                        <Text style={s.modalVideosSectionTitle}>
                          Verified Video Lessons ({videos.length})
                        </Text>
                      </View>
                      {videos.map((vid: any, vIdx: number) => (
                        <View key={vIdx} style={s.modalVideoCard}>
                          {vid.thumbnailUrl ? (
                            <Image
                              source={{ uri: vid.thumbnailUrl }}
                              style={s.modalVideoThumb}
                              resizeMode="cover"
                            />
                          ) : null}
                          <View style={s.modalVideoContent}>
                            <View style={s.videoBadge}>
                              <Play size={10} color="#D33F13" fill="#D33F13" />
                              <Text style={s.videoBadgeText}>
                                {videos.length > 1 ? `Video Module ${vIdx + 1}` : 'Verified YouTube Video'}
                              </Text>
                            </View>
                            <Text style={s.modalVideoTitle}>{vid.title}</Text>
                            <Pressable
                              onPress={() => Linking.openURL(vid.url)}
                              style={s.modalWatchBtn}
                            >
                              <Play size={11} color="#FFFFFF" fill="#FFFFFF" />
                              <Text style={s.modalWatchBtnText}>Watch on YouTube</Text>
                            </Pressable>
                          </View>
                        </View>
                      ))}
                    </View>
                  );
                })()}

                {/* Overview Card */}
                {fullData?.overview ? (
                  <View style={s.modalSectionBox}>
                    <Text style={s.modalSectionTitle}>Overview</Text>
                    <Text style={s.modalBodyText}>{fullData.overview}</Text>
                  </View>
                ) : null}

                {/* Full Markdown Body */}
                {fullData?.body ? (
                  <View style={s.modalSectionBox}>
                    <ChatMarkdown content={fullData.body} isUser={false} />
                  </View>
                ) : null}

                {/* Structured Sections (if present) */}
                {Array.isArray(fullData?.sections) && fullData.sections.length > 0 && (
                  <View style={s.modalSectionsWrap}>
                    {fullData.sections.map((sec: any, idx: number) => (
                      <View key={idx} style={s.modalSectionBox}>
                        <Text style={s.modalSectionTitle}>{sec.heading || sec.title}</Text>
                        <Text style={s.modalBodyText}>{sec.textContent || sec.content || sec.body}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Key Takeaways */}
                {Array.isArray(fullData?.keyTakeaways) && fullData.keyTakeaways.length > 0 && (
                  <View style={s.modalTakeawaysBox}>
                    <View style={s.modalTakeawaysHeader}>
                      <Award size={16} color={Colors.primary} />
                      <Text style={s.modalTakeawaysTitle}>Key Takeaways</Text>
                    </View>
                    {fullData.keyTakeaways.map((t: string, idx: number) => (
                      <View key={idx} style={s.modalTakeawayItem}>
                        <CheckCircle size={14} color={Colors.success} strokeWidth={2.5} />
                        <Text style={s.modalTakeawayText}>{t}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Learning Objectives for Topics */}
                {Array.isArray(fullData?.learningObjectives) && fullData.learningObjectives.length > 0 && (
                  <View style={s.modalTakeawaysBox}>
                    <View style={s.modalTakeawaysHeader}>
                      <ListChecks size={16} color={Colors.primary} />
                      <Text style={s.modalTakeawaysTitle}>Learning Objectives</Text>
                    </View>
                    {fullData.learningObjectives.map((obj: string, idx: number) => (
                      <View key={idx} style={s.modalTakeawayItem}>
                        <CheckCircle size={14} color={Colors.success} strokeWidth={2.5} />
                        <Text style={s.modalTakeawayText}>{obj}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Topic Outline */}
                {Array.isArray(fullData?.outline) && fullData.outline.length > 0 && (
                  <View style={s.modalSectionBox}>
                    <Text style={s.modalSectionTitle}>Curriculum Outline</Text>
                    {fullData.outline.map((item: any, idx: number) => (
                      <View key={idx} style={s.outlineItem}>
                        <View style={s.outlineHeader}>
                          <Text style={s.outlineIndex}>{idx + 1}</Text>
                          <Text style={s.outlineTitle}>{item.title}</Text>
                          {item.estimatedMinutes ? (
                            <Text style={s.outlineTime}>{item.estimatedMinutes} mins</Text>
                          ) : null}
                        </View>
                        {item.description ? (
                          <Text style={s.outlineDesc}>{item.description}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}

                {/* Standalone Quiz Questions */}
                {Array.isArray(fullData?.questions) && fullData.questions.length > 0 && (
                  <View style={s.modalQuestionsWrap}>
                    <Text style={s.modalSectionTitle}>
                      Quiz Questions ({fullData.questions.length})
                    </Text>
                    {fullData.questions.map((q: any, idx: number) => (
                      <View key={idx} style={s.quizQuestionCard}>
                        {q.sourceBadge ? (
                          <View style={s.pyqBadge}>
                            <Text style={s.pyqBadgeText}>{q.sourceBadge}</Text>
                          </View>
                        ) : q.examYear ? (
                          <View style={s.pyqBadge}>
                            <Text style={s.pyqBadgeText}>
                              {q.examName ? `${q.examName} ` : ''}{q.examYear}
                            </Text>
                          </View>
                        ) : null}
                        <Text style={s.quizQuestionPrompt}>
                          <Text style={{ fontWeight: '800' }}>Q{idx + 1}. </Text>
                          {q.prompt}
                        </Text>
                        {q.image ? (
                          <View style={{ borderRadius: Radius.md, overflow: 'hidden', borderWidth: 1, borderColor: '#E8ECF4', marginTop: 4 }}>
                            <Image source={{ uri: q.image }} style={{ width: '100%', height: 160 }} resizeMode="cover" />
                            <View style={{ padding: 6, backgroundColor: '#F8FAFC', flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 11, color: '#64748B' }}>🧩 Grid: {q.gridSize || '3x3'}</Text>
                              <Text style={{ fontSize: 11, color: '#64748B' }}>Difficulty: {q.difficulty || 'medium'}</Text>
                            </View>
                          </View>
                        ) : null}
                        {Array.isArray(q.pairs) && q.pairs.length > 0 ? (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                            {q.pairs.map((pair: any, pIdx: number) => (
                              <View key={pIdx} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#F1F5F9', borderRadius: Radius.md, borderWidth: 1, borderColor: '#E8ECF4' }}>
                                <Text style={{ fontSize: 16 }}>{pair.emoji || '✨'}</Text>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#1E293B' }}>{pair.label}</Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                        {Array.isArray(q.drag_items) && q.drag_items.length > 0 ? (
                          <View style={{ gap: 6, marginTop: 4 }}>
                            {q.drag_items.map((item: any, dIdx: number) => {
                              const target = q.drop_targets?.[dIdx];
                              return (
                                <View key={dIdx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8, backgroundColor: '#F8FAFC', borderRadius: Radius.md, borderWidth: 1, borderColor: '#E8ECF4' }}>
                                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#0F172A' }}>{item.label}</Text>
                                  <Text style={{ fontSize: 12, color: '#64748B' }}>➔</Text>
                                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#166534', backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.sm }}>{target?.label || ''}</Text>
                                </View>
                              );
                            })}
                          </View>
                        ) : null}
                        {Array.isArray(q.options) && (
                          <View style={s.quizOptionsWrap}>
                            {q.options.map((opt: string, optIdx: number) => {
                              const isCorrect = optIdx === q.correctOptionIndex || opt === q.correctAnswer;
                              return (
                                <View
                                  key={optIdx}
                                  style={[
                                    s.quizOptionRow,
                                    isCorrect && s.quizOptionCorrect,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      s.quizOptionLetter,
                                      isCorrect && s.quizOptionLetterCorrect,
                                    ]}
                                  >
                                    {String.fromCharCode(65 + optIdx)}
                                  </Text>
                                  <Text
                                    style={[
                                      s.quizOptionText,
                                      isCorrect && s.quizOptionTextCorrect,
                                    ]}
                                  >
                                    {opt}
                                  </Text>
                                  {isCorrect && (
                                    <View style={s.correctBadge}>
                                      <Text style={s.correctBadgeText}>Correct</Text>
                                    </View>
                                  )}
                                </View>
                              );
                            })}
                          </View>
                        )}
                        {q.explanation ? (
                          <View style={s.explanationBox}>
                            <Text style={s.explanationText}>
                              <Text style={{ fontWeight: '700' }}>Explanation: </Text>
                              {q.explanation}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}

                {/* Attached Practice Quiz & PYQs (when attached to content) */}
                {(() => {
                  const quizObj = fullData?.quiz || result?.preview?.quiz;
                  const quizQuestions: any[] = quizObj?.questions || quizObj?.sampleQuestions || [];
                  if (quizQuestions.length === 0) return null;

                  return (
                    <View style={s.modalQuestionsWrap}>
                      <View style={s.modalQuizHeaderRow}>
                        <HelpCircle size={17} color="#176B47" strokeWidth={2.2} />
                        <Text style={s.modalSectionTitle}>
                          {quizObj.title || `Practice Quiz & Previous Year Questions (${quizQuestions.length})`}
                        </Text>
                      </View>
                      {Array.isArray(quizObj.yearsCovered) && quizObj.yearsCovered.length > 0 && (
                        <View style={s.yearsCoveredRow}>
                          <Text style={s.yearsCoveredLabel}>Years Covered:</Text>
                          {quizObj.yearsCovered.map((yr: string, yIdx: number) => (
                            <View key={yIdx} style={s.yearBadge}>
                              <Text style={s.yearBadgeText}>{yr}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                      {quizQuestions.map((q: any, idx: number) => (
                        <View key={idx} style={s.quizQuestionCard}>
                          {q.sourceBadge ? (
                            <View style={s.pyqBadge}>
                              <Text style={s.pyqBadgeText}>{q.sourceBadge}</Text>
                            </View>
                          ) : q.examYear ? (
                            <View style={s.pyqBadge}>
                              <Text style={s.pyqBadgeText}>
                                {q.examName ? `${q.examName} ` : ''}{q.examYear}
                              </Text>
                            </View>
                          ) : null}
                          <Text style={s.quizQuestionPrompt}>
                            <Text style={{ fontWeight: '800' }}>Q{idx + 1}. </Text>
                            {q.prompt}
                          </Text>
                          {Array.isArray(q.options) && (
                            <View style={s.quizOptionsWrap}>
                              {q.options.map((opt: string, optIdx: number) => {
                                const isCorrect = optIdx === q.correctOptionIndex || opt === q.correctAnswer;
                                return (
                                  <View
                                    key={optIdx}
                                    style={[
                                      s.quizOptionRow,
                                      isCorrect && s.quizOptionCorrect,
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        s.quizOptionLetter,
                                        isCorrect && s.quizOptionLetterCorrect,
                                      ]}
                                    >
                                      {String.fromCharCode(65 + optIdx)}
                                    </Text>
                                    <Text
                                      style={[
                                        s.quizOptionText,
                                        isCorrect && s.quizOptionTextCorrect,
                                      ]}
                                    >
                                      {opt}
                                    </Text>
                                    {isCorrect && (
                                      <View style={s.correctBadge}>
                                        <Text style={s.correctBadgeText}>Correct</Text>
                                      </View>
                                    )}
                                  </View>
                                );
                              })}
                            </View>
                          )}
                          {q.explanation ? (
                            <View style={s.explanationBox}>
                              <Text style={s.explanationText}>
                                <Text style={{ fontWeight: '700' }}>Explanation: </Text>
                                {q.explanation}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  );
                })()}
              </ScrollView>
            )}

            {/* Modal Footer */}
            <View style={s.modalFooter}>
              <Pressable onPress={() => setShowPreviewModal(false)} style={s.modalCloseFooterBtn}>
                <Text style={s.modalCloseFooterBtnText}>Close</Text>
              </Pressable>

              <Pressable
                onPress={handleGoToCreationPage}
                style={[s.modalCreationBtn, isSavingQuiz && { opacity: 0.7 }]}
                disabled={isSavingQuiz}
              >
                {isSavingQuiz ? (
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 4 }} />
                ) : (
                  <ExternalLink size={13} color="#FFFFFF" strokeWidth={2.2} />
                )}
                <Text style={s.modalCreationBtnText}>
                  {isSavingQuiz
                    ? 'Saving to Library...'
                    : proposal.contentType === 'quiz'
                    ? 'Review in Quiz Manager'
                    : `Open in ${getDestinationName(proposal.contentType)}`}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginTop: Spacing.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    padding: Spacing.md,
    ...Shadow.sm,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  cancelCrossBtn: {
    padding: 3,
  },

  title: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
    lineHeight: 20,
  },

  summary: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },

  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#F8FAFD',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  chipLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  chipVal: {
    fontSize: 11,
    color: '#0F172A',
    fontWeight: '700',
  },

  detailBox: {
    marginTop: 2,
    marginBottom: 8,
    backgroundColor: '#F8FAFD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    overflow: 'hidden',
  },
  detailBoxHeading: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: '#E8ECF4',
    gap: 8,
  },
  detailRowLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    flex: 0,
    minWidth: 90,
  },
  detailRowVal: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
  },
  generateBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  cancelBtnText: {
    color: Colors.textMuted,
    fontSize: 12.5,
    fontWeight: '600',
  },

  // Tracker Box
  trackerBox: {
    marginTop: 6,
    padding: Spacing.sm,
    backgroundColor: '#F8FAFD',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    gap: 7,
  },
  trackerHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepIconWrap: {
    width: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotPending: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  stepLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  stepLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  stepLabelDone: {
    color: '#0F172A',
    fontWeight: '500',
  },

  // Completed Box
  completedBox: {
    marginTop: 8,
    padding: Spacing.sm,
    backgroundColor: '#F7FCF9',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#D4EFE3',
    gap: 6,
  },
  completedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completedTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: Colors.success,
  },
  resultName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },

  // Video Card
  videoCard: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  videoThumb: {
    width: 80,
    height: 52,
    borderRadius: 4,
    backgroundColor: '#1E293B',
  },
  videoPlaceholder: {
    width: 80,
    height: 52,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  videoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  videoBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D33F13',
  },
  videoTitle: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#1E293B',
    lineHeight: 15,
  },
  watchBtn: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  watchBtnText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '700',
  },

  previewExcerptBox: {
    marginTop: 4,
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  previewExcerptText: {
    fontSize: 11.5,
    color: Colors.textSecondary,
    lineHeight: 16,
  },

  previewMetaRow: {
    marginTop: 2,
  },
  previewMetaText: {
    fontSize: 11.5,
    color: Colors.textSecondary,
  },

  // Error Box
  errorBox: {
    marginTop: 6,
    padding: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  errorText: {
    fontSize: 11.5,
    color: Colors.error,
    fontWeight: '600',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.error,
    borderRadius: 4,
  },
  retryBtnText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  cancelledCard: {
    padding: 6,
    borderRadius: Radius.sm,
    backgroundColor: '#F3F4F6',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  cancelledText: {
    fontSize: 11,
    color: '#6B7280',
    fontStyle: 'italic',
  },

  // Completed Actions Row
  completedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  openPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
  },
  openPreviewBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  goToCreationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#EEF4FF',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#D4E2FC',
  },
  goToCreationBtnText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  regenerateBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  regenerateBtnSmallText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    ...Shadow.lg,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF4',
    backgroundColor: '#F8FAFD',
  },
  modalHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  modalHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  modalActionBtnText: {
    fontSize: 11.5,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: Radius.full,
    backgroundColor: '#F1F5F9',
  },
  modalLoadingWrap: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  modalLoadingText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: Spacing.base,
    gap: Spacing.md,
  },
  modalMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modalVideosSection: {
    gap: Spacing.sm,
  },
  modalVideosSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  modalVideosSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalVideoCard: {
    flexDirection: 'row',
    gap: 12,
    padding: Spacing.md,
    backgroundColor: '#FFF9F6',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#FFDEC9',
  },
  modalVideoThumb: {
    width: 120,
    height: 75,
    borderRadius: Radius.md,
    backgroundColor: '#1E293B',
  },
  modalVideoContent: {
    flex: 1,
    justifyContent: 'center',
    gap: 5,
  },
  modalVideoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 18,
  },
  modalWatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#D33F13',
    borderRadius: Radius.sm,
    marginTop: 2,
  },
  modalWatchBtnText: {
    fontSize: 11.5,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalSectionBox: {
    padding: Spacing.base,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    gap: 8,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalBodyText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 20,
  },
  modalSectionsWrap: {
    gap: Spacing.md,
  },
  modalTakeawaysBox: {
    padding: Spacing.base,
    backgroundColor: '#F7FCF9',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#D4EFE3',
    gap: 8,
  },
  modalTakeawaysHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalTakeawaysTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: Colors.success,
  },
  modalTakeawayItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  modalTakeawayText: {
    fontSize: 12.5,
    color: '#1E293B',
    lineHeight: 18,
    flex: 1,
  },
  outlineItem: {
    padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#E8ECF4',
    gap: 4,
  },
  outlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  outlineIndex: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 20,
  },
  outlineTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  outlineTime: {
    fontSize: 11,
    color: Colors.textMuted,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  outlineDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    paddingLeft: 28,
  },
  modalQuestionsWrap: {
    gap: 12,
  },
  modalQuizHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  yearsCoveredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  yearsCoveredLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  yearBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: '#EAF7F0',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  yearBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  pyqBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 4,
  },
  pyqBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#92400E',
  },
  quizQuestionCard: {
    padding: Spacing.base,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    gap: 8,
  },
  quizQuestionPrompt: {
    fontSize: 13.5,
    color: '#0F172A',
    lineHeight: 19,
  },
  quizOptionsWrap: {
    gap: 6,
    marginTop: 4,
  },
  quizOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: Radius.md,
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#E8ECF4',
    gap: 8,
  },
  quizOptionCorrect: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  quizOptionLetter: {
    width: 20,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  quizOptionLetterCorrect: {
    color: Colors.success,
  },
  quizOptionText: {
    fontSize: 12.5,
    color: Colors.text,
    flex: 1,
  },
  quizOptionTextCorrect: {
    color: '#166534',
    fontWeight: '600',
  },
  correctBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#DCFCE7',
    borderRadius: 4,
  },
  correctBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.success,
  },
  explanationBox: {
    marginTop: 4,
    padding: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  explanationText: {
    fontSize: 11.5,
    color: '#92400E',
    lineHeight: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E8ECF4',
    backgroundColor: '#F8FAFD',
  },
  modalCloseFooterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  modalCloseFooterBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  modalCreationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
  },
  modalCreationBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
