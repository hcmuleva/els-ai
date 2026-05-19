import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { API_BASE_URL, useAuth } from '../../src/context/AuthContext';
import { AudioManager } from '../../src/utils/audio';

type QuestionItem = {
  id: string;
  quiz_id: string;
  quiz_title: string;
  class_level?: string;
  subject?: string;
  quiz_type: string;
  question_type: string;
  question_title?: string;
  question_instruction?: string;
  question_audio?: string;
  time_limit_seconds: number;
  points: number;
  sort_order?: number;
  question_data: unknown;
  created_at: string;
};

type QuestionEditorMode = 'choice' | 'drag_drop' | 'custom';

type SupportedQuestionType =
  | 'guess_image'
  | 'drag_drop_match'
  | 'guess_audio'
  | 'true_false'
  | 'single_choice'
  | 'multi_choice';

type OptionDraft = {
  id: string;
  image: string;
  imageLabel: string;
  imageAssetId: string;
  audio: string;
  audioLabel: string;
  audioAssetId: string;
  label: string;
  isCorrect: boolean;
};

type MatchPairDraft = {
  id: string;
  itemLabel: string;
  targetLabel: string;
  image: string;
  imageLabel: string;
  imageAssetId: string;
  audio: string;
  audioLabel: string;
  audioAssetId: string;
};

type QuestionDraft = {
  classLevel: string;
  subject: string;
  questionTitle: string;
  questionInstruction: string;
  questionType: string;
  mainImage: string;
  mainImageLabel: string;
  mainImageAssetId: string;
  mainAudio: string;
  mainAudioLabel: string;
  mainAudioAssetId: string;
  points: string;
  timeLimitSeconds: string;
  sortOrder: string;
  options: OptionDraft[];
  matchPairs: MatchPairDraft[];
  rawQuestionData: unknown;
};

type MediaRemovalRequest =
  | { scope: 'question'; mode: 'create' | 'edit'; mediaType: 'image' | 'audio' }
  | { scope: 'option'; mode: 'create' | 'edit'; index: number; mediaType: 'image' | 'audio' }
  | { scope: 'pair'; mode: 'create' | 'edit'; index: number; mediaType: 'image' | 'audio' };

type OptionRemovalRequest = { mode: 'create' | 'edit'; index: number };
type SelectorField = 'classLevel' | 'subject' | 'filterClassLevel' | 'filterSubject';

const QUESTION_TYPE_CHOICES: Array<{ value: SupportedQuestionType; label: string; description: string }> = [
  {
    value: 'guess_image',
    label: 'Guess the Image',
    description: 'Show a main image prompt and let students choose the correct image option.',
  },
  {
    value: 'drag_drop_match',
    label: 'Drag & Drop Match',
    description: 'Students drag each item and drop it on the correct matching target.',
  },
  {
    value: 'guess_audio',
    label: 'Guess the Audio',
    description: 'Play a main audio prompt and ask students to pick the correct option.',
  },
  {
    value: 'true_false',
    label: 'True / False',
    description: 'Students answer using exactly two options: True and False.',
  },
  {
    value: 'single_choice',
    label: 'Single Choice',
    description: 'Students pick exactly one correct answer from multiple options.',
  },
  {
    value: 'multi_choice',
    label: 'Multi Choice',
    description: 'Students select all correct options. Score is correct only when all are selected with no wrong picks.',
  },
];

const QUESTION_TYPE_LABELS: Record<string, string> = {
  guess_image: 'Guess the Image',
  drag_drop_match: 'Drag & Drop Match',
  guess_audio: 'Guess the Audio',
  true_false: 'True / False',
  single_choice: 'Single Choice',
  multi_choice: 'Multi Choice',
  image_select: 'Guess the Image',
  drag_drop: 'Drag & Drop Match',
  sound_match: 'Guess the Audio',
  memory_game: 'Multi Choice',
};

const QUESTION_TYPE_DEFAULT_INSTRUCTIONS: Record<SupportedQuestionType, string> = {
  guess_image: 'Look at the main image and choose the correct option.',
  drag_drop_match: 'Drag each item and drop it on the correct matching target.',
  guess_audio: 'Listen to the audio and choose the correct answer.',
  true_false: 'Read the statement carefully and choose True or False.',
  single_choice: 'Choose one correct option.',
  multi_choice: 'Select all correct options before submitting your answer.',
};

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const buildAutoId = (seed: string, fallbackPrefix: string, index: number) => {
  const slug = toSlug(seed);
  return `${slug || fallbackPrefix}_${index + 1}`;
};

const QUESTION_TYPE_ALIASES: Record<string, SupportedQuestionType> = {
  image_select: 'guess_image',
  drag_drop: 'drag_drop_match',
  sound_match: 'guess_audio',
  memory_game: 'multi_choice',
};

const normalizeQuestionType = (value: string): string => QUESTION_TYPE_ALIASES[value] || value;

const getDefaultInstructionByType = (questionType: string): string => {
  const normalized = normalizeQuestionType(questionType);
  return isSupportedQuestionType(normalized) ? QUESTION_TYPE_DEFAULT_INSTRUCTIONS[normalized] : '';
};

const isSupportedQuestionType = (value: unknown): value is SupportedQuestionType =>
  value === 'guess_image' ||
  value === 'drag_drop_match' ||
  value === 'guess_audio' ||
  value === 'true_false' ||
  value === 'single_choice' ||
  value === 'multi_choice';

const getQuestionEditorMode = (questionType: string): QuestionEditorMode => {
  const normalized = normalizeQuestionType(questionType);
  if (normalized === 'drag_drop_match') return 'drag_drop';
  if (
    normalized === 'guess_image' ||
    normalized === 'guess_audio' ||
    normalized === 'true_false' ||
    normalized === 'single_choice' ||
    normalized === 'multi_choice'
  ) {
    return 'choice';
  }
  return 'custom';
};

const getQuestionTypeLabel = (questionType: string) => {
  const normalized = normalizeQuestionType(questionType);
  if (isSupportedQuestionType(normalized)) {
    return QUESTION_TYPE_LABELS[normalized];
  }
  return QUESTION_TYPE_LABELS[questionType] || questionType || 'Custom';
};

const extractFileName = (source: string): string => {
  const trimmed = source.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:')) {
    const mime = trimmed.slice(5, trimmed.indexOf(';') > -1 ? trimmed.indexOf(';') : undefined).trim();
    const extension = mime.includes('/') ? mime.split('/')[1] : 'file';
    return `uploaded-file.${extension || 'file'}`;
  }
  try {
    const normalized = resolveMediaUrl(trimmed);
    const path = normalized.split('?')[0].split('#')[0];
    const segment = decodeURIComponent(path.substring(path.lastIndexOf('/') + 1));
    return segment || 'uploaded-file';
  } catch {
    return 'uploaded-file';
  }
};

const toMediaLabel = (source: string, fallback: string, explicitLabel?: string) => {
  if (explicitLabel?.trim()) return explicitLabel.trim();
  if (!source.trim()) return `No ${fallback} selected`;
  return extractFileName(source);
};

const makeEmptyMatchPair = (): MatchPairDraft => ({
  id: '',
  itemLabel: '',
  targetLabel: '',
  image: '',
  imageLabel: '',
  imageAssetId: '',
  audio: '',
  audioLabel: '',
  audioAssetId: '',
});

const makeEmptyOption = (): OptionDraft => ({
  id: '',
  image: '',
  imageLabel: '',
  imageAssetId: '',
  audio: '',
  audioLabel: '',
  audioAssetId: '',
  label: '',
  isCorrect: false,
});

const makeTrueFalseOptions = (): OptionDraft[] => [
  { ...makeEmptyOption(), id: 'true', label: 'True', isCorrect: true },
  { ...makeEmptyOption(), id: 'false', label: 'False', isCorrect: false },
];

const makeDefaultOptionsByType = (questionType: string): OptionDraft[] => {
  const normalized = normalizeQuestionType(questionType);
  if (normalized === 'true_false') return makeTrueFalseOptions();
  return [makeEmptyOption()];
};

const makeInitialDraft = (questionType: string = 'guess_image'): QuestionDraft => ({
  classLevel: '',
  subject: '',
  questionTitle: '',
  questionInstruction: getDefaultInstructionByType(questionType),
  questionType,
  mainImage: '',
  mainImageLabel: '',
  mainImageAssetId: '',
  mainAudio: '',
  mainAudioLabel: '',
  mainAudioAssetId: '',
  points: '10',
  timeLimitSeconds: '30',
  sortOrder: '',
  options: makeDefaultOptionsByType(questionType),
  matchPairs: [makeEmptyMatchPair()],
  rawQuestionData: {},
});

function questionDataToOptions(questionData: unknown): OptionDraft[] {
  if (!questionData || typeof questionData !== 'object' || Array.isArray(questionData)) {
    return [makeEmptyOption()];
  }

  const options = (questionData as Record<string, unknown>).options;
  if (!Array.isArray(options) || options.length === 0) {
    return [makeEmptyOption()];
  }

  return options.map((item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const optionRecord = item as Record<string, unknown>;
      return {
        id: typeof optionRecord.id === 'string' ? optionRecord.id : '',
        image: typeof optionRecord.image === 'string' ? optionRecord.image : '',
        imageLabel:
          typeof optionRecord.image === 'string'
            ? toMediaLabel(optionRecord.image, 'image')
            : '',
        imageAssetId: typeof optionRecord.image_asset_id === 'string' ? optionRecord.image_asset_id : '',
        audio: typeof optionRecord.audio === 'string' ? optionRecord.audio : '',
        audioLabel:
          typeof optionRecord.audio === 'string'
            ? toMediaLabel(optionRecord.audio, 'audio')
            : '',
        audioAssetId: typeof optionRecord.audio_asset_id === 'string' ? optionRecord.audio_asset_id : '',
        label: typeof optionRecord.label === 'string' ? optionRecord.label : '',
        isCorrect: Boolean(optionRecord.is_correct),
      };
    }
    return makeEmptyOption();
  });
}

function questionDataToMatchPairs(questionData: unknown): MatchPairDraft[] {
  if (!questionData || typeof questionData !== 'object' || Array.isArray(questionData)) {
    return [makeEmptyMatchPair()];
  }

  const data = questionData as Record<string, unknown>;
  const dragItems = Array.isArray(data.drag_items) ? data.drag_items : [];
  const dropTargets = Array.isArray(data.drop_targets) ? data.drop_targets : [];
  const matchRules = Array.isArray(data.match_rules) ? data.match_rules : [];

  if (dragItems.length === 0) {
    return [makeEmptyMatchPair()];
  }

  const dropTargetLabels = new Map<string, string>();
  for (const target of dropTargets) {
    if (target && typeof target === 'object' && !Array.isArray(target)) {
      const targetRecord = target as Record<string, unknown>;
      const id = typeof targetRecord.id === 'string' ? targetRecord.id : '';
      const label = typeof targetRecord.label === 'string' ? targetRecord.label : '';
      if (id) {
        dropTargetLabels.set(id, label);
      }
    }
  }

  const matchedTargetByDragId = new Map<string, string>();
  for (const rule of matchRules) {
    if (rule && typeof rule === 'object' && !Array.isArray(rule)) {
      const ruleRecord = rule as Record<string, unknown>;
      const dragId = typeof ruleRecord.drag_item_id === 'string' ? ruleRecord.drag_item_id : '';
      const targetId = typeof ruleRecord.drop_target_id === 'string' ? ruleRecord.drop_target_id : '';
      if (dragId && targetId) {
        matchedTargetByDragId.set(dragId, targetId);
      }
    }
  }

  const pairs: MatchPairDraft[] = [];
  for (const dragItem of dragItems) {
    if (dragItem && typeof dragItem === 'object' && !Array.isArray(dragItem)) {
      const dragRecord = dragItem as Record<string, unknown>;
      const id = typeof dragRecord.id === 'string' ? dragRecord.id : '';
      const itemLabel = typeof dragRecord.label === 'string' ? dragRecord.label : '';
      const image = typeof dragRecord.image === 'string' ? dragRecord.image : '';
      const imageAssetId = typeof dragRecord.image_asset_id === 'string' ? dragRecord.image_asset_id : '';
      const audio = typeof dragRecord.sound === 'string' ? dragRecord.sound : '';
      const audioAssetId =
        typeof dragRecord.sound_asset_id === 'string'
          ? dragRecord.sound_asset_id
          : typeof dragRecord.audio_asset_id === 'string'
            ? dragRecord.audio_asset_id
            : '';
      const targetId = matchedTargetByDragId.get(id) || id;
      const targetLabel = dropTargetLabels.get(targetId || '') || '';

      pairs.push({
        id,
        itemLabel,
        targetLabel: targetLabel || itemLabel,
        image,
        imageLabel: toMediaLabel(image, 'image'),
        imageAssetId,
        audio,
        audioLabel: toMediaLabel(audio, 'audio'),
        audioAssetId,
      });
    }
  }

  return pairs.length > 0 ? pairs : [makeEmptyMatchPair()];
}

function questionDataPromptAudio(questionData: unknown): string {
  if (!questionData || typeof questionData !== 'object' || Array.isArray(questionData)) {
    return '';
  }

  const promptAudio = (questionData as Record<string, unknown>).prompt_audio;
  return typeof promptAudio === 'string' ? promptAudio : '';
}

function questionDataPromptAudioAssetId(questionData: unknown): string {
  if (!questionData || typeof questionData !== 'object' || Array.isArray(questionData)) {
    return '';
  }
  const promptAudioAssetId = (questionData as Record<string, unknown>).prompt_audio_asset_id;
  return typeof promptAudioAssetId === 'string' ? promptAudioAssetId : '';
}

function questionDataPromptImage(questionData: unknown): string {
  if (!questionData || typeof questionData !== 'object' || Array.isArray(questionData)) {
    return '';
  }

  const promptImage = (questionData as Record<string, unknown>).prompt_image;
  return typeof promptImage === 'string' ? promptImage : '';
}

function questionDataPromptImageAssetId(questionData: unknown): string {
  if (!questionData || typeof questionData !== 'object' || Array.isArray(questionData)) {
    return '';
  }
  const promptImageAssetId = (questionData as Record<string, unknown>).prompt_image_asset_id;
  return typeof promptImageAssetId === 'string' ? promptImageAssetId : '';
}

function toPersistentMediaUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (!trimmed.includes('X-Amz-') && !trimmed.includes('x-amz-')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return trimmed;
  }
}

function draftToPayload(draft: QuestionDraft) {
  if (!draft.questionTitle.trim()) {
    throw new Error('Question title is required.');
  }
  if (!draft.questionType.trim()) {
    throw new Error('Question type is required.');
  }

  const points = Number(draft.points);
  const timeLimitSeconds = Number(draft.timeLimitSeconds);
  if (Number.isNaN(points) || Number.isNaN(timeLimitSeconds)) {
    throw new Error('Points and time limit must be valid numbers.');
  }

  const mode = getQuestionEditorMode(draft.questionType);
  const mainImage = toPersistentMediaUrl(draft.mainImage);
  const mainImageAssetId = draft.mainImageAssetId.trim();
  const mainAudio = toPersistentMediaUrl(draft.mainAudio);
  const mainAudioAssetId = draft.mainAudioAssetId.trim();
  let questionData: unknown = {};

  const normalizedType = normalizeQuestionType(draft.questionType.trim());

  if (mode === 'choice') {
    const preparedOptions = draft.options
      .map((option) => ({
        id: option.id.trim(),
        image: toPersistentMediaUrl(option.image),
        imageAssetId: option.imageAssetId.trim(),
        audio: toPersistentMediaUrl(option.audio),
        audioAssetId: option.audioAssetId.trim(),
        label: option.label.trim(),
        isCorrect: option.isCorrect,
      }))
      .filter((option) => option.id || option.image || option.audio || option.label);

    if (normalizedType === 'true_false') {
      if (preparedOptions.length !== 2) {
        throw new Error('True / False requires exactly 2 options.');
      }
    } else if (preparedOptions.length < 2) {
      throw new Error('Add at least 2 options.');
    }

    const correctOptionCount = preparedOptions.filter((option) => option.isCorrect).length;
    if (normalizedType === 'multi_choice') {
      if (correctOptionCount < 1) {
        throw new Error('Mark at least one correct option for Multi Choice.');
      }
    } else if (correctOptionCount !== 1) {
      throw new Error('Mark exactly one option as the correct answer.');
    }

    if (normalizedType === 'guess_image') {
      if (!mainImage) {
        throw new Error('Add main image for Guess the Image questions.');
      }
      preparedOptions.forEach((option, index) => {
        if (!option.image) {
          throw new Error(`Add an image for option ${index + 1}.`);
        }
      });
    }

    if (normalizedType === 'guess_audio' && !mainAudio) {
      throw new Error('Add main audio for Guess the Audio questions.');
    }

    const normalizedOptions = preparedOptions.map((option, index) => ({
      id: option.id || buildAutoId(option.label, 'option', index),
      image: option.image || undefined,
      image_asset_id: option.imageAssetId || undefined,
      audio: option.audio || undefined,
      audio_asset_id: option.audioAssetId || undefined,
      label: option.label || `Option ${index + 1}`,
      is_correct: option.isCorrect,
    }));

    questionData = {
      options: normalizedOptions,
      ...(normalizedType === 'guess_image' && mainImage ? { prompt_image: mainImage } : {}),
      ...(normalizedType === 'guess_image' && mainImageAssetId ? { prompt_image_asset_id: mainImageAssetId } : {}),
      ...(normalizedType === 'guess_audio' && mainAudio ? { prompt_audio: mainAudio } : {}),
      ...(normalizedType === 'guess_audio' && mainAudioAssetId ? { prompt_audio_asset_id: mainAudioAssetId } : {}),
      ...(normalizedType ? { variant: normalizedType } : {}),
    };
  } else if (mode === 'drag_drop') {
    const preparedPairs = draft.matchPairs
      .map((pair) => ({
        id: pair.id.trim(),
        itemLabel: pair.itemLabel.trim(),
        targetLabel: pair.targetLabel.trim(),
        image: toPersistentMediaUrl(pair.image),
        imageAssetId: pair.imageAssetId.trim(),
        audio: toPersistentMediaUrl(pair.audio),
        audioAssetId: pair.audioAssetId.trim(),
      }))
      .filter((pair) => pair.id || pair.itemLabel || pair.targetLabel || pair.image || pair.audio);

    if (preparedPairs.length === 0) {
      throw new Error('Add at least one match pair.');
    }

    const dragItems = preparedPairs.map((pair, index) => {
      if (!pair.image) {
        throw new Error(`Add an image for pair ${index + 1}.`);
      }
      const id = pair.id || buildAutoId(pair.itemLabel || pair.targetLabel, 'item', index);
      return {
        id,
        image: pair.image,
        image_asset_id: pair.imageAssetId || undefined,
        label: pair.itemLabel || `Item ${index + 1}`,
        ...(pair.audio ? { sound: pair.audio } : {}),
        ...(pair.audioAssetId ? { sound_asset_id: pair.audioAssetId } : {}),
      };
    });

    const dropTargets = preparedPairs.map((pair, index) => {
      const dragItemId = dragItems[index].id;
      return {
        id: dragItemId,
        label: pair.targetLabel || pair.itemLabel || `Target ${index + 1}`,
      };
    });

    const matchRules = dragItems.map((item) => ({
      drag_item_id: item.id,
      drop_target_id: item.id,
    }));

    questionData = {
      drag_items: dragItems,
      drop_targets: dropTargets,
      match_rules: matchRules,
    };
  } else {
    questionData = draft.rawQuestionData ?? {};
  }

  const payload: Record<string, unknown> = {
    classLevel: draft.classLevel.trim() || undefined,
    subject: draft.subject.trim() || undefined,
    questionTitle: draft.questionTitle.trim(),
    questionInstruction: draft.questionInstruction.trim() || undefined,
    questionType: normalizedType,
    questionAudio: normalizedType === 'guess_audio' ? mainAudio || undefined : undefined,
    points,
    timeLimitSeconds,
    questionData,
  };

  if (draft.sortOrder.trim()) {
    const sortOrder = Number(draft.sortOrder);
    if (!Number.isNaN(sortOrder)) {
      payload.sortOrder = sortOrder;
    }
  }

  return payload;
}

function resolveMediaUrl(url: string | undefined): string {
  if (!url) return '';
  if (url.startsWith('/media')) {
    return `${API_BASE_URL}${url}`;
  }
  return url;
}

type PickedFile = { dataUrl: string; fileName: string; mimeType: string };

function resolvePickedMediaKind(file: PickedFile): 'image' | 'audio' | null {
  const mimeType = file.mimeType.toLowerCase();
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';

  const fileName = file.fileName.toLowerCase();
  if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(fileName)) return 'image';
  if (/\.(mp3|wav|ogg|aac|m4a|flac)$/.test(fileName)) return 'audio';
  return null;
}

async function pickFileAsDataUrl(accept: string, unsupportedMessage: string): Promise<PickedFile> {
  if (Platform.OS !== 'web') {
    throw new Error(unsupportedMessage);
  }

  return await new Promise((resolve, reject) => {
    const doc = (globalThis as any).document;
    if (!doc) {
      reject(new Error('File picker is unavailable in this environment.'));
      return;
    }

    const input = doc.createElement('input');
    input.type = 'file';
    input.accept = accept;

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('No file selected.'));
        return;
      }

      const reader = new FileReader();
      reader.onload = () =>
        resolve({
          dataUrl: String(reader.result || ''),
          fileName: file.name || 'uploaded-file',
          mimeType: file.type || '',
        });
      reader.onerror = () => reject(new Error('Failed to read selected file.'));
      reader.readAsDataURL(file);
    };

    input.click();
  });
}

async function pickAudioAsDataUrl(): Promise<PickedFile> {
  return pickFileAsDataUrl('audio/*', 'Audio upload is currently available on web. On mobile, paste audio URL manually.');
}

async function pickImageAsDataUrl(): Promise<PickedFile> {
  return pickFileAsDataUrl('image/*', 'Image upload is currently available on web. On mobile, paste image URL manually.');
}

async function pickMediaAsDataUrl(): Promise<PickedFile> {
  return pickFileAsDataUrl(
    'image/*,audio/*',
    'Media upload is currently available on web. On mobile, paste media URL manually.',
  );
}

export default function QuestionManagementScreen() {
  const { user, apiFetch } = useAuth();
  const actionBadgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [actionBadge, setActionBadge] = useState<string | null>(null);
  const [pendingMediaRemoval, setPendingMediaRemoval] = useState<MediaRemovalRequest | null>(null);
  const [pendingOptionRemoval, setPendingOptionRemoval] = useState<OptionRemovalRequest | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [createDraft, setCreateDraft] = useState<QuestionDraft>(makeInitialDraft());
  const [editDraft, setEditDraft] = useState<QuestionDraft>(makeInitialDraft());
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectorField, setSelectorField] = useState<SelectorField | null>(null);
  const [previewQuestion, setPreviewQuestion] = useState<QuestionItem | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    classLevel: '',
    subject: '',
    category: '',
  });

  const isTeacherView = user?.activeRole === 'teacher' || user?.activeRole === 'admin' || user?.activeRole === 'superadmin';
  const classOptions = useMemo(
    () =>
      [...new Set(questions.map((question) => (question.class_level || '').trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [questions],
  );
  const subjectOptions = useMemo(
    () =>
      [...new Set(questions.map((question) => (question.subject || '').trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [questions],
  );

  const showActionBadge = useCallback((text: string) => {
    setActionBadge(text);
    if (actionBadgeTimerRef.current) {
      clearTimeout(actionBadgeTimerRef.current);
    }
    actionBadgeTimerRef.current = setTimeout(() => {
      setActionBadge(null);
    }, 1800);
  }, []);

  useEffect(() => {
    return () => {
      if (actionBadgeTimerRef.current) {
        clearTimeout(actionBadgeTimerRef.current);
      }
    };
  }, []);

  const loadQuestions = useCallback(async () => {
    const query = new URLSearchParams();
    query.set('limit', '100');
    if (filters.search.trim()) query.set('search', filters.search.trim());
    if (filters.classLevel.trim()) query.set('class_level', filters.classLevel.trim());
    if (filters.subject.trim()) query.set('subject', filters.subject.trim());
    if (filters.category.trim()) query.set('category', filters.category.trim());

    const res = await apiFetch(`/quizzes/questions?${query.toString()}`);
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload.message || 'Failed to load question list');
    }
    const payload = await res.json();
    setQuestions(payload.questions || []);
  }, [apiFetch, filters.category, filters.classLevel, filters.search, filters.subject]);

  const loadData = useCallback(async () => {
    if (!isTeacherView) return;
    setLoading(true);
    setMessage(null);
    try {
      await loadQuestions();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to load question management data' });
    } finally {
      setLoading(false);
    }
  }, [isTeacherView, loadQuestions]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const updateDraftField = (mode: 'create' | 'edit', key: keyof QuestionDraft, value: any) => {
    if (mode === 'create') {
      setCreateDraft((current) => ({ ...current, [key]: value }));
    } else {
      setEditDraft((current) => ({ ...current, [key]: value }));
    }
  };

  const setQuestionType = (questionType: SupportedQuestionType) => {
    setCreateDraft((current) => ({
      ...current,
      questionType,
      questionInstruction: getDefaultInstructionByType(questionType),
      mainImage: questionType === 'guess_image' ? current.mainImage : '',
      mainImageLabel: questionType === 'guess_image' ? current.mainImageLabel : '',
      mainImageAssetId: questionType === 'guess_image' ? current.mainImageAssetId : '',
      mainAudio: questionType === 'guess_audio' ? current.mainAudio : '',
      mainAudioLabel: questionType === 'guess_audio' ? current.mainAudioLabel : '',
      mainAudioAssetId: questionType === 'guess_audio' ? current.mainAudioAssetId : '',
      options: makeDefaultOptionsByType(questionType),
    }));
  };

  const uploadPickedFileToS3 = async (picked: PickedFile, mediaType: 'image' | 'audio') => {
    const res = await apiFetch('/assets/upload', {
      method: 'POST',
      body: JSON.stringify({
        dataUrl: picked.dataUrl,
        fileName: picked.fileName,
        mimeType: picked.mimeType,
        mediaType,
        context: 'question_management',
      }),
    });

    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload.message || 'Failed to upload media');
    }

    const payload = await res.json();
    return {
      url: String(payload.url || ''),
      canonicalUrl: String(payload.canonicalUrl || ''),
      assetId: String(payload.assetId || ''),
      fileName: String(payload.fileName || picked.fileName || 'uploaded-file'),
    };
  };

  const uploadAudioForQuestion = async (mode: 'create' | 'edit') => {
    try {
      const picked = await pickAudioAsDataUrl();
      const uploaded = await uploadPickedFileToS3(picked, 'audio');
      updateDraftField(mode, 'mainAudio', uploaded.url);
      updateDraftField(mode, 'mainAudioLabel', uploaded.fileName);
      updateDraftField(mode, 'mainAudioAssetId', uploaded.assetId);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to upload audio' });
    }
  };

  const uploadImageForQuestion = async (mode: 'create' | 'edit') => {
    try {
      const picked = await pickImageAsDataUrl();
      const uploaded = await uploadPickedFileToS3(picked, 'image');
      updateDraftField(mode, 'mainImage', uploaded.url);
      updateDraftField(mode, 'mainImageLabel', uploaded.fileName);
      updateDraftField(mode, 'mainImageAssetId', uploaded.assetId);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to upload image' });
    }
  };

  const clearQuestionImage = (mode: 'create' | 'edit') => {
    updateDraftField(mode, 'mainImage', '');
    updateDraftField(mode, 'mainImageLabel', '');
    updateDraftField(mode, 'mainImageAssetId', '');
  };

  const clearQuestionAudio = (mode: 'create' | 'edit') => {
    updateDraftField(mode, 'mainAudio', '');
    updateDraftField(mode, 'mainAudioLabel', '');
    updateDraftField(mode, 'mainAudioAssetId', '');
  };

  const playAudioPreview = async (audioUrl: string) => {
    const url = audioUrl.trim();
    if (!url) {
      setMessage({ type: 'error', text: 'Add or upload an audio URL before preview.' });
      return;
    }
    try {
      await AudioManager.playSound(resolveMediaUrl(url));
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to play audio preview' });
    }
  };

  const updateOption = (mode: 'create' | 'edit', index: number, patch: Partial<OptionDraft>) => {
    const updater = (options: OptionDraft[]) =>
      options.map((option, optionIndex) => (optionIndex === index ? { ...option, ...patch } : option));
    if (mode === 'create') {
      setCreateDraft((current) => ({ ...current, options: updater(current.options) }));
    } else {
      setEditDraft((current) => ({ ...current, options: updater(current.options) }));
    }
  };

  const setCorrectOption = (mode: 'create' | 'edit', index: number) => {
    const activeType = normalizeQuestionType((mode === 'create' ? createDraft : editDraft).questionType);
    const updater = (options: OptionDraft[]) => {
      if (activeType === 'multi_choice') {
        return options.map((option, optionIndex) =>
          optionIndex === index ? { ...option, isCorrect: !option.isCorrect } : option,
        );
      }
      return options.map((option, optionIndex) => ({ ...option, isCorrect: optionIndex === index }));
    };
    if (mode === 'create') {
      setCreateDraft((current) => ({ ...current, options: updater(current.options) }));
    } else {
      setEditDraft((current) => ({ ...current, options: updater(current.options) }));
    }
  };

  const addOption = (mode: 'create' | 'edit') => {
    const activeDraft = mode === 'create' ? createDraft : editDraft;
    if (normalizeQuestionType(activeDraft.questionType) === 'true_false') {
      setMessage({ type: 'error', text: 'True / False always has exactly two options.' });
      return;
    }
    if (mode === 'create') {
      setCreateDraft((current) => ({ ...current, options: [makeEmptyOption(), ...current.options] }));
    } else {
      setEditDraft((current) => ({ ...current, options: [makeEmptyOption(), ...current.options] }));
    }
    showActionBadge('Option added');
  };

  const removeOption = (mode: 'create' | 'edit', index: number) => {
    const activeDraft = mode === 'create' ? createDraft : editDraft;
    if (normalizeQuestionType(activeDraft.questionType) === 'true_false') {
      setMessage({ type: 'error', text: 'True / False requires both True and False options.' });
      return;
    }
    if (mode === 'create') {
      setCreateDraft((current) => {
        const remaining = current.options.filter((_, optionIndex) => optionIndex !== index);
        return { ...current, options: remaining.length ? remaining : [makeEmptyOption()] };
      });
    } else {
      setEditDraft((current) => {
        const remaining = current.options.filter((_, optionIndex) => optionIndex !== index);
        return { ...current, options: remaining.length ? remaining : [makeEmptyOption()] };
      });
    }
  };

  const uploadMediaForOption = async (mode: 'create' | 'edit', index: number) => {
    try {
      const picked = await pickMediaAsDataUrl();
      const mediaType = resolvePickedMediaKind(picked);
      if (mediaType === 'image') {
        const uploaded = await uploadPickedFileToS3(picked, 'image');
        updateOption(mode, index, { image: uploaded.url, imageLabel: uploaded.fileName, imageAssetId: uploaded.assetId });
        return;
      }
      if (mediaType === 'audio') {
        const uploaded = await uploadPickedFileToS3(picked, 'audio');
        updateOption(mode, index, { audio: uploaded.url, audioLabel: uploaded.fileName, audioAssetId: uploaded.assetId });
        return;
      }
      setMessage({ type: 'error', text: 'Unsupported media type. Please upload image or audio.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to upload media' });
    }
  };

  const clearOptionMedia = (mode: 'create' | 'edit', index: number, mediaType: 'image' | 'audio') => {
    if (mediaType === 'image') {
      updateOption(mode, index, { image: '', imageLabel: '', imageAssetId: '' });
      return;
    }
    updateOption(mode, index, { audio: '', audioLabel: '', audioAssetId: '' });
  };

  const updateMatchPair = (mode: 'create' | 'edit', index: number, patch: Partial<MatchPairDraft>) => {
    const updater = (pairs: MatchPairDraft[]) =>
      pairs.map((pair, pairIndex) => (pairIndex === index ? { ...pair, ...patch } : pair));
    if (mode === 'create') {
      setCreateDraft((current) => ({ ...current, matchPairs: updater(current.matchPairs) }));
    } else {
      setEditDraft((current) => ({ ...current, matchPairs: updater(current.matchPairs) }));
    }
  };

  const addMatchPair = (mode: 'create' | 'edit') => {
    if (mode === 'create') {
      setCreateDraft((current) => ({ ...current, matchPairs: [...current.matchPairs, makeEmptyMatchPair()] }));
    } else {
      setEditDraft((current) => ({ ...current, matchPairs: [...current.matchPairs, makeEmptyMatchPair()] }));
    }
  };

  const removeMatchPair = (mode: 'create' | 'edit', index: number) => {
    if (mode === 'create') {
      setCreateDraft((current) => {
        const remaining = current.matchPairs.filter((_, pairIndex) => pairIndex !== index);
        return { ...current, matchPairs: remaining.length ? remaining : [makeEmptyMatchPair()] };
      });
    } else {
      setEditDraft((current) => {
        const remaining = current.matchPairs.filter((_, pairIndex) => pairIndex !== index);
        return { ...current, matchPairs: remaining.length ? remaining : [makeEmptyMatchPair()] };
      });
    }
  };

  const uploadMediaForMatchPair = async (mode: 'create' | 'edit', index: number) => {
    try {
      const picked = await pickMediaAsDataUrl();
      const mediaType = resolvePickedMediaKind(picked);
      if (mediaType === 'image') {
        const uploaded = await uploadPickedFileToS3(picked, 'image');
        updateMatchPair(mode, index, { image: uploaded.url, imageLabel: uploaded.fileName, imageAssetId: uploaded.assetId });
        return;
      }
      if (mediaType === 'audio') {
        const uploaded = await uploadPickedFileToS3(picked, 'audio');
        updateMatchPair(mode, index, { audio: uploaded.url, audioLabel: uploaded.fileName, audioAssetId: uploaded.assetId });
        return;
      }
      setMessage({ type: 'error', text: 'Unsupported media type. Please upload image or audio.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to upload media' });
    }
  };

  const clearPairMedia = (mode: 'create' | 'edit', index: number, mediaType: 'image' | 'audio') => {
    if (mediaType === 'image') {
      updateMatchPair(mode, index, { image: '', imageLabel: '', imageAssetId: '' });
      return;
    }
    updateMatchPair(mode, index, { audio: '', audioLabel: '', audioAssetId: '' });
  };

  const requestMediaRemoval = (request: MediaRemovalRequest) => {
    setPendingMediaRemoval(request);
  };

  const confirmMediaRemoval = () => {
    if (!pendingMediaRemoval) return;

    if (pendingMediaRemoval.scope === 'question') {
      if (pendingMediaRemoval.mediaType === 'image') {
        clearQuestionImage(pendingMediaRemoval.mode);
      } else {
        clearQuestionAudio(pendingMediaRemoval.mode);
      }
    } else if (pendingMediaRemoval.scope === 'option') {
      clearOptionMedia(pendingMediaRemoval.mode, pendingMediaRemoval.index, pendingMediaRemoval.mediaType);
    } else {
      clearPairMedia(pendingMediaRemoval.mode, pendingMediaRemoval.index, pendingMediaRemoval.mediaType);
    }

    showActionBadge(`${pendingMediaRemoval.mediaType === 'image' ? 'Image' : 'Audio'} removed`);
    setPendingMediaRemoval(null);
  };

  const requestOptionRemoval = (request: OptionRemovalRequest) => {
    setPendingOptionRemoval(request);
  };

  const confirmOptionRemoval = () => {
    if (!pendingOptionRemoval) return;
    removeOption(pendingOptionRemoval.mode, pendingOptionRemoval.index);
    showActionBadge('Option removed');
    setPendingOptionRemoval(null);
  };

  const openCreateDialog = () => {
    setCreateDraft(makeInitialDraft('guess_image'));
    setActionBadge(null);
    setIsCreateDialogOpen(true);
    setMessage(null);
  };

  const openEditDialog = (question: QuestionItem) => {
    const resolvedMainImage = questionDataPromptImage(question.question_data);
    const resolvedMainImageAssetId = questionDataPromptImageAssetId(question.question_data);
    const resolvedMainAudio = question.question_audio || questionDataPromptAudio(question.question_data);
    const resolvedMainAudioAssetId = questionDataPromptAudioAssetId(question.question_data);
    const normalizedType = normalizeQuestionType(question.question_type || 'guess_image');
    const parsedOptions = questionDataToOptions(question.question_data);
    const resolvedOptions =
      normalizeQuestionType(normalizedType) === 'true_false' && parsedOptions.every((item) => !item.id && !item.label && !item.image && !item.audio)
        ? makeTrueFalseOptions()
        : parsedOptions;
    setEditingQuestionId(question.id);
    setEditDraft({
      classLevel: question.class_level || '',
      subject: question.subject || '',
      questionTitle: question.question_title || '',
      questionInstruction: question.question_instruction || getDefaultInstructionByType(normalizedType),
      questionType: normalizedType,
      mainImage: resolvedMainImage,
      mainImageLabel: toMediaLabel(resolvedMainImage, 'image'),
      mainImageAssetId: resolvedMainImageAssetId,
      mainAudio: resolvedMainAudio,
      mainAudioLabel: toMediaLabel(resolvedMainAudio, 'audio'),
      mainAudioAssetId: resolvedMainAudioAssetId,
      points: String(question.points ?? 10),
      timeLimitSeconds: String(question.time_limit_seconds ?? 30),
      sortOrder: question.sort_order !== undefined && question.sort_order !== null ? String(question.sort_order) : '',
      options: resolvedOptions,
      matchPairs: questionDataToMatchPairs(question.question_data),
      rawQuestionData: question.question_data || {},
    });
    setActionBadge(null);
    setMessage(null);
  };

  const createQuestion = async () => {
    setCreating(true);
    setMessage(null);
    try {
      const payload = draftToPayload(createDraft);
      const res = await apiFetch('/quizzes/questions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to create question');
      }
      setIsCreateDialogOpen(false);
      setCreateDraft(makeInitialDraft('guess_image'));
      setMessage({ type: 'success', text: 'Question created successfully.' });
      await loadQuestions();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to create question' });
    } finally {
      setCreating(false);
    }
  };

  const saveQuestion = async () => {
    if (!editingQuestionId) return;
    setSavingQuestionId(editingQuestionId);
    setMessage(null);
    try {
      const payload = draftToPayload(editDraft);
      const res = await apiFetch(`/quizzes/questions/${editingQuestionId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to update question');
      }
      setEditingQuestionId(null);
      setMessage({ type: 'success', text: 'Question updated successfully.' });
      await loadQuestions();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to update question' });
    } finally {
      setSavingQuestionId(null);
    }
  };

  const deleteQuestion = async (questionId: string) => {
    setDeletingQuestionId(questionId);
    setMessage(null);
    try {
      const res = await apiFetch(`/quizzes/questions/${questionId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to delete question');
      }
      if (editingQuestionId === questionId) {
        setEditingQuestionId(null);
      }
      setMessage({ type: 'success', text: 'Question deleted successfully.' });
      await loadQuestions();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to delete question' });
    } finally {
      setDeletingQuestionId(null);
    }
  };

  const applySelectorValue = (value: string) => {
    if (selectorField === 'filterClassLevel') {
      setFilters((current) => ({ ...current, classLevel: value }));
    } else if (selectorField === 'filterSubject') {
      setFilters((current) => ({ ...current, subject: value }));
    } else if (selectorField === 'classLevel') {
      if (editingQuestionId) {
        setEditDraft((current) => ({ ...current, classLevel: value }));
      } else {
        setCreateDraft((current) => ({ ...current, classLevel: value }));
      }
    } else if (selectorField === 'subject') {
      if (editingQuestionId) {
        setEditDraft((current) => ({ ...current, subject: value }));
      } else {
        setCreateDraft((current) => ({ ...current, subject: value }));
      }
    }
    setSelectorField(null);
  };

  const selectorOptions =
    selectorField === 'classLevel' || selectorField === 'filterClassLevel' ? classOptions : subjectOptions;
  const selectorTitle =
    selectorField === 'classLevel' || selectorField === 'filterClassLevel' ? 'Select Standard' : 'Select Subject';

  if (!isTeacherView) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Question Management</Text>
        <Text style={styles.errorText}>You do not have permission to manage questions.</Text>
      </ScrollView>
    );
  }

  const renderDialogContent = (mode: 'create' | 'edit') => {
    const draft = mode === 'create' ? createDraft : editDraft;
    const normalizedQuestionType = normalizeQuestionType(draft.questionType);
    const dialogTitle = mode === 'create' ? 'Create Question' : 'Edit Question';
    const saveAction = mode === 'create' ? createQuestion : saveQuestion;
    const isSaving = mode === 'create' ? creating : savingQuestionId !== null;
    const closeAction = () => {
      setActionBadge(null);
      mode === 'create' ? setIsCreateDialogOpen(false) : setEditingQuestionId(null);
    };
    const editorMode = getQuestionEditorMode(draft.questionType);
    const selectedTypeChoice = QUESTION_TYPE_CHOICES.find((choice) => choice.value === draft.questionType);

    return (
      <View style={styles.dialogCard}>
        <View style={styles.dialogHeader}>
          <Text style={styles.dialogTitle}>{dialogTitle}</Text>
          {mode === 'edit' ? (
            <View style={styles.readonlyTag}>
              <Text style={styles.readonlyTagText}>{getQuestionTypeLabel(draft.questionType)}</Text>
            </View>
          ) : null}
        </View>
        {actionBadge ? (
          <View style={styles.actionBadge}>
            <Text style={styles.actionBadgeText}>{actionBadge}</Text>
          </View>
        ) : null}
        <ScrollView style={styles.dialogScroll} contentContainerStyle={styles.dialogScrollContent}>
          {mode === 'create' ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Question Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.typeChipRow}>
                  {QUESTION_TYPE_CHOICES.map((choice) => {
                    const selected = draft.questionType === choice.value;
                    return (
                      <Pressable
                        key={choice.value}
                        style={[styles.typeChip, selected && styles.typeChipActive]}
                        onPress={() => setQuestionType(choice.value)}
                      >
                        <Text style={[styles.typeChipText, selected && styles.typeChipTextActive]}>{choice.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
              {selectedTypeChoice ? <Text style={styles.metaText}>{selectedTypeChoice.description}</Text> : null}
            </View>
          ) : null}
          {editorMode === 'custom' ? (
            <Text style={styles.errorText}>
              This question type is not supported in this visual form yet.
            </Text>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Question Title</Text>
            <TextInput
              value={draft.questionTitle}
              onChangeText={(value) => updateDraftField(mode, 'questionTitle', value)}
              placeholder="Enter question title"
              style={styles.input}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Instruction for Students (Optional)</Text>
            <TextInput
              value={draft.questionInstruction}
              onChangeText={(value) => updateDraftField(mode, 'questionInstruction', value)}
              placeholder="Example: Listen and choose the correct animal"
              style={styles.input}
              multiline
            />
          </View>

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.fieldLabel}>Standard</Text>
              <Pressable style={styles.selectorInput} onPress={() => setSelectorField('classLevel')}>
                <Text style={draft.classLevel ? styles.selectorText : styles.selectorPlaceholder}>
                  {draft.classLevel || 'Select standard'}
                </Text>
              </Pressable>
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.fieldLabel}>Subject</Text>
              <Pressable style={styles.selectorInput} onPress={() => setSelectorField('subject')}>
                <Text style={draft.subject ? styles.selectorText : styles.selectorPlaceholder}>
                  {draft.subject || 'Select subject'}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.fieldLabel}>Points</Text>
              <TextInput
                value={draft.points}
                onChangeText={(value) => updateDraftField(mode, 'points', value)}
                placeholder="10"
                style={styles.input}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.fieldLabel}>Time Limit (seconds)</Text>
              <TextInput
                value={draft.timeLimitSeconds}
                onChangeText={(value) => updateDraftField(mode, 'timeLimitSeconds', value)}
                placeholder="30"
                style={styles.input}
                keyboardType="numeric"
              />
            </View>
          </View>

          {normalizedQuestionType === 'guess_image' ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Main Image (Required)</Text>
              <View style={styles.mediaActionRow}>
                <Pressable style={[styles.secondaryButton, styles.mediaActionButton]} onPress={() => uploadImageForQuestion(mode)}>
                  <Text style={styles.secondaryButtonText}>Upload Image</Text>
                </Pressable>
              </View>
              {draft.mainImage.trim() ? (
                <View style={styles.previewCard}>
                  <View style={styles.previewHeader}>
                    <View style={styles.previewHeaderContent}>
                      <Text style={styles.mediaInfoLabel}>Selected Image</Text>
                      <Text style={styles.mediaInfoValue}>{toMediaLabel(draft.mainImage, 'image', draft.mainImageLabel)}</Text>
                    </View>
                    <Pressable
                      style={styles.previewRemoveButton}
                      onPress={() => requestMediaRemoval({ scope: 'question', mode, mediaType: 'image' })}
                    >
                      <Text style={styles.previewRemoveButtonText}>Remove</Text>
                    </Pressable>
                  </View>
                  <Image source={{ uri: resolveMediaUrl(draft.mainImage.trim()) }} style={styles.optionImagePreview} resizeMode="contain" />
                </View>
              ) : null}
            </View>
          ) : null}

          {normalizedQuestionType === 'guess_audio' ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Main Audio (Required)</Text>
              <View style={styles.mediaActionRow}>
                <Pressable style={[styles.secondaryButton, styles.mediaActionButton]} onPress={() => uploadAudioForQuestion(mode)}>
                  <Text style={styles.secondaryButtonText}>Upload Audio</Text>
                </Pressable>
              </View>
              {draft.mainAudio.trim() ? (
                <View style={styles.audioPreviewCard}>
                  <View style={styles.previewHeader}>
                    <View style={styles.previewHeaderContent}>
                      <Text style={styles.mediaInfoLabel}>Selected Audio</Text>
                      <Text style={styles.mediaInfoValue}>{toMediaLabel(draft.mainAudio, 'audio', draft.mainAudioLabel)}</Text>
                    </View>
                    <Pressable
                      style={styles.previewRemoveButton}
                      onPress={() => requestMediaRemoval({ scope: 'question', mode, mediaType: 'audio' })}
                    >
                      <Text style={styles.previewRemoveButtonText}>Remove</Text>
                    </Pressable>
                  </View>
                  <Pressable style={[styles.secondaryButton, styles.playButton]} onPress={() => playAudioPreview(draft.mainAudio)}>
                    <Text style={styles.secondaryButtonText}>Play Audio</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}

          {editorMode === 'choice' ? (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Answer Options</Text>
                {normalizedQuestionType === 'true_false' ? null : (
                  <Pressable style={styles.smallButton} onPress={() => addOption(mode)}>
                    <Text style={styles.smallButtonText}>+ Add Option</Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.metaText}>
                {normalizedQuestionType === 'multi_choice'
                  ? 'Mark all correct options.'
                  : 'Mark exactly one option as the correct answer.'}
              </Text>

              {draft.options.map((option, index) => (
                <View key={`${mode}-option-${index}`} style={styles.optionCard}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.optionTitle}>Option {index + 1}</Text>
                    {normalizedQuestionType === 'true_false' ? null : (
                      <Pressable style={styles.inlineRemoveButton} onPress={() => requestOptionRemoval({ mode, index })}>
                        <Text style={styles.inlineRemoveButtonText}>Remove Option</Text>
                      </Pressable>
                    )}
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Option Label</Text>
                    <TextInput
                      value={option.label}
                      onChangeText={(value) => updateOption(mode, index, { label: value })}
                      placeholder="Example: Lion"
                      style={styles.input}
                    />
                  </View>

                  <View style={styles.mediaActionRow}>
                    <Pressable style={[styles.secondaryButton, styles.mediaActionButton]} onPress={() => uploadMediaForOption(mode, index)}>
                      <Text style={styles.secondaryButtonText}>
                        {normalizedQuestionType === 'guess_image'
                          ? 'Upload Option Image'
                          : normalizedQuestionType === 'guess_audio'
                            ? 'Upload Option Audio / Image'
                            : 'Upload Option Image / Audio'}
                      </Text>
                    </Pressable>
                  </View>

                  {option.image.trim() ? (
                    <View style={styles.previewCard}>
                      <View style={styles.previewHeader}>
                        <View style={styles.previewHeaderContent}>
                          <Text style={styles.mediaInfoLabel}>Image</Text>
                          <Text style={styles.mediaInfoValue}>{toMediaLabel(option.image, 'image', option.imageLabel)}</Text>
                        </View>
                        <Pressable
                          style={styles.previewRemoveButton}
                          onPress={() => requestMediaRemoval({ scope: 'option', mode, index, mediaType: 'image' })}
                        >
                          <Text style={styles.previewRemoveButtonText}>Remove</Text>
                        </Pressable>
                      </View>
                      <Image source={{ uri: resolveMediaUrl(option.image.trim()) }} style={styles.optionImagePreview} resizeMode="contain" />
                    </View>
                  ) : null}

                  {option.audio.trim() ? (
                    <View style={styles.audioPreviewCard}>
                      <View style={styles.previewHeader}>
                        <View style={styles.previewHeaderContent}>
                          <Text style={styles.mediaInfoLabel}>Audio</Text>
                          <Text style={styles.mediaInfoValue}>{toMediaLabel(option.audio, 'audio', option.audioLabel)}</Text>
                        </View>
                        <Pressable
                          style={styles.previewRemoveButton}
                          onPress={() => requestMediaRemoval({ scope: 'option', mode, index, mediaType: 'audio' })}
                        >
                          <Text style={styles.previewRemoveButtonText}>Remove</Text>
                        </Pressable>
                      </View>
                      <Pressable style={[styles.secondaryButton, styles.playButton]} onPress={() => playAudioPreview(option.audio)}>
                        <Text style={styles.secondaryButtonText}>Play Option Audio</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  <Pressable
                    style={[option.isCorrect ? styles.primaryButton : styles.secondaryButton, styles.fullWidthButton]}
                    onPress={() => setCorrectOption(mode, index)}
                  >
                    <Text style={option.isCorrect ? styles.primaryButtonText : styles.secondaryButtonText}>
                      {normalizedQuestionType === 'multi_choice'
                        ? option.isCorrect
                          ? 'Marked Correct'
                          : 'Mark Correct'
                        : option.isCorrect
                          ? 'Correct Answer'
                          : 'Mark as Correct'}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </>
          ) : null}

          {editorMode === 'drag_drop' ? (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Match Pairs</Text>
                <Pressable style={styles.smallButton} onPress={() => addMatchPair(mode)}>
                  <Text style={styles.smallButtonText}>+ Add Pair</Text>
                </Pressable>
              </View>
              <Text style={styles.metaText}>Each pair creates one draggable item and one matching target.</Text>

              {draft.matchPairs.map((pair, index) => (
                <View key={`${mode}-pair-${index}`} style={styles.optionCard}>
                  <Text style={styles.optionTitle}>Pair {index + 1}</Text>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Draggable Item Name</Text>
                    <TextInput
                      value={pair.itemLabel}
                      onChangeText={(value) => updateMatchPair(mode, index, { itemLabel: value })}
                      placeholder="Example: Lion"
                      style={styles.input}
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Matching Target Label</Text>
                    <TextInput
                      value={pair.targetLabel}
                      onChangeText={(value) => updateMatchPair(mode, index, { targetLabel: value })}
                      placeholder="Example: Den (Forest)"
                      style={styles.input}
                    />
                  </View>

                  <View style={styles.mediaActionRow}>
                    <Pressable style={[styles.secondaryButton, styles.mediaActionButton]} onPress={() => uploadMediaForMatchPair(mode, index)}>
                      <Text style={styles.secondaryButtonText}>Upload Image / Audio</Text>
                    </Pressable>
                  </View>

                  {pair.image.trim() ? (
                    <View style={styles.previewCard}>
                      <View style={styles.previewHeader}>
                        <View style={styles.previewHeaderContent}>
                          <Text style={styles.mediaInfoLabel}>Image</Text>
                          <Text style={styles.mediaInfoValue}>{toMediaLabel(pair.image, 'image', pair.imageLabel)}</Text>
                        </View>
                        <Pressable
                          style={styles.previewRemoveButton}
                          onPress={() => requestMediaRemoval({ scope: 'pair', mode, index, mediaType: 'image' })}
                        >
                          <Text style={styles.previewRemoveButtonText}>Remove</Text>
                        </Pressable>
                      </View>
                      <Image source={{ uri: resolveMediaUrl(pair.image.trim()) }} style={styles.optionImagePreview} resizeMode="contain" />
                    </View>
                  ) : null}

                  {pair.audio.trim() ? (
                    <View style={styles.audioPreviewCard}>
                      <View style={styles.previewHeader}>
                        <View style={styles.previewHeaderContent}>
                          <Text style={styles.mediaInfoLabel}>Audio</Text>
                          <Text style={styles.mediaInfoValue}>{toMediaLabel(pair.audio, 'audio', pair.audioLabel)}</Text>
                        </View>
                        <Pressable
                          style={styles.previewRemoveButton}
                          onPress={() => requestMediaRemoval({ scope: 'pair', mode, index, mediaType: 'audio' })}
                        >
                          <Text style={styles.previewRemoveButtonText}>Remove</Text>
                        </Pressable>
                      </View>
                      <Pressable style={[styles.secondaryButton, styles.playButton]} onPress={() => playAudioPreview(pair.audio)}>
                        <Text style={styles.secondaryButtonText}>Play Item Audio</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  <View style={styles.row}>
                    <Pressable style={[styles.actionDangerButton, styles.fullWidthButton]} onPress={() => removeMatchPair(mode, index)}>
                      <Text style={styles.deleteButtonText}>Remove Pair</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
        <View style={styles.dialogActions}>
          <Pressable style={[styles.secondaryButton, styles.halfInput]} onPress={closeAction}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
          <Pressable style={[styles.primaryButton, styles.halfInput]} onPress={saveAction} disabled={isSaving}>
            {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Save</Text>}
          </Pressable>
        </View>
      </View>
    );
  };

  const removalAssetLabel = pendingMediaRemoval?.mediaType === 'image' ? 'image' : 'audio';
  const removalScopeLabel =
    pendingMediaRemoval?.scope === 'question'
      ? 'this question'
      : pendingMediaRemoval?.scope === 'option'
        ? 'this option'
        : pendingMediaRemoval?.scope === 'pair'
          ? 'this match pair'
          : 'this item';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Question Management</Text>
      <Text style={styles.subtitle}>Create and edit questions with type-based forms and media preview.</Text>

      {message && (
        <View style={[styles.messageCard, message.type === 'success' ? styles.successCard : styles.errorCard]}>
          <Text style={[styles.messageText, message.type === 'success' ? styles.successText : styles.errorText]}>
            {message.text}
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Filters</Text>
        <TextInput
          value={filters.search}
          onChangeText={(value) => setFilters((current) => ({ ...current, search: value }))}
          placeholder="Search question/quiz title"
          style={styles.input}
        />
        <View style={styles.row}>
          <Pressable style={[styles.selectorInput, styles.halfInput]} onPress={() => setSelectorField('filterClassLevel')}>
            <Text style={filters.classLevel ? styles.selectorText : styles.selectorPlaceholder}>
              {filters.classLevel || 'Standard'}
            </Text>
          </Pressable>
          <Pressable style={[styles.selectorInput, styles.halfInput]} onPress={() => setSelectorField('filterSubject')}>
            <Text style={filters.subject ? styles.selectorText : styles.selectorPlaceholder}>
              {filters.subject || 'Subject'}
            </Text>
          </Pressable>
        </View>
        <TextInput
          value={filters.category}
          onChangeText={(value) => setFilters((current) => ({ ...current, category: value }))}
          placeholder="Question type"
          style={styles.input}
        />
        <View style={styles.row}>
          <Pressable style={[styles.secondaryButton, styles.halfInput]} onPress={loadData} disabled={loading}>
            {loading ? <ActivityIndicator color="#1d4ed8" /> : <Text style={styles.secondaryButtonText}>Apply Filters</Text>}
          </Pressable>
          <Pressable style={[styles.primaryButton, styles.halfInput]} onPress={openCreateDialog}>
            <Text style={styles.primaryButtonText}>Create Question</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Questions Table ({questions.length})</Text>
        {loading ? (
          <ActivityIndicator size="small" color="#1d4ed8" />
        ) : questions.length === 0 ? (
          <Text style={styles.emptyText}>No questions found.</Text>
        ) : (
          <ScrollView horizontal>
            <View>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableCell, styles.colStandard]}>Standard</Text>
                <Text style={[styles.tableCell, styles.colSubject]}>Subject</Text>
                <Text style={[styles.tableCell, styles.colCategory]}>Question Type</Text>
                <Text style={[styles.tableCell, styles.colQuestion]}>Question</Text>
                <Text style={[styles.tableCell, styles.colActions]}>Actions</Text>
              </View>
              {questions.map((question) => (
                <View key={question.id} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.colStandard]}>{question.class_level || '-'}</Text>
                  <Text style={[styles.tableCell, styles.colSubject]}>{question.subject || '-'}</Text>
                  <Text style={[styles.tableCell, styles.colCategory]}>{getQuestionTypeLabel(question.question_type)}</Text>
                  <Text style={[styles.tableCell, styles.colQuestion]} numberOfLines={2}>
                    {question.question_title || 'Untitled'}
                  </Text>
                  <View style={[styles.colActions, styles.actionsRow]}>
                    <Pressable style={styles.actionButton} onPress={() => setPreviewQuestion(question)}>
                      <Text style={styles.actionButtonText}>View</Text>
                    </Pressable>
                    <Pressable style={styles.actionButton} onPress={() => openEditDialog(question)}>
                      <Text style={styles.actionButtonText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => deleteQuestion(question.id)}
                      disabled={deletingQuestionId === question.id}
                    >
                      {deletingQuestionId === question.id ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      <Modal visible={isCreateDialogOpen} transparent animationType="fade" onRequestClose={() => setIsCreateDialogOpen(false)}>
        <View style={styles.dialogOverlay}>{renderDialogContent('create')}</View>
      </Modal>

      <Modal visible={editingQuestionId !== null} transparent animationType="fade" onRequestClose={() => setEditingQuestionId(null)}>
        <View style={styles.dialogOverlay}>{renderDialogContent('edit')}</View>
      </Modal>

      <Modal visible={selectorField !== null} transparent animationType="fade" onRequestClose={() => setSelectorField(null)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>{selectorTitle}</Text>
            <ScrollView style={styles.selectorList}>
              <Pressable style={styles.selectorOption} onPress={() => applySelectorValue('')}>
                <Text style={styles.selectorOptionText}>Any</Text>
              </Pressable>
              {selectorOptions.map((option) => (
                <Pressable key={option} style={styles.selectorOption} onPress={() => applySelectorValue(option)}>
                  <Text style={styles.selectorOptionText}>{option}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.secondaryButton} onPress={() => setSelectorField(null)}>
              <Text style={styles.secondaryButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={previewQuestion !== null} transparent animationType="fade" onRequestClose={() => setPreviewQuestion(null)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Question Preview</Text>
            {previewQuestion ? (
              <ScrollView style={styles.selectorList}>
                <Text style={styles.previewTitle}>{previewQuestion.question_title || 'Untitled question'}</Text>
                <Text style={styles.previewMeta}>
                  {previewQuestion.class_level || '-'} • {previewQuestion.subject || '-'} •{' '}
                  {getQuestionTypeLabel(previewQuestion.question_type)}
                </Text>
                {previewQuestion.question_instruction ? (
                  <Text style={styles.previewInstruction}>{previewQuestion.question_instruction}</Text>
                ) : null}
                <Text style={styles.previewMeta}>Points: {previewQuestion.points}</Text>
                <Text style={styles.previewMeta}>Time: {previewQuestion.time_limit_seconds}s</Text>

                {questionDataPromptImage(previewQuestion.question_data).trim() ? (
                  <View style={styles.previewMediaCard}>
                    <Text style={styles.previewMediaLabel}>Prompt Image</Text>
                    <Image
                      source={{ uri: resolveMediaUrl(questionDataPromptImage(previewQuestion.question_data).trim()) }}
                      style={styles.previewImage}
                      resizeMode="contain"
                    />
                  </View>
                ) : null}

                {questionDataToOptions(previewQuestion.question_data)
                  .filter((option) => option.image.trim())
                  .map((option, index) => (
                    <View key={`preview-option-${index}`} style={styles.previewMediaCard}>
                      <Text style={styles.previewMediaLabel}>Option {index + 1}: {option.label || 'Untitled'}</Text>
                      <Image source={{ uri: resolveMediaUrl(option.image.trim()) }} style={styles.previewImage} resizeMode="contain" />
                    </View>
                  ))}

                {questionDataToMatchPairs(previewQuestion.question_data)
                  .filter((pair) => pair.image.trim())
                  .map((pair, index) => (
                    <View key={`preview-pair-${index}`} style={styles.previewMediaCard}>
                      <Text style={styles.previewMediaLabel}>
                        Pair {index + 1}: {pair.itemLabel || 'Item'} → {pair.targetLabel || 'Target'}
                      </Text>
                      <Image source={{ uri: resolveMediaUrl(pair.image.trim()) }} style={styles.previewImage} resizeMode="contain" />
                    </View>
                  ))}
              </ScrollView>
            ) : null}
            <Pressable style={styles.primaryButton} onPress={() => setPreviewQuestion(null)}>
              <Text style={styles.primaryButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={pendingMediaRemoval !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingMediaRemoval(null)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Remove {removalAssetLabel}?</Text>
            <Text style={styles.confirmMessage}>
              This will remove the selected {removalAssetLabel} from {removalScopeLabel}. You can upload it again anytime.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable style={[styles.secondaryButton, styles.halfInput]} onPress={() => setPendingMediaRemoval(null)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.actionDangerButton, styles.halfInput]} onPress={confirmMediaRemoval}>
                <Text style={styles.deleteButtonText}>Remove</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={pendingOptionRemoval !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingOptionRemoval(null)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Remove option?</Text>
            <Text style={styles.confirmMessage}>
              This will remove the full option from this question.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable style={[styles.secondaryButton, styles.halfInput]} onPress={() => setPendingOptionRemoval(null)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.actionDangerButton, styles.halfInput]} onPress={confirmOptionRemoval}>
                <Text style={styles.deleteButtonText}>Remove</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#475569',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  fieldGroup: {
    gap: 6,
  },
  readonlyTag: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  readonlyTagText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '700',
  },
  mediaInfoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
  mediaInfoValue: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  selectorInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  selectorPlaceholder: {
    color: '#94a3b8',
    fontSize: 13,
  },
  selectorText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  mediaActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mediaActionButton: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  halfInput: {
    flex: 1,
  },
  fullWidthButton: {
    width: '100%',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    paddingVertical: 9,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 12,
  },
  disabledButton: {
    opacity: 0.55,
  },
  primaryButton: {
    borderRadius: 10,
    backgroundColor: '#1d4ed8',
    paddingVertical: 9,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  messageCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  successCard: {
    backgroundColor: '#ecfdf5',
    borderColor: '#86efac',
  },
  errorCard: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  messageText: {
    fontSize: 12,
    fontWeight: '600',
  },
  successText: {
    color: '#166534',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 12,
    color: '#64748b',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    alignItems: 'center',
    minHeight: 48,
  },
  tableHeader: {
    backgroundColor: '#f1f5f9',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  tableCell: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#334155',
  },
  colStandard: {
    width: 120,
  },
  colSubject: {
    width: 140,
  },
  colCategory: {
    width: 130,
  },
  colQuestion: {
    width: 260,
  },
  colActions: {
    width: 240,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  actionButton: {
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  deleteButton: {
    borderColor: '#fca5a5',
    backgroundColor: '#fee2e2',
  },
  deleteButtonText: {
    color: '#b91c1c',
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    padding: 16,
    justifyContent: 'center',
  },
  dialogCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxHeight: '90%',
    overflow: 'hidden',
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 6,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  actionBadge: {
    alignSelf: 'flex-start',
    marginHorizontal: 14,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#86efac',
    backgroundColor: '#ecfdf5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  actionBadgeText: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '700',
  },
  dialogScroll: {
    maxHeight: 520,
  },
  dialogScrollContent: {
    padding: 14,
    gap: 10,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 8,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  confirmCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 10,
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  confirmMessage: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  selectorList: {
    maxHeight: 320,
  },
  selectorOption: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  selectorOptionText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '600',
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  previewMeta: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 4,
  },
  previewInstruction: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 8,
    lineHeight: 18,
  },
  previewMediaCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
    gap: 6,
    backgroundColor: '#f8fafc',
  },
  previewMediaLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  previewImage: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  quizChipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  quizChip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quizChipActive: {
    borderColor: '#60a5fa',
    backgroundColor: '#dbeafe',
  },
  quizChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  quizChipTextActive: {
    color: '#1d4ed8',
  },
  typeChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  typeChipActive: {
    borderColor: '#60a5fa',
    backgroundColor: '#dbeafe',
  },
  typeChipText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  typeChipTextActive: {
    color: '#1d4ed8',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  smallButton: {
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  smallButtonText: {
    fontSize: 11,
    color: '#1d4ed8',
    fontWeight: '700',
  },
  optionCard: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fbff',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  inlineRemoveButton: {
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  inlineRemoveButtonText: {
    fontSize: 11,
    color: '#b91c1c',
    fontWeight: '700',
  },
  optionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e3a8a',
  },
  previewCard: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 8,
    gap: 6,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  previewHeaderContent: {
    flex: 1,
    gap: 2,
  },
  previewRemoveButton: {
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  previewRemoveButtonText: {
    fontSize: 11,
    color: '#b91c1c',
    fontWeight: '700',
  },
  audioPreviewCard: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 8,
    gap: 8,
  },
  playButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
  },
  optionImagePreview: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  actionDangerButton: {
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#64748b',
  },
});
