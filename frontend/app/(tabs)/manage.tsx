import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
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
import { WebView } from 'react-native-webview';

import { FolderOpen, Video, HelpCircle, BookOpen as BookOpenIcon, Trophy as TrophyIcon, ListChecks, SplitSquareHorizontal, Eye as EyeIcon, Volume2, CheckSquare, Image as ImageIcon } from 'lucide-react-native';
import SelectorModal from '../../src/components/SelectorModal';
import { STANDARD_OPTIONS, getStandardLabel } from '../../src/constants/standards';
import { API_BASE_URL, useAuth } from '../../src/context/AuthContext';
import { AudioManager } from '../../src/utils/audio';
import TopicsTab from '../../src/components/manage/TopicsTab';
import ContentTab from '../../src/components/manage/ContentTab';
import QuestionsTab from '../../src/components/manage/QuestionsTab';
import { frameButtons } from '../modules/logicopiccolo/generated/buttons';

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

type QuestionEditorMode = 'choice' | 'drag_drop' | 'logico' | 'custom';

type SupportedQuestionType =
  | 'guess_image'
  | 'drag_drop_match'
  | 'guess_audio'
  | 'true_false'
  | 'single_choice'
  | 'multi_choice'
  | 'logico';

type OptionDraft = {
  id: string;
  slotPosition: number;
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
type LearningTab = 'topic' | 'content' | 'question' | 'exam' | 'quiz';
type ContentModeTab = 'create' | 'assign';
type ContentSelectorField =
  | 'contentFilterClassLevel'
  | 'contentFilterSubject'
  | 'topicClassLevel'
  | 'topicSubject'
  | 'assignTargetClassLevel'
  | 'assignTargetSubject'
  | 'quizFilterClassLevel'
  | 'quizFilterSubject';

type SubjectCatalogItem = {
  id: string;
  title: string;
  classLevel: string;
  coverImage?: string;
};

type ContentTopic = {
  id: string;
  classLevel: string;
  subject: string;
  title: string;
  coverImage?: string;
  sectionCount: number;
};

type TopicContentSection = {
  id: string;
  sectionOrder: number;
  title?: string;
  contentType: 'reel' | 'image' | 'text' | 'audio' | 'youtube_url' | 'reel_url';
  mediaUrl?: string;
  externalUrl?: string;
  textContent?: string;
};

type LearningContentItem = {
  id: string;
  classLevel: string;
  subject: string;
  title: string;
  contentType: string;
  sectionCount?: number;
  mediaUrl?: string;
  externalUrl?: string;
  textContent?: string;
  sections?: TopicContentSection[];
  assignedTopics?: Array<{ topicId: string; title: string; classLevel: string; subject: string }>;
};

type QuizItem = {
  id: string;
  title: string;
  quiz_type: string;
  class_level: string;
  subject: string;
  is_published: boolean;
  total_questions: number;
  created_at: string;
};
type QuizCatalogItem = {
  classLevel: string;
  subject: string;
};

type TopicDraft = {
  title: string;
  classLevel: string;
  subject: string;
  coverImage: string;
};

type TopicSectionDraft = {
  id: string;
  title?: string;
  contentType: 'reel' | 'image' | 'text' | 'audio' | 'youtube_url' | 'reel_url';
  mediaUrl: string;
  mediaLabel: string;
  externalUrl: string;
  textContent: string;
};

const CONTENT_TYPE_CHOICES: Array<{ value: TopicSectionDraft['contentType']; label: string }> = [
  { value: 'reel', label: 'Reel (Video Upload)' },
  { value: 'image', label: 'Image Upload' },
  { value: 'text', label: 'Text' },
  { value: 'audio', label: 'Audio Upload' },
  { value: 'youtube_url', label: 'Youtube URL' },
  { value: 'reel_url', label: 'Reel URL' },
];
const CREATE_CONTENT_TYPE_CHOICES: Array<{ value: 'media' | 'text' | 'youtube_url' | 'reel_url'; label: string }> = [
  { value: 'media', label: 'Media Upload' },
  { value: 'text', label: 'Text' },
  { value: 'youtube_url', label: 'Youtube URL' },
  { value: 'reel_url', label: 'Reel URL' },
];

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
  {
    value: 'logico',
    label: 'Logico',
    description: 'Upload a worksheet image and map each Logico button to slot positions 1 to 10.',
  },
];

const QUESTION_TYPE_LABELS: Record<string, string> = {
  guess_image: 'Guess the Image',
  drag_drop_match: 'Drag & Drop Match',
  guess_audio: 'Guess the Audio',
  true_false: 'True / False',
  single_choice: 'Single Choice',
  multi_choice: 'Multi Choice',
  logico: 'Logico',
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
  logico: 'Match each Logico button with the correct option position from top to bottom.',
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
  value === 'multi_choice' ||
  value === 'logico';

const getQuestionEditorMode = (questionType: string): QuestionEditorMode => {
  const normalized = normalizeQuestionType(questionType);
  if (normalized === 'logico') return 'logico';
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

const LOGICO_BUTTON_ORDER = frameButtons.map((button) => button.id);
const LOGICO_BUTTON_COLOR_MAP = Object.fromEntries(frameButtons.map((button) => [button.id, button.color]));

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
  slotPosition: 1,
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
  { ...makeEmptyOption(), id: 'true', slotPosition: 1, label: 'True', isCorrect: true },
  { ...makeEmptyOption(), id: 'false', slotPosition: 2, label: 'False', isCorrect: false },
];

const makeLogicoOptions = (): OptionDraft[] =>
  LOGICO_BUTTON_ORDER.map((buttonId, index) => ({
    ...makeEmptyOption(),
    id: buttonId,
    slotPosition: index + 1,
    label: '',
    isCorrect: true,
  }));

const makeDefaultOptionsByType = (questionType: string): OptionDraft[] => {
  const normalized = normalizeQuestionType(questionType);
  if (normalized === 'true_false') return makeTrueFalseOptions();
  if (normalized === 'logico') return makeLogicoOptions();
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

const makeInitialTopicDraft = (): TopicDraft => ({
  title: '',
  classLevel: '',
  subject: '',
  coverImage: '',
});

const buildClientId = () => `section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const makeEmptyTopicSection = (): TopicSectionDraft => ({
  id: buildClientId(),
  title: '',
  contentType: 'text',
  mediaUrl: '',
  mediaLabel: '',
  externalUrl: '',
  textContent: '',
});

const isMediaContentType = (contentType: TopicSectionDraft['contentType']) =>
  contentType === 'image' || contentType === 'audio' || contentType === 'reel';

const getCreateSectionChoiceValue = (contentType: TopicSectionDraft['contentType']) =>
  isMediaContentType(contentType) ? 'media' : contentType;

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
      const rawSlotPosition = Number(optionRecord.slot_position);
      return {
        id: typeof optionRecord.id === 'string' ? optionRecord.id : '',
        slotPosition: Number.isInteger(rawSlotPosition) && rawSlotPosition > 0 ? rawSlotPosition : 1,
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

function questionDataToLogicoOptions(questionData: unknown): OptionDraft[] {
  if (!questionData || typeof questionData !== 'object' || Array.isArray(questionData)) {
    return makeLogicoOptions();
  }

  const data = questionData as Record<string, unknown>;
  const buttonSlotMapRaw = data.button_slot_map;
  const optionSlotsRaw = data.option_slots;

  const buttonSlotMap: Record<string, number> =
    buttonSlotMapRaw && typeof buttonSlotMapRaw === 'object' && !Array.isArray(buttonSlotMapRaw)
      ? Object.fromEntries(
          Object.entries(buttonSlotMapRaw).map(([buttonId, slot]) => [buttonId, Number(slot)]).filter(([, slot]) => Number.isInteger(slot)),
        )
      : {};

  const optionSlotLabelById = new Map<number, string>();
  if (Array.isArray(optionSlotsRaw)) {
    optionSlotsRaw.forEach((slot) => {
      if (!slot || typeof slot !== 'object' || Array.isArray(slot)) return;
      const record = slot as Record<string, unknown>;
      const slotId = Number(record.id);
      if (!Number.isInteger(slotId)) return;
      optionSlotLabelById.set(slotId, typeof record.value === 'string' ? record.value : '');
    });
  }

  return LOGICO_BUTTON_ORDER.map((buttonId, index) => {
    const slotPosition = buttonSlotMap[buttonId];
    const safeSlot = Number.isInteger(slotPosition) && slotPosition >= 1 && slotPosition <= 10 ? slotPosition : index + 1;
    return {
      ...makeEmptyOption(),
      id: buttonId,
      slotPosition: safeSlot,
      label: optionSlotLabelById.get(safeSlot) ?? '',
      isCorrect: true,
    };
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

const normalizeLogicoButtonId = (id: string) => id.trim().toLowerCase();

const getLogicoButtonColor = (buttonId: string) => {
  const normalized = normalizeLogicoButtonId(buttonId);
  return LOGICO_BUTTON_COLOR_MAP[normalized] || '#4b5563';
};

const isRingButton = (buttonId: string) => normalizeLogicoButtonId(buttonId).includes('-ring');

function LogicoButtonBadge({ buttonId, size = 26 }: { buttonId: string; size?: number }) {
  const color = getLogicoButtonColor(buttonId);
  return (
    <View
      style={[
        qFormS.logicoButtonCircle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
      ]}
    >
      {isRingButton(buttonId) ? (
        <View
          style={[
            qFormS.logicoButtonRingInner,
            { width: size * 0.44, height: size * 0.44, borderRadius: (size * 0.44) / 2 },
          ]}
        />
      ) : null}
    </View>
  );
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
        slotPosition: Number(option.slotPosition),
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
      slot_position: option.slotPosition || index + 1,
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
  } else if (mode === 'logico') {
    if (!mainImage) {
      throw new Error('Add worksheet image for Logico questions.');
    }

    const mappings = draft.options.map((option, index) => ({
      buttonId: normalizeLogicoButtonId(option.id || LOGICO_BUTTON_ORDER[index] || ''),
      slotPosition: Number(option.slotPosition),
      label: option.label.trim(),
    }));

    if (mappings.some((item) => !item.buttonId)) {
      throw new Error('Each Logico button mapping must have a valid button id.');
    }
    if (mappings.length !== LOGICO_BUTTON_ORDER.length) {
      throw new Error('Logico questions require mapping for all 10 buttons.');
    }
    if (mappings.some((item) => !Number.isInteger(item.slotPosition) || item.slotPosition < 1 || item.slotPosition > 10)) {
      throw new Error('Each Logico button must be mapped to a position from 1 to 10.');
    }

    const uniqueSlots = new Set(mappings.map((item) => item.slotPosition));
    if (uniqueSlots.size !== 10) {
      throw new Error('Logico button positions must be unique (1 to 10).');
    }

    const buttonSlotMap = Object.fromEntries(mappings.map((item) => [item.buttonId, item.slotPosition]));
    const optionSlots = Array.from({ length: 10 }, (_, index) => {
      const slotId = index + 1;
      const mapped = mappings.find((item) => item.slotPosition === slotId);
      return {
        id: slotId,
        value: mapped?.label || '',
      };
    });

    questionData = {
      variant: 'logico',
      prompt_image: mainImage,
      ...(mainImageAssetId ? { prompt_image_asset_id: mainImageAssetId } : {}),
      button_slot_map: buttonSlotMap,
      option_slots: optionSlots,
      logico_buttons: LOGICO_BUTTON_ORDER,
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

  if (questionData && typeof questionData === 'object' && !Array.isArray(questionData)) {
    const rawMeta =
      draft.rawQuestionData &&
      typeof draft.rawQuestionData === 'object' &&
      !Array.isArray(draft.rawQuestionData) &&
      '_meta' in (draft.rawQuestionData as Record<string, unknown>)
        ? (draft.rawQuestionData as Record<string, unknown>)._meta
        : undefined;
    const existingMeta =
      rawMeta && typeof rawMeta === 'object' && !Array.isArray(rawMeta) ? (rawMeta as Record<string, unknown>) : {};
    const classLevel = draft.classLevel.trim();
    const subject = draft.subject.trim();
    questionData = {
      ...(questionData as Record<string, unknown>),
      _meta: {
        ...existingMeta,
        classLevel: classLevel || null,
        subject: subject || null,
      },
    };
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

function SafeImage({ uri, style, resizeMode = 'contain' }: { uri: string; style?: any; resizeMode?: any }) {
  const [error, setError] = useState(false);
  if (!uri || error) {
    return (
      <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F4FB', overflow: 'hidden' }]}>
        <ImageIcon size={24} color="#9A9AB0" />
      </View>
    );
  }
  return (
    <Image 
      source={{ uri }} 
      style={style} 
      resizeMode={resizeMode} 
      onError={() => setError(true)}
    />
  );
}

function getYouTubeEmbedUrl(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return `https://www.youtube.com/embed/${m[1]}?rel=0&playsinline=1`;
  }
  return null;
}

function isVideoContentType(type: string): boolean {
  return ['video', 'youtube_url', 'youtube', 'video_url'].includes(type.toLowerCase());
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
  const router = useRouter();
  const actionBadgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [questionFormTab, setQuestionFormTab] = useState<'setup' | 'options' | 'preview'>('setup');
  const [actionBadge, setActionBadge] = useState<string | null>(null);
  const [pendingMediaRemoval, setPendingMediaRemoval] = useState<MediaRemovalRequest | null>(null);
  const [pendingOptionRemoval, setPendingOptionRemoval] = useState<OptionRemovalRequest | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [createDraft, setCreateDraft] = useState<QuestionDraft>(makeInitialDraft());
  const [editDraft, setEditDraft] = useState<QuestionDraft>(makeInitialDraft());
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectorField, setSelectorField] = useState<SelectorField | null>(null);
  const [activeLearningTab, setActiveLearningTab] = useState<LearningTab>('topic');
  const [contentModeTab, setContentModeTab] = useState<ContentModeTab>('create');
  const [contentSelectorField, setContentSelectorField] = useState<ContentSelectorField | null>(null);
  const [contentFilters, setContentFilters] = useState({ classLevel: '', subject: '' });
  const [subjectCatalog, setSubjectCatalog] = useState<SubjectCatalogItem[]>([]);
  const [topics, setTopics] = useState<ContentTopic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [topicDraft, setTopicDraft] = useState<TopicDraft>(makeInitialTopicDraft());
  const [topicDialogMode, setTopicDialogMode] = useState<'create' | 'edit' | null>(null);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [savingTopic, setSavingTopic] = useState(false);
  const [deletingTopicId, setDeletingTopicId] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<ContentTopic | null>(null);
  const [topicActionMenuTopic, setTopicActionMenuTopic] = useState<ContentTopic | null>(null);
  const [topicContentActionItem, setTopicContentActionItem] = useState<LearningContentItem | null>(null);
  const [contentLibraryActionItem, setContentLibraryActionItem] = useState<LearningContentItem | null>(null);
  const [topicSections, setTopicSections] = useState<TopicContentSection[]>([]);
  const [topicContentItems, setTopicContentItems] = useState<LearningContentItem[]>([]);
  const [loadingTopicDetails, setLoadingTopicDetails] = useState(false);
  const [isSectionDialogOpen, setIsSectionDialogOpen] = useState(false);
  const [sectionDrafts, setSectionDrafts] = useState<TopicSectionDraft[]>([makeEmptyTopicSection()]);
  const [savingSections, setSavingSections] = useState(false);
  const [uploadingTopicCover, setUploadingTopicCover] = useState(false);
  const [uploadingSectionMediaId, setUploadingSectionMediaId] = useState<string | null>(null);
  const [contentCreateSections, setContentCreateSections] = useState<TopicSectionDraft[]>([makeEmptyTopicSection()]);
  const [contentCreateMeta, setContentCreateMeta] = useState({ classLevel: '', subject: '', topicId: '', title: '' });
  const [isCreateContentDialogOpen, setIsCreateContentDialogOpen] = useState(false);
  const [editingContentId, setEditingContentId] = useState<string | null>(null);
  const [previewContentItem, setPreviewContentItem] = useState<LearningContentItem | null>(null);
  const [savingContentCreate, setSavingContentCreate] = useState(false);
  const [deletingContentId, setDeletingContentId] = useState<string | null>(null);
  const [loadingContentItems, setLoadingContentItems] = useState(false);
  const [contentItems, setContentItems] = useState<LearningContentItem[]>([]);
  const [topicPage, setTopicPage] =   useState(0);
  const [contentPage, setContentPage] = useState(0);
  const [questionPage, setQuestionPage] = useState(0);
  const [topicContentPage, setTopicContentPage] = useState(0);
  const renderPagination = (
    currentPage: number,
    totalItems: number,
    pageSize: number,
    onPageChange: (newPage: number) => void
  ) => {
    const totalPages = Math.ceil(totalItems / pageSize);
    if (totalPages <= 1) return null;

    return (
      <View style={styles.paginationRow}>
        <Pressable
          style={[styles.paginationButton, currentPage === 0 && styles.paginationButtonDisabled]}
          onPress={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 0}
        >
          <Text style={[styles.paginationButtonText, currentPage === 0 && styles.paginationButtonTextDisabled]}>
            Previous
          </Text>
        </Pressable>
        <Text style={styles.paginationText}>
          Page {currentPage + 1} of {totalPages}
        </Text>
        <Pressable
          style={[styles.paginationButton, currentPage >= totalPages - 1 && styles.paginationButtonDisabled]}
          onPress={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
        >
          <Text style={[styles.paginationButtonText, currentPage >= totalPages - 1 && styles.paginationButtonTextDisabled]}>
            Next
          </Text>
        </Pressable>
      </View>
    );
  };
  const [contentItemFilters, setContentItemFilters] = useState({ classLevel: '', subject: '', topicId: '' });
  const [selectedAssignContentIds, setSelectedAssignContentIds] = useState<string[]>([]);
  const [assignTargetTopicId, setAssignTargetTopicId] = useState('');
  const [createTopicSearch, setCreateTopicSearch] = useState('');
  const [assignTopicFilters, setAssignTopicFilters] = useState({ classLevel: '', subject: '', search: '' });
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [topicQuizzes, setTopicQuizzes] = useState<QuizItem[]>([]);
  const [allOrgQuizzes, setAllOrgQuizzes] = useState<QuizItem[]>([]);
  const [quizCatalogItems, setQuizCatalogItems] = useState<QuizCatalogItem[]>([]);
  const [loadingTopicQuizzes, setLoadingTopicQuizzes] = useState(false);
  const [isQuizDialogOpen, setIsQuizDialogOpen] = useState(false);
  const [quizDialogFilters, setQuizDialogFilters] = useState({ classLevel: '', subject: '', search: '' });
  const [selectedQuizIds, setSelectedQuizIds] = useState<string[]>([]);
  const [savingQuizSelections, setSavingQuizSelections] = useState(false);
  const [previewQuiz, setPreviewQuiz] = useState<QuizItem | null>(null);
  const [questionActionItem, setQuestionActionItem] = useState<QuestionItem | null>(null);
  const [previewQuestion, setPreviewQuestion] = useState<QuestionItem | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    classLevel: '',
    subject: '',
    category: '',
  });

  const isTeacherView = user?.activeRole === 'teacher' || user?.activeRole === 'admin' || user?.activeRole === 'superadmin';
  const classOptions = useMemo(() => STANDARD_OPTIONS.map((item) => item.value), []);
  const contentClassOptions = useMemo(
    () => STANDARD_OPTIONS.map((item) => item.value),
    [],
  );
  const contentSubjectOptions = useMemo(() => {
    const filtered = subjectCatalog.filter(
      (item) => !contentFilters.classLevel || item.classLevel.trim() === contentFilters.classLevel.trim(),
    );
    return [...new Set(filtered.map((item) => item.title.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [contentFilters.classLevel, subjectCatalog]);
  const createContentTopicOptions = useMemo(
    () =>
      topics
        .filter(
          (topic) =>
            (!contentCreateMeta.classLevel || topic.classLevel === contentCreateMeta.classLevel) &&
            (!contentCreateMeta.subject || topic.subject === contentCreateMeta.subject) &&
            (!createTopicSearch.trim() || topic.title.toLowerCase().includes(createTopicSearch.trim().toLowerCase())),
        )
        .sort((a, b) => a.title.localeCompare(b.title)),
    [contentCreateMeta.classLevel, contentCreateMeta.subject, createTopicSearch, topics],
  );
  const assignTargetTopicOptions = useMemo(
    () =>
      topics
        .filter(
          (topic) =>
            (!assignTopicFilters.classLevel || topic.classLevel === assignTopicFilters.classLevel) &&
            (!assignTopicFilters.subject || topic.subject === assignTopicFilters.subject) &&
            (!assignTopicFilters.search.trim() ||
              topic.title.toLowerCase().includes(assignTopicFilters.search.trim().toLowerCase())),
        )
        .sort((a, b) => a.title.localeCompare(b.title)),
    [assignTopicFilters.classLevel, assignTopicFilters.search, assignTopicFilters.subject, topics],
  );
  const filteredQuizOptions = useMemo(
    () =>
      allOrgQuizzes
        .filter(
          (quiz) =>
            (!quizDialogFilters.classLevel || (quiz.class_level || '').trim() === quizDialogFilters.classLevel.trim()) &&
            (!quizDialogFilters.subject || (quiz.subject || '').trim() === quizDialogFilters.subject.trim()) &&
            (!quizDialogFilters.search.trim() ||
              `${quiz.title} ${quiz.subject || ''}`.toLowerCase().includes(quizDialogFilters.search.trim().toLowerCase())),
        )
        .sort((a, b) => a.title.localeCompare(b.title)),
    [allOrgQuizzes, quizDialogFilters.classLevel, quizDialogFilters.search, quizDialogFilters.subject],
  );
  const quizClassOptions = useMemo(
    () => STANDARD_OPTIONS.map((item) => item.value),
    [],
  );
  const quizSubjectOptions = useMemo(
    () =>
      [
        ...new Set(
          quizCatalogItems
            .filter((item) => !quizDialogFilters.classLevel || item.classLevel.trim() === quizDialogFilters.classLevel.trim())
            .map((item) => item.subject.trim())
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [quizCatalogItems, quizDialogFilters.classLevel],
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

    const res = await apiFetch(`/questions?${query.toString()}`);
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload.message || 'Failed to load question list');
    }
    const payload = await res.json();
    setQuestions(payload.questions || []);
    setQuestionPage(0);
  }, [apiFetch, filters.category, filters.classLevel, filters.search, filters.subject]);

  const loadSubjectCatalog = useCallback(async () => {
    const res = await apiFetch('/content/subjects');
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload.message || 'Failed to load subject catalog');
    }
    const payload = await res.json();
    setSubjectCatalog((payload.subjects || []) as SubjectCatalogItem[]);
  }, [apiFetch]);

  const loadQuizCatalog = useCallback(async () => {
    const res = await apiFetch('/catalog/subjects');
    if (!res.ok) {
      return;
    }
    const payload = await res.json();
    const items = Array.isArray(payload.items) ? payload.items : [];
    const mapped = items
      .map((item: any) => ({
        classLevel: String(item.class_level || '').trim(),
        subject: String(item.subject || '').trim(),
      }))
      .filter((item: QuizCatalogItem) => item.classLevel && item.subject);
    setQuizCatalogItems(mapped);
  }, [apiFetch]);

  const loadTopics = useCallback(async () => {
    const query = new URLSearchParams();
    query.set('limit', '200');
    if (contentFilters.classLevel.trim()) query.set('class_level', contentFilters.classLevel.trim());
    if (contentFilters.subject.trim()) query.set('subject', contentFilters.subject.trim());

    const res = await apiFetch(`/topics?${query.toString()}`);
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload.message || 'Failed to load topics');
    }
    const payload = await res.json();
    setTopics((payload.topics || []) as ContentTopic[]);
    setTopicPage(0);
  }, [apiFetch, contentFilters.classLevel, contentFilters.subject]);

  const loadTopicDetails = useCallback(
    async (topicId: string) => {
      setLoadingTopicDetails(true);
      try {
        const res = await apiFetch(`/topics/${topicId}/details`);
        if (!res.ok) {
          const errorPayload = await res.json().catch(() => ({}));
          throw new Error(errorPayload.message || 'Failed to load topic details');
        }
        const payload = await res.json();
        setSelectedTopic(payload.topic as ContentTopic);
        setTopicSections((payload.sections || []) as TopicContentSection[]);
        setTopicContentItems((payload.contentItems || []) as LearningContentItem[]);
        setTopicContentPage(0);
      } catch (error) {
        setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to load topic details' });
      } finally {
        setLoadingTopicDetails(false);
      }
    },
    [apiFetch],
  );

  const uploadTopicCover = async () => {
    try {
      setUploadingTopicCover(true);
      const picked = await pickImageAsDataUrl();
      const uploaded = await uploadPickedFileToS3(picked, 'image');
      setTopicDraft((current) => ({ ...current, coverImage: uploaded.url }));
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to upload topic cover' });
    } finally {
      setUploadingTopicCover(false);
    }
  };

  const uploadSectionMedia = async (sectionId: string, contentType: TopicSectionDraft['contentType']) => {
    try {
      setUploadingSectionMediaId(sectionId);
      let picked: PickedFile;
      let mediaType: 'image' | 'audio' | 'video' = 'image';
      if (contentType === 'audio') {
        picked = await pickAudioAsDataUrl();
        mediaType = 'audio';
      } else if (contentType === 'reel') {
        picked = await pickFileAsDataUrl(
          'video/*',
          'Video upload is currently available on web. On mobile, provide Reel URL.',
        );
        mediaType = 'video';
      } else {
        picked = await pickImageAsDataUrl();
        mediaType = 'image';
      }
      const uploaded = await uploadPickedFileToS3(picked, mediaType);
      setSectionDrafts((current) =>
        current.map((section) =>
          section.id === sectionId
            ? { ...section, mediaUrl: uploaded.url, mediaLabel: uploaded.fileName, externalUrl: '', textContent: '' }
            : section,
        ),
      );
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to upload section media' });
    } finally {
      setUploadingSectionMediaId(null);
    }
  };

  const updateCreateSection = (sectionId: string, patch: Partial<TopicSectionDraft>) => {
    setContentCreateSections((current) =>
      current.map((section) => {
        if (section.id !== sectionId) return section;
        const next = { ...section, ...patch };
        if (patch.contentType) {
          if (patch.contentType === 'text') {
            next.mediaUrl = '';
            next.mediaLabel = '';
            next.externalUrl = '';
          } else if (patch.contentType === 'youtube_url' || patch.contentType === 'reel_url') {
            next.mediaUrl = '';
            next.mediaLabel = '';
            next.textContent = '';
          } else {
            next.externalUrl = '';
            next.textContent = '';
          }
        }
        return next;
      }),
    );
  };

  const addCreateSection = () => {
    setContentCreateSections((current) => [...current, makeEmptyTopicSection()]);
  };

  const removeCreateSection = (sectionId: string) => {
    setContentCreateSections((current) => (current.length <= 1 ? current : current.filter((item) => item.id !== sectionId)));
  };

  const uploadCreateContentMedia = async (sectionId: string) => {
    try {
      setUploadingSectionMediaId(sectionId);
      const picked = await pickFileAsDataUrl(
        'image/*,audio/*,video/*',
        'Media upload is currently available on web. On mobile, provide URL-based content.',
      );
      const lowerMime = picked.mimeType.toLowerCase();
      const lowerName = picked.fileName.toLowerCase();
      const mediaType: 'image' | 'audio' | 'video' = lowerMime.startsWith('video/')
        || /\.(mp4|mov|m4v|webm|mkv)$/.test(lowerName)
        ? 'video'
        : lowerMime.startsWith('audio/') || /\.(mp3|wav|ogg|aac|m4a|flac)$/.test(lowerName)
          ? 'audio'
          : 'image';
      const uploaded = await uploadPickedFileToS3(picked, mediaType);
      updateCreateSection(sectionId, {
        contentType: mediaType === 'video' ? 'reel' : mediaType === 'audio' ? 'audio' : 'image',
        mediaUrl: uploaded.url,
        mediaLabel: uploaded.fileName,
        externalUrl: '',
        textContent: '',
      });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to upload content media' });
    } finally {
      setUploadingSectionMediaId(null);
    }
  };

  const saveTopic = async () => {
    if (!topicDraft.title.trim() || !topicDraft.classLevel.trim() || !topicDraft.subject.trim()) {
      setMessage({ type: 'error', text: 'Topic title, standard and subject are required.' });
      return;
    }
    setSavingTopic(true);
    try {
      const payload = {
        title: topicDraft.title.trim(),
        classLevel: topicDraft.classLevel.trim(),
        subject: topicDraft.subject.trim(),
        coverImage: toPersistentMediaUrl(topicDraft.coverImage.trim()) || undefined,
      };
      const endpoint = topicDialogMode === 'edit' && editingTopicId ? `/topics/${editingTopicId}` : '/topics';
      const method = topicDialogMode === 'edit' ? 'PATCH' : 'POST';
      const res = await apiFetch(endpoint, { method, body: JSON.stringify(payload) });
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to save topic');
      }
      setTopicDialogMode(null);
      setEditingTopicId(null);
      setTopicDraft(makeInitialTopicDraft());
      await loadTopics();
      setMessage({ type: 'success', text: topicDialogMode === 'edit' ? 'Topic updated successfully.' : 'Topic created successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save topic' });
    } finally {
      setSavingTopic(false);
    }
  };

  const saveTopicSections = async () => {
    if (!selectedTopic) return;
    const normalizedSections = sectionDrafts.map((section) => ({
      title: section.title?.trim() || undefined,
      contentType: section.contentType,
      mediaUrl: section.mediaUrl.trim() ? toPersistentMediaUrl(section.mediaUrl.trim()) : undefined,
      externalUrl: section.externalUrl.trim() || undefined,
      textContent: section.textContent.trim() || undefined,
    }));
    const missing = normalizedSections.some((section) => {
      if (section.contentType === 'text') return !section.textContent;
      if (section.contentType === 'youtube_url' || section.contentType === 'reel_url') return !section.externalUrl;
      return !section.mediaUrl;
    });
    if (missing) {
      setMessage({ type: 'error', text: 'Each section needs required content based on type.' });
      return;
    }

    setSavingSections(true);
    try {
      const res = await apiFetch(`/topics/${selectedTopic.id}/sections`, {
        method: 'PUT',
        body: JSON.stringify({ sections: normalizedSections }),
      });
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to save content sections');
      }
      const payload = await res.json();
      setTopicSections((payload.sections || []) as TopicContentSection[]);
      setIsSectionDialogOpen(false);
      setSectionDrafts([makeEmptyTopicSection()]);
      await loadTopics();
      setMessage({ type: 'success', text: 'Topic content saved successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save content sections' });
    } finally {
      setSavingSections(false);
    }
  };

  const loadContentItems = useCallback(async () => {
    const query = new URLSearchParams();
    query.set('limit', '300');
    if (contentItemFilters.classLevel.trim()) query.set('class_level', contentItemFilters.classLevel.trim());
    if (contentItemFilters.subject.trim()) query.set('subject', contentItemFilters.subject.trim());
    if (contentItemFilters.topicId.trim()) query.set('topic_id', contentItemFilters.topicId.trim());
    const res = await apiFetch(`/content/items?${query.toString()}`);
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload.message || 'Failed to load content items');
    }
    const payload = await res.json();
    setContentItems((payload.items || []) as LearningContentItem[]);
    setContentPage(0);
  }, [apiFetch, contentItemFilters.classLevel, contentItemFilters.subject, contentItemFilters.topicId]);

  const createSingleContentItem = async () => {
    if (!contentCreateMeta.classLevel.trim() || !contentCreateMeta.subject.trim()) {
      setMessage({ type: 'error', text: 'Standard, subject and topic are required.' });
      return;
    }
    if (!editingContentId && !contentCreateMeta.topicId.trim()) {
      setMessage({ type: 'error', text: 'Standard, subject and topic are required.' });
      return;
    }
    if (!contentCreateMeta.title.trim()) {
      setMessage({ type: 'error', text: 'Content title is required.' });
      return;
    }
    const normalizedSections = contentCreateSections.map((section) => ({
      title: section.title?.trim() || undefined,
      contentType: section.contentType,
      mediaUrl: section.mediaUrl.trim() ? toPersistentMediaUrl(section.mediaUrl.trim()) : undefined,
      externalUrl: section.externalUrl.trim() || undefined,
      textContent: section.textContent.trim() || undefined,
    }));
    const invalidIndex = normalizedSections.findIndex((section) => {
      if (section.contentType === 'text') return !section.textContent;
      if (section.contentType === 'youtube_url' || section.contentType === 'reel_url') return !section.externalUrl;
      return !section.mediaUrl;
    });
    if (invalidIndex > -1) {
      setMessage({ type: 'error', text: `Section ${invalidIndex + 1} is incomplete. Fill required fields.` });
      return;
    }

    setSavingContentCreate(true);
    try {
      if (editingContentId) {
        const res = await apiFetch(`/content/items/${editingContentId}`, {
          method: 'PUT',
          body: JSON.stringify({
            classLevel: contentCreateMeta.classLevel.trim(),
            subject: contentCreateMeta.subject.trim(),
            title: contentCreateMeta.title.trim(),
            sections: normalizedSections,
          }),
        });
        if (!res.ok) {
          const errorPayload = await res.json().catch(() => ({}));
          throw new Error(errorPayload.message || 'Failed to update content');
        }
        setIsCreateContentDialogOpen(false);
        setEditingContentId(null);
        setContentCreateSections([makeEmptyTopicSection()]);
        await loadContentItems();
        setMessage({ type: 'success', text: 'Content updated successfully.' });
        return;
      }

      const res = await apiFetch('/content/items', {
        method: 'POST',
        body: JSON.stringify({
          classLevel: contentCreateMeta.classLevel.trim(),
          subject: contentCreateMeta.subject.trim(),
          topicId: contentCreateMeta.topicId.trim(),
          title: contentCreateMeta.title.trim(),
          sections: normalizedSections,
        }),
      });
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to create content');
      }
      setIsCreateContentDialogOpen(false);
      setContentCreateSections([makeEmptyTopicSection()]);
      setContentCreateMeta((current) => ({ ...current, title: '' }));
      await Promise.all([loadTopicDetails(contentCreateMeta.topicId), loadTopics(), loadContentItems()]);
      setMessage({ type: 'success', text: 'Content created successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to create content' });
    } finally {
      setSavingContentCreate(false);
    }
  };

  const toggleAssignContent = (contentId: string) => {
    setSelectedAssignContentIds((current) =>
      current.includes(contentId) ? current.filter((id) => id !== contentId) : [...current, contentId],
    );
  };

  const assignContentsToTopic = async () => {
    if (!assignTargetTopicId.trim()) {
      setMessage({ type: 'error', text: 'Select target topic for assignment.' });
      return;
    }
    setSavingAssignments(true);
    try {
      const existingRes = await apiFetch(`/topics/${assignTargetTopicId}/assignments`);
      const existingPayload = existingRes.ok ? await existingRes.json() : { contentIds: [] };
      const mergedIds = [...new Set([...(existingPayload.contentIds || []), ...selectedAssignContentIds])];
      const res = await apiFetch(`/topics/${assignTargetTopicId}/assignments`, {
        method: 'PUT',
        body: JSON.stringify({ contentIds: mergedIds }),
      });
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to assign content');
      }
      setSelectedAssignContentIds([]);
      await Promise.all([loadTopics(), loadContentItems()]);
      if (selectedTopic?.id === assignTargetTopicId) {
        await loadTopicDetails(assignTargetTopicId);
      }
      setMessage({ type: 'success', text: 'Selected content assigned successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to assign content' });
    } finally {
      setSavingAssignments(false);
    }
  };
  const removeContentAssignment = async (contentId: string) => {
    if (!selectedTopic) return;
    try {
      const existingRes = await apiFetch(`/topics/${selectedTopic.id}/assignments`);
      if (!existingRes.ok) {
        throw new Error('Failed to load current assignments');
      }
      const existingPayload = await existingRes.json();
      const updatedIds = (existingPayload.contentIds || []).filter((id: string) => id !== contentId);

      const res = await apiFetch(`/topics/${selectedTopic.id}/assignments`, {
        method: 'PUT',
        body: JSON.stringify({ contentIds: updatedIds }),
      });
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to remove content assignment');
      }
      await Promise.all([loadTopics(), loadContentItems(), loadTopicDetails(selectedTopic.id)]);
      setMessage({ type: 'success', text: 'Content removed from topic successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to remove content assignment' });
    }
  };

  const loadTopicQuizzes = async (topicId: string) => {
    setLoadingTopicQuizzes(true);
    try {
      const [assignedRes, libraryRes] = await Promise.all([
        apiFetch(`/topics/${topicId}/quizzes`),
        apiFetch(`/quizzes/teacher/library?status=all&limit=200`),
      ]);
      if (assignedRes.ok) {
        const payload = await assignedRes.json();
        const assigned = (payload.quizzes || []) as QuizItem[];
        setTopicQuizzes(assigned);
        setSelectedQuizIds(assigned.map((quiz) => quiz.id));
      }
      if (libraryRes.ok) {
        const payload = await libraryRes.json();
        setAllOrgQuizzes((payload.quizzes || []) as QuizItem[]);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingTopicQuizzes(false);
    }
  };

  const openQuizAssignmentDialog = async (topicOverride?: ContentTopic) => {
    const topic = topicOverride || selectedTopic;
    if (!topic) return;
    if (!selectedTopic || selectedTopic.id !== topic.id) {
      await loadTopicDetails(topic.id);
    }
    setIsQuizDialogOpen(true);
    setQuizDialogFilters({ classLevel: topic.classLevel || '', subject: topic.subject || '', search: '' });
    await Promise.all([loadQuizCatalog(), loadTopicQuizzes(topic.id)]);
  };

  const toggleQuizSelection = (quizId: string) => {
    setSelectedQuizIds((current) =>
      current.includes(quizId) ? current.filter((id) => id !== quizId) : [...current, quizId],
    );
  };

  const saveSelectedQuizzesToTopic = async () => {
    if (!selectedTopic) return;
    setSavingQuizSelections(true);
    try {
      const res = await apiFetch(`/topics/${selectedTopic.id}/quizzes`, {
        method: 'PUT',
        body: JSON.stringify({ quizIds: selectedQuizIds }),
      });
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to save quiz assignments');
      }
      await loadTopicQuizzes(selectedTopic.id);
      setIsQuizDialogOpen(false);
      setMessage({ type: 'success', text: 'Quiz assignments saved successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save quiz assignments' });
    } finally {
      setSavingQuizSelections(false);
    }
  };

  const deleteContentItem = async (contentId: string) => {
    setDeletingContentId(contentId);
    try {
      const res = await apiFetch(`/content/items/${contentId}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to delete content');
      }
      await Promise.all([loadContentItems(), loadTopics()]);
      setMessage({ type: 'success', text: 'Content deleted successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to delete content' });
    } finally {
      setDeletingContentId(null);
    }
  };

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

  useEffect(() => {
    if (!isTeacherView || activeLearningTab !== 'topic') return;
    let cancelled = false;
    const run = async () => {
      setLoadingTopics(true);
      try {
        await Promise.all([loadSubjectCatalog(), loadQuizCatalog(), loadContentItems()]);
        await loadTopics();
      } catch (error) {
        if (!cancelled) {
          setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to load content topics' });
        }
      } finally {
        if (!cancelled) {
          setLoadingTopics(false);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [activeLearningTab, isTeacherView, loadQuizCatalog, loadSubjectCatalog, loadTopics, loadContentItems]);

  useEffect(() => {
    if (!isTeacherView || activeLearningTab !== 'content') return;
    let mounted = true;
    const run = async () => {
      try {
        setLoadingContentItems(true);
        await Promise.all([loadSubjectCatalog(), loadTopics(), loadContentItems()]);
      } catch (error) {
        if (mounted) setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to load content data' });
      } finally {
        if (mounted) setLoadingContentItems(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [activeLearningTab, isTeacherView, loadContentItems, loadSubjectCatalog, loadTopics]);

  useEffect(() => {
    if (!isTeacherView || activeLearningTab !== 'question') return;
    let mounted = true;
    const run = async () => {
      try {
        await loadSubjectCatalog();
      } catch (error) {
        if (mounted) {
          setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to load subject catalog' });
        }
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [activeLearningTab, isTeacherView, loadSubjectCatalog]);

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
      mainImage: questionType === 'guess_image' || questionType === 'logico' ? current.mainImage : '',
      mainImageLabel: questionType === 'guess_image' || questionType === 'logico' ? current.mainImageLabel : '',
      mainImageAssetId: questionType === 'guess_image' || questionType === 'logico' ? current.mainImageAssetId : '',
      mainAudio: questionType === 'guess_audio' ? current.mainAudio : '',
      mainAudioLabel: questionType === 'guess_audio' ? current.mainAudioLabel : '',
      mainAudioAssetId: questionType === 'guess_audio' ? current.mainAudioAssetId : '',
      options: makeDefaultOptionsByType(questionType),
    }));
  };

  const uploadPickedFileToS3 = async (picked: PickedFile, mediaType: 'image' | 'audio' | 'video') => {
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
    setQuestionFormTab('setup');
    setMessage(null);
  };

  const openEditDialog = (question: QuestionItem & { question_data?: unknown }) => {
    const resolvedMainImage = questionDataPromptImage(question.question_data ?? {});
    const resolvedMainImageAssetId = questionDataPromptImageAssetId(question.question_data ?? {});
    const resolvedMainAudio = question.question_audio || questionDataPromptAudio(question.question_data ?? {});
    const resolvedMainAudioAssetId = questionDataPromptAudioAssetId(question.question_data ?? {});
    const normalizedType = normalizeQuestionType(question.question_type || 'guess_image');
    const parsedOptions =
      normalizedType === 'logico'
        ? questionDataToLogicoOptions(question.question_data ?? {})
        : questionDataToOptions(question.question_data ?? {});
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
      matchPairs: questionDataToMatchPairs(question.question_data ?? {}),
      rawQuestionData: question.question_data ?? {},
    });
    setActionBadge(null);
    setQuestionFormTab('setup');
    setMessage(null);
  };

  const createQuestion = async () => {
    setCreating(true);
    setMessage(null);
    try {
      const payload = draftToPayload(createDraft);
      const res = await apiFetch('/questions', {
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
      const res = await apiFetch(`/questions/${editingQuestionId}`, {
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
      const res = await apiFetch(`/questions/${questionId}`, {
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
      setFilters((current) => ({ ...current, classLevel: value, subject: '' }));
    } else if (selectorField === 'filterSubject') {
      setFilters((current) => ({ ...current, subject: value }));
    } else if (selectorField === 'classLevel') {
      if (editingQuestionId) {
        setEditDraft((current) => ({ ...current, classLevel: value, subject: '' }));
      } else {
        setCreateDraft((current) => ({ ...current, classLevel: value, subject: '' }));
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

  const applyContentSelectorValue = (value: string) => {
    if (contentSelectorField === 'contentFilterClassLevel') {
      if (activeLearningTab === 'content') {
        if (contentModeTab === 'create') {
          setContentCreateMeta((current) => ({ ...current, classLevel: value, subject: '', topicId: '' }));
          setCreateTopicSearch('');
        } else {
          setContentItemFilters((current) => ({ ...current, classLevel: value, subject: '', topicId: '' }));
        }
      } else {
        setContentFilters((current) => ({ ...current, classLevel: value, subject: '' }));
      }
    } else if (contentSelectorField === 'contentFilterSubject') {
      if (activeLearningTab === 'content') {
        if (contentModeTab === 'create') {
          setContentCreateMeta((current) => ({ ...current, subject: value, topicId: '' }));
        } else {
          setContentItemFilters((current) => ({ ...current, subject: value }));
        }
      } else {
        setContentFilters((current) => ({ ...current, subject: value }));
      }
    } else if (contentSelectorField === 'assignTargetClassLevel') {
      setAssignTopicFilters((current) => ({ ...current, classLevel: value, subject: '' }));
    } else if (contentSelectorField === 'assignTargetSubject') {
      setAssignTopicFilters((current) => ({ ...current, subject: value }));
    } else if (contentSelectorField === 'quizFilterClassLevel') {
      setQuizDialogFilters((current) => ({ ...current, classLevel: value, subject: '' }));
    } else if (contentSelectorField === 'quizFilterSubject') {
      setQuizDialogFilters((current) => ({ ...current, subject: value }));
    } else if (contentSelectorField === 'topicClassLevel') {
      setTopicDraft((current) => ({ ...current, classLevel: value, subject: '' }));
    } else if (contentSelectorField === 'topicSubject') {
      setTopicDraft((current) => ({ ...current, subject: value }));
    }
    setContentSelectorField(null);
  };

  const openCreateTopicDialog = () => {
    setTopicDialogMode('create');
    setEditingTopicId(null);
    setTopicDraft(makeInitialTopicDraft());
  };

  const openEditTopicDialog = (topic: ContentTopic) => {
    setTopicDialogMode('edit');
    setEditingTopicId(topic.id);
    setTopicDraft({
      title: topic.title,
      classLevel: topic.classLevel,
      subject: topic.subject,
      coverImage: topic.coverImage || '',
    });
  };

  const runTopicAction = async (
    topic: ContentTopic,
    action: 'details' | 'create_content' | 'assign_quiz' | 'edit' | 'delete',
  ) => {
    setTopicActionMenuTopic(null);
    if (action === 'details') {
      await Promise.all([loadTopicDetails(topic.id), loadTopicQuizzes(topic.id)]);
      return;
    }
    if (action === 'create_content') {
      await openCreateContentDialog(topic);
      return;
    }
    if (action === 'assign_quiz') {
      await openQuizAssignmentDialog(topic);
      return;
    }
    if (action === 'edit') {
      openEditTopicDialog(topic);
      return;
    }
    await deleteTopic(topic.id);
  };

  const deleteTopic = async (topicId: string) => {
    setDeletingTopicId(topicId);
    try {
      const res = await apiFetch(`/topics/${topicId}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to delete topic');
      }
      if (selectedTopic?.id === topicId) {
        setSelectedTopic(null);
        setTopicSections([]);
      }
      await loadTopics();
      setMessage({ type: 'success', text: 'Topic deleted successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to delete topic' });
    } finally {
      setDeletingTopicId(null);
    }
  };

  const addSectionDraft = () => {
    setSectionDrafts((current) => [...current, makeEmptyTopicSection()]);
  };

  const removeSectionDraft = (sectionId: string) => {
    setSectionDrafts((current) => (current.length <= 1 ? current : current.filter((section) => section.id !== sectionId)));
  };

  const updateSectionDraft = (sectionId: string, patch: Partial<TopicSectionDraft>) => {
    setSectionDrafts((current) =>
      current.map((section) => {
        if (section.id !== sectionId) return section;
        const next = { ...section, ...patch };
        if (patch.contentType) {
          if (patch.contentType === 'text') {
            next.mediaUrl = '';
            next.mediaLabel = '';
            next.externalUrl = '';
          } else if (patch.contentType === 'youtube_url' || patch.contentType === 'reel_url') {
            next.mediaUrl = '';
            next.mediaLabel = '';
            next.textContent = '';
          } else {
            next.externalUrl = '';
            next.textContent = '';
          }
        }
        return next;
      }),
    );
  };

  const openCreateContentDialog = async (topicOverride?: ContentTopic) => {
    const topic = topicOverride || selectedTopic;
    if (!topic) return;
    if (!selectedTopic || selectedTopic.id !== topic.id) {
      await loadTopicDetails(topic.id);
    }
    setActiveLearningTab('content');
    setContentModeTab('create');
    setCreateTopicSearch(topic.title);
    setContentCreateSections([makeEmptyTopicSection()]);
    setEditingContentId(null);
    setContentCreateMeta({
      classLevel: topic.classLevel,
      subject: topic.subject,
      topicId: topic.id,
      title: '',
    });
    setIsCreateContentDialogOpen(true);
  };

  const openCreateContentModal = () => {
    setEditingContentId(null);
    setContentCreateSections([makeEmptyTopicSection()]);
    setContentCreateMeta((current) => ({ ...current, title: '', topicId: current.topicId || '' }));
    setIsCreateContentDialogOpen(true);
  };

  const openEditContentModal = async (item: LearningContentItem) => {
    try {
      const res = await apiFetch(`/content/items/${item.id}`);
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to load content details');
      }
      const payload = (await res.json()) as LearningContentItem;
      setEditingContentId(item.id);
      setContentCreateMeta({
        classLevel: payload.classLevel,
        subject: payload.subject,
        topicId: '',
        title: payload.title,
      });
      const sections = (payload.sections || []).length
        ? (payload.sections || []).map((section: any) => ({
            id: buildClientId(),
            title: section.title || '',
            contentType: section.contentType,
            mediaUrl: section.mediaUrl || '',
            mediaLabel: section.mediaUrl ? extractFileName(section.mediaUrl) : '',
            externalUrl: section.externalUrl || '',
            textContent: section.textContent || '',
          }))
        : [
            {
              id: buildClientId(),
              title: '',
              contentType: (payload.contentType as TopicSectionDraft['contentType']) || 'text',
              mediaUrl: payload.mediaUrl || '',
              mediaLabel: payload.mediaUrl ? extractFileName(payload.mediaUrl) : '',
              externalUrl: payload.externalUrl || '',
              textContent: payload.textContent || '',
            },
          ];
      setContentCreateSections(sections);
      setIsCreateContentDialogOpen(true);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to open content editor' });
    }
  };

  const openPreviewContentModal = async (item: LearningContentItem) => {
    try {
      const res = await apiFetch(`/content/items/${item.id}`);
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(errorPayload.message || 'Failed to load content preview');
      }
      const payload = (await res.json()) as LearningContentItem;
      setPreviewContentItem(payload);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to preview content' });
    }
  };

  const questionSubjectClassLevel =
    selectorField === 'filterSubject'
      ? filters.classLevel
      : editingQuestionId
        ? editDraft.classLevel
        : createDraft.classLevel;
  const questionSubjectOptions = subjectCatalog
    .filter((item) => !questionSubjectClassLevel || item.classLevel.trim() === questionSubjectClassLevel.trim())
    .map((item) => item.title.trim())
    .filter((value, index, arr) => value && arr.indexOf(value) === index)
    .sort((a, b) => a.localeCompare(b));
  const selectorOptions =
    selectorField === 'classLevel' || selectorField === 'filterClassLevel' ? classOptions : questionSubjectOptions;
  const selectorTitle =
    selectorField === 'classLevel' || selectorField === 'filterClassLevel' ? 'Select Standard' : 'Select Subject';
  const isQuestionStandardSelector = selectorField === 'classLevel' || selectorField === 'filterClassLevel';
  const contentSelectorOptions =
    contentSelectorField === 'quizFilterClassLevel'
      ? quizClassOptions
      : contentSelectorField === 'quizFilterSubject'
        ? quizSubjectOptions
        : contentSelectorField === 'contentFilterClassLevel' ||
            contentSelectorField === 'topicClassLevel' ||
            contentSelectorField === 'assignTargetClassLevel'
          ? contentClassOptions
          : subjectCatalog
              .filter((item) => {
                const classLevelFilter =
                  contentSelectorField === 'topicSubject'
                    ? topicDraft.classLevel
                    : contentSelectorField === 'assignTargetSubject'
                      ? assignTopicFilters.classLevel
                      : activeLearningTab === 'content'
                        ? contentModeTab === 'create'
                          ? contentCreateMeta.classLevel
                          : contentItemFilters.classLevel
                        : contentFilters.classLevel;
                return !classLevelFilter || item.classLevel === classLevelFilter;
              })
              .map((item) => item.title)
              .filter((value, index, arr) => value && arr.indexOf(value) === index)
              .sort((a, b) => a.localeCompare(b));
  const contentSelectorTitle =
    contentSelectorField === 'contentFilterClassLevel' ||
    contentSelectorField === 'topicClassLevel' ||
    contentSelectorField === 'assignTargetClassLevel' ||
    contentSelectorField === 'quizFilterClassLevel'
      ? 'Select Standard'
      : 'Select Subject';
  const isContentStandardSelector =
    contentSelectorField === 'contentFilterClassLevel' ||
    contentSelectorField === 'topicClassLevel' ||
    contentSelectorField === 'assignTargetClassLevel' ||
    contentSelectorField === 'quizFilterClassLevel';
  const isTopicSelectorActive = contentSelectorField === 'topicClassLevel' || contentSelectorField === 'topicSubject';
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
    const dialogTitle = mode === 'create' ? 'New Question' : 'Edit Question';
    const saveAction = mode === 'create' ? createQuestion : saveQuestion;
    const isSaving = mode === 'create' ? creating : savingQuestionId !== null;
    const closeAction = () => {
      setActionBadge(null);
      mode === 'create' ? setIsCreateDialogOpen(false) : setEditingQuestionId(null);
    };
    const editorMode = getQuestionEditorMode(draft.questionType);
    const isLogicoMode = editorMode === 'logico';
    const hasOptions = editorMode === 'choice' || isLogicoMode;
    const hasPairs   = editorMode === 'drag_drop';
    const tab2Label  = hasPairs ? 'Pairs' : isLogicoMode ? 'Mappings' : 'Options';
    const logicoSlotStats = isLogicoMode
      ? draft.options.reduce(
          (acc, option) => {
            const slot = Number(option.slotPosition);
            const isValid = Number.isInteger(slot) && slot >= 1 && slot <= 10;
            if (!isValid) {
              acc.invalidCount += 1;
              return acc;
            }
            acc.slotCounts.set(slot, (acc.slotCounts.get(slot) || 0) + 1);
            return acc;
          },
          { slotCounts: new Map<number, number>(), invalidCount: 0 },
        )
      : null;
    const duplicateLogicoSlots = logicoSlotStats
      ? Array.from(logicoSlotStats.slotCounts.entries())
          .filter(([, count]) => count > 1)
          .map(([slot]) => slot)
      : [];
    const hasLogicoMappingBlocker = Boolean(
      isLogicoMode &&
      ((logicoSlotStats?.invalidCount || 0) > 0 || duplicateLogicoSlots.length > 0),
    );
    const canSave = !isSaving && !hasLogicoMappingBlocker;

    const QTYPES_EMOJI: Record<string, string> = {
      guess_image: '', drag_drop_match: '', guess_audio: '',
      true_false: '', single_choice: '', multi_choice: '', logico: '',
    };
    const QTYPES_COLOR: Record<string, string> = {
      guess_image: '#4A90E2', drag_drop_match: '#9B8EC4', guess_audio: '#7DC67A',
      true_false: '#E6A817', single_choice: '#FF7043', multi_choice: '#E91E8C', logico: '#0f766e',
    };
    const QTYPES_BG: Record<string, string> = {
      guess_image: '#D6EAFF', drag_drop_match: '#EDE4FF', guess_audio: '#D6F5D6',
      true_false: '#FFF5CC', single_choice: '#FFE8D6', multi_choice: '#FFE0F0', logico: '#DCFCE7',
    };

    return (
      <View style={qFormS.screen}>
        {/* Header */}
        <View style={[qFormS.header, { paddingTop: Platform.OS === 'ios' ? 52 : 20 }]}>
          <Pressable onPress={closeAction} style={qFormS.backBtn}>
            <Text style={qFormS.backArrow}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={qFormS.titleText}>{dialogTitle}</Text>
            {mode === 'edit' ? (
              <Text style={qFormS.subTitle}>{getQuestionTypeLabel(draft.questionType)}</Text>
            ) : null}
          </View>
          <Pressable style={[qFormS.saveBtn, !canSave && qFormS.saveBtnDisabled]} onPress={saveAction} disabled={!canSave}>
            {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={qFormS.saveBtnText}>Save</Text>}
          </Pressable>
        </View>

        {/* Tab bar */}
        <View style={qFormS.tabBar}>
          {([
            ['setup', '⚙ Setup'],
            ...(hasOptions || hasPairs ? [['options', tab2Label] as [string, string]] : []),
            ['preview', '👁 Preview'],
          ] as [string, string][]).map(([key, label]) => (
            <Pressable key={key} style={[qFormS.tab, questionFormTab === key && qFormS.tabActive]}
              onPress={() => setQuestionFormTab(key as 'setup' | 'options' | 'preview')}>
              <Text style={[qFormS.tabText, questionFormTab === key && qFormS.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Toast */}
        {actionBadge ? (
          <View style={qFormS.toast}><Text style={qFormS.toastText}>{actionBadge}</Text></View>
        ) : null}
        {message ? (
          <View style={[qFormS.toast, message.type === 'error' ? qFormS.toastError : qFormS.toastSuccess]}>
            <Text style={[qFormS.toastText, message.type === 'error' ? qFormS.toastErrorText : qFormS.toastSuccessText]}>{message.text}</Text>
          </View>
        ) : null}

        {/* SETUP TAB */}
        {questionFormTab === 'setup' && (
          <ScrollView contentContainerStyle={qFormS.tabContent}>
            {mode === 'create' ? (
              <View style={qFormS.group}>
                <Text style={qFormS.groupLabel}>QUESTION TYPE</Text>
                <View style={qFormS.fieldCard}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                    {QUESTION_TYPE_CHOICES.map((choice) => {
                      const sel = draft.questionType === choice.value;
                      const ec = QTYPES_COLOR[choice.value] ?? '#4A90E2';
                      const eb = QTYPES_BG[choice.value] ?? '#D6EAFF';
                      const ee = QTYPES_EMOJI[choice.value] ?? '❓';
                      return (
                        <Pressable key={choice.value}
                          style={[qFormS.qtypeChip, sel && { backgroundColor: eb, borderColor: ec }]}
                          onPress={() => setQuestionType(choice.value)}>
                          <Text style={qFormS.qtypeEmoji}>{ee}</Text>
                          <Text style={[qFormS.qtypeLabel, sel && { color: ec, fontWeight: '800' }]}>{choice.label}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  {QUESTION_TYPE_CHOICES.find((c) => c.value === draft.questionType) ? (
                    <Text style={qFormS.qtypeDesc}>{QUESTION_TYPE_CHOICES.find((c) => c.value === draft.questionType)!.description}</Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            <View style={qFormS.group}>
              <Text style={qFormS.groupLabel}>BASIC INFO</Text>
              <View style={qFormS.fieldCard}>
                <Text style={qFormS.fieldLabel}>Question Title</Text>
                <TextInput value={draft.questionTitle}
                  onChangeText={(v) => updateDraftField(mode, 'questionTitle', v)}
                  placeholder="e.g. What animal says Moo?" style={qFormS.input} placeholderTextColor="#B0B8D0" />
                <View style={qFormS.divider} />
                <Text style={qFormS.fieldLabel}>Instruction (optional)</Text>
                <TextInput value={draft.questionInstruction}
                  onChangeText={(v) => updateDraftField(mode, 'questionInstruction', v)}
                  placeholder="e.g. Listen and choose the correct animal"
                  style={[qFormS.input, { minHeight: 52 }]} multiline placeholderTextColor="#B0B8D0" />
              </View>
            </View>

            <View style={qFormS.group}>
              <Text style={qFormS.groupLabel}>CLASS SETTINGS</Text>
              <View style={qFormS.fieldCard}>
                <Text style={qFormS.fieldLabel}>Standard / Class</Text>
                <Pressable style={qFormS.selectorRow} onPress={() => setSelectorField('classLevel')}>
                  <Text style={draft.classLevel ? qFormS.selectorVal : qFormS.selectorPlaceholder}>
                    {draft.classLevel ? getStandardLabel(draft.classLevel) : 'Select Standard'}
                  </Text>
                  <Text style={{ color: '#B0B8D0', fontSize: 16 }}>›</Text>
                </Pressable>
                <View style={qFormS.divider} />
                <Text style={qFormS.fieldLabel}>Subject</Text>
                <Pressable style={qFormS.selectorRow} onPress={() => setSelectorField('subject')}>
                  <Text style={draft.subject ? qFormS.selectorVal : qFormS.selectorPlaceholder}>
                    {draft.subject || 'Select Subject'}
                  </Text>
                  <Text style={{ color: '#B0B8D0', fontSize: 16 }}>›</Text>
                </Pressable>
              </View>
            </View>

            <View style={qFormS.group}>
              <Text style={qFormS.groupLabel}>SCORING</Text>
              <View style={qFormS.fieldCard}>
                <View style={qFormS.twoCol}>
                  <View style={{ flex: 1 }}>
                    <Text style={qFormS.fieldLabel}>Points</Text>
                    <TextInput value={draft.points}
                      onChangeText={(v) => updateDraftField(mode, 'points', v)}
                      placeholder="10" style={qFormS.input} keyboardType="numeric" placeholderTextColor="#B0B8D0" />
                  </View>
                  <View style={qFormS.colDivider} />
                  <View style={{ flex: 1 }}>
                    <Text style={qFormS.fieldLabel}>Time Limit (s)</Text>
                    <TextInput value={draft.timeLimitSeconds}
                      onChangeText={(v) => updateDraftField(mode, 'timeLimitSeconds', v)}
                      placeholder="30" style={qFormS.input} keyboardType="numeric" placeholderTextColor="#B0B8D0" />
                  </View>
                </View>
              </View>
            </View>

            {normalizedQuestionType === 'guess_image' || normalizedQuestionType === 'logico' ? (
              <View style={qFormS.group}>
                <Text style={qFormS.groupLabel}>{normalizedQuestionType === 'logico' ? 'WORKSHEET IMAGE' : 'PROMPT IMAGE'}</Text>
                <View style={qFormS.fieldCard}>
                  <Pressable style={qFormS.uploadBtn} onPress={() => uploadImageForQuestion(mode)}>
                    <Text style={qFormS.uploadBtnText}>
                      {normalizedQuestionType === 'logico' ? '⬆ Upload Worksheet Image' : '⬆ Upload Prompt Image'}
                    </Text>
                  </Pressable>
                  {draft.mainImage.trim() ? (
                    <View style={qFormS.mediaRow}>
                      <SafeImage uri={resolveMediaUrl(draft.mainImage.trim())} style={qFormS.mediaThumb} resizeMode="contain" />
                      <View style={{ flex: 1 }}>
                        <Text style={qFormS.mediaName} numberOfLines={2}>{toMediaLabel(draft.mainImage, 'image', draft.mainImageLabel)}</Text>
                      </View>
                      <Pressable onPress={() => requestMediaRemoval({ scope: 'question', mode, mediaType: 'image' })} style={qFormS.removeBtn}>
                        <Text style={qFormS.removeBtnText}>✕</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            {normalizedQuestionType === 'guess_audio' ? (
              <View style={qFormS.group}>
                <Text style={qFormS.groupLabel}>PROMPT AUDIO</Text>
                <View style={qFormS.fieldCard}>
                  <Pressable style={qFormS.uploadBtn} onPress={() => uploadAudioForQuestion(mode)}>
                    <Text style={qFormS.uploadBtnText}>⬆ Upload Prompt Audio</Text>
                  </Pressable>
                  {draft.mainAudio.trim() ? (
                    <View style={qFormS.mediaRow}>
                      <Text style={qFormS.audioIcon}>🎵</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={qFormS.mediaName} numberOfLines={2}>{toMediaLabel(draft.mainAudio, 'audio', draft.mainAudioLabel)}</Text>
                      </View>
                      <Pressable onPress={() => playAudioPreview(draft.mainAudio)} style={qFormS.playBtn}>
                        <Text style={qFormS.playBtnText}>▶ Play</Text>
                      </Pressable>
                      <Pressable onPress={() => requestMediaRemoval({ scope: 'question', mode, mediaType: 'audio' })} style={qFormS.removeBtn}>
                        <Text style={qFormS.removeBtnText}>✕</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}
          </ScrollView>
        )}

        {/* OPTIONS TAB */}
        {questionFormTab === 'options' && hasOptions && (
          <ScrollView contentContainerStyle={qFormS.tabContent}>
            <View style={qFormS.secGroup}>
              <View style={qFormS.secHeader}>
                <Text style={qFormS.secTitle}>{isLogicoMode ? 'Logico Button Mapping' : 'Answer Options'}</Text>
                {!isLogicoMode && normalizedQuestionType !== 'true_false' ? (
                  <Pressable style={qFormS.addBtn} onPress={() => addOption(mode)}>
                    <Text style={qFormS.addBtnText}>+ Add</Text>
                  </Pressable>
                ) : null}
              </View>
              {isLogicoMode ? (
                <>
                  <Text style={qFormS.secHint}>Assign each Logico button to one unique option position (1-10).</Text>
                  {draft.mainImage.trim() ? (
                    <SafeImage uri={resolveMediaUrl(draft.mainImage.trim())} style={qFormS.logicoWorksheetPreview} resizeMode="contain" />
                  ) : null}
                  {hasLogicoMappingBlocker ? (
                    <View style={qFormS.logicoBlockerBanner}>
                      <Text style={qFormS.logicoBlockerText}>
                        {(logicoSlotStats?.invalidCount || 0) > 0
                          ? 'All positions must be between 1 and 10.'
                          : `Duplicate positions found: ${duplicateLogicoSlots.join(', ')}.`}
                      </Text>
                    </View>
                  ) : null}
                  <View style={qFormS.logicoGrid}>
                    {draft.options.map((option, index) => (
                      <View key={`${mode}-logico-${option.id || index}`} style={qFormS.logicoCard}>
                        <View style={qFormS.logicoButtonCell}>
                          <LogicoButtonBadge buttonId={option.id} />
                          <Text style={qFormS.logicoButtonLabel}>{frameButtons.find((button) => button.id === option.id)?.label || option.id}</Text>
                        </View>
                        <View style={qFormS.logicoSlotCell}>
                          <Text style={qFormS.fieldLabel}>Position</Text>
                          <TextInput
                            value={String(option.slotPosition || '')}
                            onChangeText={(value) => {
                              const parsed = Number(value.replace(/[^0-9]/g, ''));
                              updateOption(mode, index, { slotPosition: Number.isFinite(parsed) ? parsed : 0 });
                            }}
                            keyboardType="numeric"
                            placeholder="1-10"
                            placeholderTextColor="#B0B8D0"
                            style={qFormS.logicoSlotInput}
                          />
                        </View>
                        <View style={qFormS.logicoLabelCell}>
                          <Text style={qFormS.fieldLabel}>Option label (optional)</Text>
                          <TextInput
                            value={option.label}
                            onChangeText={(value) => updateOption(mode, index, { label: value })}
                            placeholder="e.g. Elephant"
                            placeholderTextColor="#B0B8D0"
                            style={qFormS.optInput}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <Text style={qFormS.secHint}>
                    {normalizedQuestionType === 'multi_choice' ? 'Mark all correct options.' : 'Mark exactly one correct option.'}
                  </Text>
                  {draft.options.map((option, index) => (
                    <View key={`${mode}-opt-${index}`} style={qFormS.optBlock}>
                      <View style={qFormS.optBlockHeader}>
                        <View style={[qFormS.optNumBadge, option.isCorrect && { backgroundColor: '#7DC67A' }]}>
                          <Text style={[qFormS.optNum, option.isCorrect && { color: '#fff' }]}>{index + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <TextInput value={option.label}
                            onChangeText={(v) => updateOption(mode, index, { label: v })}
                            placeholder={`Option ${index + 1} label`} style={qFormS.optInput} placeholderTextColor="#B0B8D0" />
                        </View>
                        <Pressable
                          style={[qFormS.correctBtn, option.isCorrect && qFormS.correctBtnActive]}
                          onPress={() => setCorrectOption(mode, index)}>
                          <Text style={[qFormS.correctBtnText, option.isCorrect && qFormS.correctBtnTextActive]}>
                            {option.isCorrect ? '✓' : '○'}
                          </Text>
                        </Pressable>
                        {normalizedQuestionType !== 'true_false' ? (
                          <Pressable onPress={() => requestOptionRemoval({ mode, index })} style={qFormS.removeBtn}>
                            <Text style={qFormS.removeBtnText}>✕</Text>
                          </Pressable>
                        ) : null}
                      </View>
                      <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
                        <Pressable style={qFormS.uploadBtn} onPress={() => uploadMediaForOption(mode, index)}>
                          <Text style={qFormS.uploadBtnText}>
                            {normalizedQuestionType === 'guess_audio' ? '⬆ Upload Option Audio / Image' : '⬆ Upload Option Image / Audio'}
                          </Text>
                        </Pressable>
                        {option.image.trim() ? (
                          <View style={[qFormS.mediaRow, { marginTop: 8 }]}>
                            <SafeImage uri={resolveMediaUrl(option.image.trim())} style={qFormS.mediaThumb} resizeMode="cover" />
                            <Text style={qFormS.mediaName} numberOfLines={1}>{toMediaLabel(option.image, 'image', option.imageLabel)}</Text>
                            <Pressable onPress={() => requestMediaRemoval({ scope: 'option', mode, index, mediaType: 'image' })} style={qFormS.removeBtn}>
                              <Text style={qFormS.removeBtnText}>✕</Text>
                            </Pressable>
                          </View>
                        ) : null}
                        {option.audio.trim() ? (
                          <View style={[qFormS.mediaRow, { marginTop: 8 }]}>
                            <Text style={qFormS.audioIcon}>🎵</Text>
                            <Text style={[qFormS.mediaName, { flex: 1 }]} numberOfLines={1}>{toMediaLabel(option.audio, 'audio', option.audioLabel)}</Text>
                            <Pressable onPress={() => playAudioPreview(option.audio)} style={qFormS.playBtn}>
                              <Text style={qFormS.playBtnText}>▶</Text>
                            </Pressable>
                            <Pressable onPress={() => requestMediaRemoval({ scope: 'option', mode, index, mediaType: 'audio' })} style={qFormS.removeBtn}>
                              <Text style={qFormS.removeBtnText}>✕</Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </>
              )}
            </View>
          </ScrollView>
        )}

        {/* PAIRS TAB */}
        {questionFormTab === 'options' && hasPairs && (
          <ScrollView contentContainerStyle={qFormS.tabContent}>
            <View style={qFormS.secGroup}>
              <View style={qFormS.secHeader}>
                <Text style={qFormS.secTitle}>🔀 Match Pairs</Text>
                <Pressable style={qFormS.addBtn} onPress={() => addMatchPair(mode)}>
                  <Text style={qFormS.addBtnText}>+ Add</Text>
                </Pressable>
              </View>
              <Text style={qFormS.secHint}>Each pair: one draggable item ↔ one matching target.</Text>
              {draft.matchPairs.map((pair, index) => (
                <View key={`${mode}-pair-${index}`} style={qFormS.optBlock}>
                  <View style={qFormS.pairHeaderRow}>
                    <Text style={qFormS.pairNum}>Pair {index + 1}</Text>
                    <Pressable onPress={() => removeMatchPair(mode, index)} style={qFormS.removeBtnWide}>
                      <Text style={qFormS.removeBtnText}>✕ Remove</Text>
                    </Pressable>
                  </View>
                  <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
                    <View>
                      <Text style={qFormS.fieldLabel}>Item (draggable)</Text>
                      <TextInput value={pair.itemLabel}
                        onChangeText={(v) => updateMatchPair(mode, index, { itemLabel: v })}
                        placeholder="e.g. Lion" style={qFormS.optInput} placeholderTextColor="#B0B8D0" />
                    </View>
                    <View>
                      <Text style={qFormS.fieldLabel}>Target (matching)</Text>
                      <TextInput value={pair.targetLabel}
                        onChangeText={(v) => updateMatchPair(mode, index, { targetLabel: v })}
                        placeholder="e.g. Den" style={qFormS.optInput} placeholderTextColor="#B0B8D0" />
                    </View>
                    <Pressable style={qFormS.uploadBtn} onPress={() => uploadMediaForMatchPair(mode, index)}>
                      <Text style={qFormS.uploadBtnText}>⬆ Upload Image / Audio</Text>
                    </Pressable>
                    {pair.image.trim() ? (
                      <View style={qFormS.mediaRow}>
                        <SafeImage uri={resolveMediaUrl(pair.image.trim())} style={qFormS.mediaThumb} resizeMode="cover" />
                        <Text style={qFormS.mediaName} numberOfLines={1}>{toMediaLabel(pair.image, 'image', pair.imageLabel)}</Text>
                        <Pressable onPress={() => requestMediaRemoval({ scope: 'pair', mode, index, mediaType: 'image' })} style={qFormS.removeBtn}>
                          <Text style={qFormS.removeBtnText}>✕</Text>
                        </Pressable>
                      </View>
                    ) : null}
                    {pair.audio.trim() ? (
                      <View style={qFormS.mediaRow}>
                        <Text style={qFormS.audioIcon}>🎵</Text>
                        <Text style={[qFormS.mediaName, { flex: 1 }]} numberOfLines={1}>{toMediaLabel(pair.audio, 'audio', pair.audioLabel)}</Text>
                        <Pressable onPress={() => playAudioPreview(pair.audio)} style={qFormS.playBtn}>
                          <Text style={qFormS.playBtnText}>▶</Text>
                        </Pressable>
                        <Pressable onPress={() => requestMediaRemoval({ scope: 'pair', mode, index, mediaType: 'audio' })} style={qFormS.removeBtn}>
                          <Text style={qFormS.removeBtnText}>✕</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        {/* PREVIEW TAB */}
        {questionFormTab === 'preview' && (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <View style={qFormS.previewCard}>
              <View style={[qFormS.previewHero, { backgroundColor: QTYPES_BG[normalizedQuestionType] ?? '#D6EAFF' }]}>
                <Text style={{ fontSize: 42 }}>{QTYPES_EMOJI[normalizedQuestionType] ?? '❓'}</Text>
                <View style={{ flex: 1 }}>
                  <View style={[qFormS.previewTypeBadge, { backgroundColor: `${QTYPES_COLOR[normalizedQuestionType] ?? '#4A90E2'}25` }]}>
                    <Text style={[qFormS.previewTypeBadgeText, { color: QTYPES_COLOR[normalizedQuestionType] ?? '#4A90E2' }]}>
                      {getQuestionTypeLabel(draft.questionType)}
                    </Text>
                  </View>
                  <Text style={qFormS.previewTitle}>{draft.questionTitle || 'Untitled Question'}</Text>
                  {draft.classLevel ? <Text style={qFormS.previewMeta}>{getStandardLabel(draft.classLevel)} · {draft.subject}</Text> : null}
                </View>
              </View>
              <View style={qFormS.previewStats}>
                <View style={qFormS.previewStat}>
                  <Text style={qFormS.previewStatVal}>{draft.points || '–'}</Text>
                  <Text style={qFormS.previewStatLabel}>pts</Text>
                </View>
                <View style={qFormS.previewStat}>
                  <Text style={qFormS.previewStatVal}>{draft.timeLimitSeconds || '–'}s</Text>
                  <Text style={qFormS.previewStatLabel}>time</Text>
                </View>
                <View style={qFormS.previewStat}>
                  <Text style={qFormS.previewStatVal}>{hasOptions ? draft.options.length : hasPairs ? draft.matchPairs.length : '–'}</Text>
                  <Text style={qFormS.previewStatLabel}>{hasPairs ? 'pairs' : isLogicoMode ? 'maps' : 'opts'}</Text>
                </View>
              </View>
              {draft.questionInstruction ? (
                <View style={qFormS.previewInstBlock}>
                  <Text style={qFormS.previewInstText}>💬 {draft.questionInstruction}</Text>
                </View>
              ) : null}
              {draft.mainImage.trim() ? (
                <SafeImage uri={resolveMediaUrl(draft.mainImage.trim())} style={qFormS.previewImage} resizeMode="contain" />
              ) : null}
              {isLogicoMode ? (
                <View style={qFormS.logicoPreviewWrap}>
                  {Array.from({ length: 10 }, (_, index) => {
                    const slotId = index + 1;
                    const mapped = draft.options.find((option) => Number(option.slotPosition) === slotId);
                    return (
                      <View key={`logico-preview-slot-${slotId}`} style={qFormS.logicoPreviewRow}>
                        <Text style={qFormS.logicoPreviewSlotText}>{slotId}</Text>
                        <Text style={qFormS.logicoPreviewOptionText}>{mapped?.label || `Position ${slotId}`}</Text>
                        {mapped ? <LogicoButtonBadge buttonId={mapped.id} /> : <View style={qFormS.logicoPreviewEmptyButton} />}
                      </View>
                    );
                  })}
                </View>
              ) : hasOptions ? (
                draft.options.map((opt, i) => (
                  <View key={i} style={[qFormS.previewOptRow, opt.isCorrect && { borderColor: '#7DC67A', borderWidth: 1.5 }]}>
                    <View style={[qFormS.previewOptDot, { backgroundColor: opt.isCorrect ? '#7DC67A' : '#E0E4F0' }]}>
                      <Text style={{ color: opt.isCorrect ? '#fff' : '#9A9AB0', fontSize: 11, fontWeight: '800' }}>{i + 1}</Text>
                    </View>
                    <Text style={qFormS.previewOptText}>{opt.label || `Option ${i + 1}`}</Text>
                    {opt.isCorrect ? <Text style={qFormS.previewCorrectBadge}>✓</Text> : null}
                  </View>
                ))
              ) : null}
              {hasPairs && draft.matchPairs.map((pair, i) => (
                <View key={i} style={qFormS.previewPairRow}>
                  <Text style={qFormS.previewPairText}>{pair.itemLabel || `Item ${i + 1}`}</Text>
                  <Text style={{ color: '#9A9AB0', fontWeight: '700' }}>↔</Text>
                  <Text style={qFormS.previewPairText}>{pair.targetLabel || `Target ${i + 1}`}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
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
    <View style={{ flex: 1, backgroundColor: '#F5F7FF' }}>
      {/* ── Tab bar ── */}
      <View style={styles.newTabBar}>
        {(['topic', 'content', 'question', 'exam', 'quiz'] as LearningTab[]).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.newTab, activeLearningTab === tab && styles.newTabActive]}
            onPress={() => setActiveLearningTab(tab)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              {tab === 'topic'    && <FolderOpen size={13} color={activeLearningTab === tab ? '#4A90E2' : '#9A9AB0'} />}
              {tab === 'content'  && <Video size={13} color={activeLearningTab === tab ? '#4A90E2' : '#9A9AB0'} />}
              {tab === 'question' && <HelpCircle size={13} color={activeLearningTab === tab ? '#4A90E2' : '#9A9AB0'} />}
              {tab === 'exam'     && <BookOpenIcon size={13} color={activeLearningTab === tab ? '#4A90E2' : '#9A9AB0'} />}
              {tab === 'quiz'     && <TrophyIcon size={13} color={activeLearningTab === tab ? '#4A90E2' : '#9A9AB0'} />}
              <Text style={[styles.newTabText, activeLearningTab === tab && styles.newTabTextActive]}>
                {tab === 'topic' ? 'Topic' : tab === 'content' ? 'Content' : tab === 'question' ? 'Questions' : tab === 'exam' ? 'Exam' : 'Quiz'}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      {activeLearningTab === 'topic' ? (
        <TopicsTab
          topics={topics}
          loading={loadingTopics}
          filters={contentFilters}
          contentItems={contentItems}
          apiFetch={apiFetch}
          onFiltersChange={(f) => setContentFilters(f)}
          onApplyFilters={loadTopics}
          onTopicAction={(topic, action) => {
            if (action === 'delete') runTopicAction(topic, 'delete');
          }}
          onRefresh={() => { loadTopics(); loadContentItems(); }}
          onUploadCover={async () => {
            const picked = await pickImageAsDataUrl();
            const uploaded = await uploadPickedFileToS3(picked, 'image');
            return uploaded.url;
          }}
          message={message}
        />
      ) : null}
      {(false as boolean) && activeLearningTab === ('topic_legacy' as LearningTab) ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Content Filters</Text>
            <View style={styles.row}>
              <Pressable style={[styles.selectorInput, styles.halfInput]} onPress={() => setContentSelectorField('contentFilterClassLevel')}>
                <Text style={contentFilters.classLevel ? styles.selectorText : styles.selectorPlaceholder}>
                  {contentFilters.classLevel ? getStandardLabel(contentFilters.classLevel) : 'Standard'}
                </Text>
              </Pressable>
              <Pressable style={[styles.selectorInput, styles.halfInput]} onPress={() => setContentSelectorField('contentFilterSubject')}>
                <Text style={contentFilters.subject ? styles.selectorText : styles.selectorPlaceholder}>
                  {contentFilters.subject || 'Subject'}
                </Text>
              </Pressable>
            </View>
            <View style={styles.row}>
              <Pressable style={[styles.secondaryButton, styles.halfInput]} onPress={loadTopics} disabled={loadingTopics}>
                {loadingTopics ? <ActivityIndicator color="#1d4ed8" /> : <Text style={styles.secondaryButtonText}>Apply Filters</Text>}
              </Pressable>
              <Pressable style={[styles.primaryButton, styles.halfInput]} onPress={openCreateTopicDialog}>
                <Text style={styles.primaryButtonText}>Create Topic</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Topics ({topics.length})</Text>
            {loadingTopics ? (
              <ActivityIndicator size="small" color="#1d4ed8" />
            ) : topics.length === 0 ? (
              <Text style={styles.emptyText}>No topics found for selected filters.</Text>
            ) : (
              <>
                <ScrollView horizontal>
                  <View>
                    <View style={[styles.tableRow, styles.tableHeader]}>
                      <Text style={[styles.tableCell, styles.colStandard]}>Standard</Text>
                      <Text style={[styles.tableCell, styles.colSubject]}>Subject</Text>
                      <Text style={[styles.tableCell, styles.colQuestion]}>Topic</Text>
                      <Text style={[styles.tableCell, styles.colCategory]}>Sections</Text>
                      <Text style={[styles.tableCell, styles.colActions]}>Actions</Text>
                    </View>
                    {topics.slice(topicPage * 20, (topicPage + 1) * 20).map((topic) => (
                      <View key={topic.id} style={styles.tableRow}>
                        <Text style={[styles.tableCell, styles.colStandard]}>{getStandardLabel(topic.classLevel)}</Text>
                        <Text style={[styles.tableCell, styles.colSubject]}>{topic.subject}</Text>
                        <Text style={[styles.tableCell, styles.colQuestion]} numberOfLines={2}>
                          {topic.title}
                        </Text>
                        <Text style={[styles.tableCell, styles.colCategory]}>{topic.sectionCount}</Text>
                        <View style={[styles.colActions, styles.actionsCell]}>
                          <Pressable style={styles.topicActionsTrigger} onPress={() => setTopicActionMenuTopic(topic)}>
                            <Text style={styles.topicActionsTriggerText}>Actions</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
                {renderPagination(topicPage, topics.length, 20, setTopicPage)}
              </>
            )}
          </View>

        </>
      ) : null}

      {activeLearningTab === 'content' ? (
        <ContentTab
          contentItems={contentItems}
          loadingContent={loadingContentItems}
          deletingContentId={deletingContentId}
          filters={{ classLevel: contentFilters.classLevel, subject: contentFilters.subject }}
          topics={topics.map((t) => ({ id: t.id, title: t.title, classLevel: t.classLevel, subject: t.subject }))}
          apiFetch={apiFetch}
          onFiltersChange={(f) => setContentFilters((p) => ({ ...p, ...f }))}
          onApplyFilters={loadContentItems}
          onDeleteContent={(id) => deleteContentItem(id)}
          onRefresh={() => { loadContentItems(); loadTopics(); }}
          onUploadMedia={async (_draftId) => {
            const picked = await pickFileAsDataUrl(
              'image/*,audio/*,video/*',
              'Media upload is currently available on web. On mobile, provide URL-based content.',
            );
            const lm = picked.mimeType.toLowerCase();
            const ln = picked.fileName.toLowerCase();
            const mediaType: 'image' | 'audio' | 'video' = lm.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv)$/.test(ln)
              ? 'video'
              : lm.startsWith('audio/') || /\.(mp3|wav|ogg|aac|m4a|flac)$/.test(ln)
                ? 'audio'
                : 'image';
            const uploaded = await uploadPickedFileToS3(picked, mediaType);
            const contentType: 'reel_url' | 'audio' | 'image' | 'youtube_url' | 'text' =
              mediaType === 'video' ? 'reel_url' : mediaType === 'audio' ? 'audio' : 'image';
            return { url: uploaded.url, contentType };
          }}
          message={message}
        />
      ) : null}
      {(false as boolean) && activeLearningTab === ('content_legacy' as LearningTab) ? (
        <>
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.cardTitle}>Content Workspace</Text>
              <View style={styles.inlineActions}>
                <Pressable
                  style={[styles.secondaryButton, contentModeTab === 'create' && styles.tabButtonActive]}
                  onPress={() => setContentModeTab('create')}
                >
                  <Text style={styles.secondaryButtonText}>Create Content</Text>
                </Pressable>
                <Pressable
                  style={[styles.secondaryButton, contentModeTab === 'assign' && styles.tabButtonActive]}
                  onPress={() => setContentModeTab('assign')}
                >
                  <Text style={styles.secondaryButtonText}>Assign Content</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {contentModeTab === 'create' ? (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Create Content</Text>
                <Text style={styles.metaText}>Use dialog-based content creation.</Text>
                <Pressable style={styles.primaryButton} onPress={openCreateContentModal}>
                  <Text style={styles.primaryButtonText}>Create Content</Text>
                </Pressable>
              </View>
              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.cardTitle}>Contents ({contentItems.length})</Text>
                  <Pressable style={styles.secondaryButton} onPress={loadContentItems} disabled={loadingContentItems}>
                    {loadingContentItems ? <ActivityIndicator color="#1d4ed8" /> : <Text style={styles.secondaryButtonText}>Refresh</Text>}
                  </Pressable>
                </View>
                {loadingContentItems ? (
                  <ActivityIndicator size="small" color="#1d4ed8" />
                ) : contentItems.length === 0 ? (
                  <Text style={styles.emptyText}>No content created yet.</Text>
                ) : (
                  <>
                    <ScrollView horizontal>
                      <View>
                        <View style={[styles.tableRow, styles.tableHeader]}>
                          <Text style={[styles.tableCell, styles.colStandard]}>Standard</Text>
                          <Text style={[styles.tableCell, styles.colSubject]}>Subject</Text>
                          <Text style={[styles.tableCell, styles.colQuestion]}>Title</Text>
                          <Text style={[styles.tableCell, styles.colCategory]}>Type</Text>
                          <Text style={[styles.tableCell, styles.colCategory]}>Sections</Text>
                          <Text style={[styles.tableCell, styles.colActions]}>Actions</Text>
                        </View>
                        {contentItems.slice(contentPage * 20, (contentPage + 1) * 20).map((item) => (
                          <View key={item.id} style={styles.tableRow}>
                            <Text style={[styles.tableCell, styles.colStandard]}>{getStandardLabel(item.classLevel)}</Text>
                            <Text style={[styles.tableCell, styles.colSubject]}>{item.subject}</Text>
                            <Text style={[styles.tableCell, styles.colQuestion]} numberOfLines={2}>{item.title}</Text>
                            <Text style={[styles.tableCell, styles.colCategory]}>{item.contentType}</Text>
                            <Text style={[styles.tableCell, styles.colCategory]}>{item.sectionCount || 1}</Text>
                            <View style={[styles.colActions, styles.actionsCell]}>
                              <Pressable style={styles.topicActionsTrigger} onPress={() => setContentLibraryActionItem(item)}>
                                <Text style={styles.topicActionsTriggerText}>Actions</Text>
                              </Pressable>
                            </View>
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                    {renderPagination(contentPage, contentItems.length, 20, setContentPage)}
                  </>
                )}
              </View>
            </>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Assign Filters</Text>
                <View style={styles.row}>
                  <Pressable
                    style={[styles.selectorInput, styles.halfInput]}
                    onPress={() => setContentSelectorField('contentFilterClassLevel')}
                  >
                    <Text style={contentItemFilters.classLevel ? styles.selectorText : styles.selectorPlaceholder}>
                      {contentItemFilters.classLevel ? getStandardLabel(contentItemFilters.classLevel) : 'Standard'}
                    </Text>
                  </Pressable>
                  <Pressable style={[styles.selectorInput, styles.halfInput]} onPress={() => setContentSelectorField('contentFilterSubject')}>
                    <Text style={contentItemFilters.subject ? styles.selectorText : styles.selectorPlaceholder}>
                      {contentItemFilters.subject || 'Subject'}
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Filter Topic</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.typeChipRow}>
                      <Pressable
                        style={[styles.typeChip, !contentItemFilters.topicId && styles.typeChipActive]}
                        onPress={() => setContentItemFilters((current) => ({ ...current, topicId: '' }))}
                      >
                        <Text style={[styles.typeChipText, !contentItemFilters.topicId && styles.typeChipTextActive]}>All Topics</Text>
                      </Pressable>
                      {topics.map((topic) => {
                        const selected = contentItemFilters.topicId === topic.id;
                        return (
                          <Pressable
                            key={`filter-topic-${topic.id}`}
                            style={[styles.typeChip, selected && styles.typeChipActive]}
                            onPress={() => setContentItemFilters((current) => ({ ...current, topicId: topic.id }))}
                          >
                            <Text style={[styles.typeChipText, selected && styles.typeChipTextActive]}>{topic.title}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
                <Pressable style={styles.secondaryButton} onPress={loadContentItems} disabled={loadingContentItems}>
                  {loadingContentItems ? <ActivityIndicator color="#1d4ed8" /> : <Text style={styles.secondaryButtonText}>Apply Filters</Text>}
                </Pressable>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Select Contents ({selectedAssignContentIds.length})</Text>
                <View style={styles.fieldGroup}>
                  <View style={styles.row}>
                    <Pressable
                      style={[styles.selectorInput, styles.halfInput]}
                      onPress={() => setContentSelectorField('assignTargetClassLevel')}
                    >
                      <Text style={assignTopicFilters.classLevel ? styles.selectorText : styles.selectorPlaceholder}>
                        {assignTopicFilters.classLevel ? getStandardLabel(assignTopicFilters.classLevel) : 'Target Standard'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.selectorInput, styles.halfInput]}
                      onPress={() => setContentSelectorField('assignTargetSubject')}
                    >
                      <Text style={assignTopicFilters.subject ? styles.selectorText : styles.selectorPlaceholder}>
                        {assignTopicFilters.subject || 'Target Subject'}
                      </Text>
                    </Pressable>
                  </View>
                  <TextInput
                    value={assignTopicFilters.search}
                    onChangeText={(value) => setAssignTopicFilters((current) => ({ ...current, search: value }))}
                    placeholder="Search target topic"
                    style={styles.input}
                  />
                  <View style={styles.topicSelectList}>
                    {assignTargetTopicOptions.length === 0 ? (
                      <Text style={styles.emptyText}>No target topics found.</Text>
                    ) : (
                      assignTargetTopicOptions.map((topic) => {
                        const selected = assignTargetTopicId === topic.id;
                        return (
                          <Pressable
                            key={`assign-topic-${topic.id}`}
                            style={[styles.topicSelectCard, selected && styles.topicSelectCardActive]}
                            onPress={() => setAssignTargetTopicId(topic.id)}
                          >
                            <Text style={[styles.optionTitle, selected && styles.typeChipTextActive]}>{topic.title}</Text>
                            <Text style={styles.metaText}>
                              {topic.classLevel} • {topic.subject}
                            </Text>
                          </Pressable>
                        );
                      })
                    )}
                  </View>
                </View>
                {contentItems.map((item) => {
                  const selected = selectedAssignContentIds.includes(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.optionCard, selected && styles.topicSelectCardActive]}
                      onPress={() => toggleAssignContent(item.id)}
                    >
                      <View style={styles.cardHeaderRow}>
                        <Text style={styles.optionTitle}>{item.title}</Text>
                        <Text style={selected ? styles.typeChipTextActive : styles.metaText}>{selected ? 'Selected' : 'Select'}</Text>
                      </View>
                      <Text style={styles.metaText}>
                        {item.classLevel} • {item.subject} • {item.contentType}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable style={styles.primaryButton} onPress={assignContentsToTopic} disabled={savingAssignments}>
                  {savingAssignments ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Assign Selected Content</Text>}
                </Pressable>
              </View>
            </>
          )}
        </>
      ) : null}

      {activeLearningTab === 'question' ? (
        <QuestionsTab
          questions={questions}
          loading={loading}
          deletingQuestionId={deletingQuestionId}
          filters={filters}
          apiFetch={apiFetch}
          onFiltersChange={(patch) => setFilters((p) => ({ ...p, ...patch }))}
          onApplyFilters={loadData}
          onOpenCreate={openCreateDialog}
          onQuestionAction={(q, action) => {
            if (action === 'edit') { openEditDialog(q as QuestionItem); }
            else if (action === 'delete') { deleteQuestion(q.id); }
          }}
          message={message}
        />
      ) : null}
      {(false as boolean) && activeLearningTab === ('question_legacy' as LearningTab) ? (
        <>
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
                  {filters.classLevel ? getStandardLabel(filters.classLevel) : 'Standard'}
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
              <>
                <ScrollView horizontal>
                  <View>
                    <View style={[styles.tableRow, styles.tableHeader]}>
                      <Text style={[styles.tableCell, styles.colStandard]}>Standard</Text>
                      <Text style={[styles.tableCell, styles.colSubject]}>Subject</Text>
                      <Text style={[styles.tableCell, styles.colCategory]}>Question Type</Text>
                      <Text style={[styles.tableCell, styles.colQuestion]}>Question</Text>
                      <Text style={[styles.tableCell, styles.colActions]}>Actions</Text>
                    </View>
                    {questions.slice(questionPage * 20, (questionPage + 1) * 20).map((question) => (
                      <View key={question.id} style={styles.tableRow}>
                        <Text style={[styles.tableCell, styles.colStandard]}>{getStandardLabel(question.class_level)}</Text>
                        <Text style={[styles.tableCell, styles.colSubject]}>{question.subject || '-'}</Text>
                        <Text style={[styles.tableCell, styles.colCategory]}>{getQuestionTypeLabel(question.question_type)}</Text>
                        <Text style={[styles.tableCell, styles.colQuestion]} numberOfLines={2}>
                          {question.question_title || 'Untitled'}
                        </Text>
                        <View style={[styles.colActions, styles.actionsCell]}>
                          <Pressable style={styles.topicActionsTrigger} onPress={() => setQuestionActionItem(question)}>
                            <Text style={styles.topicActionsTriggerText}>Actions</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
                {renderPagination(questionPage, questions.length, 20, setQuestionPage)}
              </>
            )}
          </View>
        </>
      ) : null}

      {activeLearningTab === 'exam' ? (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Exam Workspace</Text>
            <Text style={styles.metaText}>Exam flow can be aligned with content topics in the next step.</Text>
            <Pressable style={styles.primaryButton} onPress={() => router.push('/exam')}>
              <Text style={styles.primaryButtonText}>Open Exam Builder</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : null}

      {activeLearningTab === 'quiz' ? (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Quiz Workspace</Text>
            <Text style={styles.metaText}>Build and manage quizzes here.</Text>
            <Pressable style={styles.primaryButton} onPress={() => router.push('/exam')}>
              <Text style={styles.primaryButtonText}>Open Quiz Builder</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : null}

      {/* Topic details modal is now handled inside TopicsTab component */}

      <Modal
        visible={topicActionMenuTopic !== null}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => setTopicActionMenuTopic(null)}
      >
        <Pressable style={styles.actionMenuOverlay} onPress={() => setTopicActionMenuTopic(null)}>
          <Pressable style={styles.actionMenuCard} onPress={() => {}}>
            <Text style={styles.actionMenuTitle}>Actions</Text>
            {topicActionMenuTopic ? (
              <Text style={styles.actionMenuMeta}>
                {topicActionMenuTopic.title} • {topicActionMenuTopic.classLevel} • {topicActionMenuTopic.subject}
              </Text>
            ) : null}
            <Pressable style={styles.actionMenuItem} onPress={() => topicActionMenuTopic && runTopicAction(topicActionMenuTopic, 'details')}>
              <Text style={styles.actionMenuItemText}>View Details</Text>
            </Pressable>
            <Pressable style={styles.actionMenuItem} onPress={() => topicActionMenuTopic && runTopicAction(topicActionMenuTopic, 'create_content')}>
              <Text style={styles.actionMenuItemText}>Create Content</Text>
            </Pressable>
            <Pressable style={styles.actionMenuItem} onPress={() => topicActionMenuTopic && runTopicAction(topicActionMenuTopic, 'assign_quiz')}>
              <Text style={styles.actionMenuItemText}>Assign Quizzes</Text>
            </Pressable>
            <Pressable style={styles.actionMenuItem} onPress={() => topicActionMenuTopic && runTopicAction(topicActionMenuTopic, 'edit')}>
              <Text style={styles.actionMenuItemText}>Edit Topic</Text>
            </Pressable>
            <Pressable
              style={styles.actionMenuItem}
              onPress={() => topicActionMenuTopic && runTopicAction(topicActionMenuTopic, 'delete')}
              disabled={!!deletingTopicId}
            >
              {deletingTopicId ? <ActivityIndicator color="#dc2626" /> : <Text style={styles.actionMenuDangerText}>Delete Topic</Text>}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={topicContentActionItem !== null}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => setTopicContentActionItem(null)}
      >
        <Pressable style={styles.actionMenuOverlay} onPress={() => setTopicContentActionItem(null)}>
          <Pressable style={styles.actionMenuCard} onPress={() => {}}>
            <Text style={styles.actionMenuTitle}>Actions</Text>
            <Pressable
              style={styles.actionMenuItem}
              onPress={() => {
                if (!topicContentActionItem) return;
                openPreviewContentModal(topicContentActionItem);
                setTopicContentActionItem(null);
              }}
            >
              <Text style={styles.actionMenuItemText}>Preview</Text>
            </Pressable>
            <Pressable
              style={styles.actionMenuItem}
              onPress={() => {
                if (!topicContentActionItem) return;
                openEditContentModal(topicContentActionItem);
                setTopicContentActionItem(null);
              }}
            >
              <Text style={styles.actionMenuItemText}>Edit</Text>
            </Pressable>
            <Pressable
              style={styles.actionMenuItem}
              onPress={async () => {
                if (!topicContentActionItem) return;
                await removeContentAssignment(topicContentActionItem.id);
                setTopicContentActionItem(null);
              }}
            >
              <Text style={styles.actionMenuDangerText}>Remove</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={contentLibraryActionItem !== null}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => setContentLibraryActionItem(null)}
      >
        <Pressable style={styles.actionMenuOverlay} onPress={() => setContentLibraryActionItem(null)}>
          <Pressable style={styles.actionMenuCard} onPress={() => {}}>
            <Text style={styles.actionMenuTitle}>Actions</Text>
            <Pressable
              style={styles.actionMenuItem}
              onPress={() => {
                if (!contentLibraryActionItem) return;
                openPreviewContentModal(contentLibraryActionItem);
                setContentLibraryActionItem(null);
              }}
            >
              <Text style={styles.actionMenuItemText}>Preview</Text>
            </Pressable>
            <Pressable
              style={styles.actionMenuItem}
              onPress={() => {
                if (!contentLibraryActionItem) return;
                openEditContentModal(contentLibraryActionItem);
                setContentLibraryActionItem(null);
              }}
            >
              <Text style={styles.actionMenuItemText}>Edit</Text>
            </Pressable>
            <Pressable
              style={styles.actionMenuItem}
              onPress={async () => {
                if (!contentLibraryActionItem) return;
                await deleteContentItem(contentLibraryActionItem.id);
                setContentLibraryActionItem(null);
              }}
              disabled={!!deletingContentId}
            >
              {deletingContentId ? <ActivityIndicator color="#dc2626" /> : <Text style={styles.actionMenuDangerText}>Delete</Text>}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={questionActionItem !== null}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => setQuestionActionItem(null)}
      >
        <Pressable style={styles.actionMenuOverlay} onPress={() => setQuestionActionItem(null)}>
          <Pressable style={styles.actionMenuCard} onPress={() => {}}>
            <Text style={styles.actionMenuTitle}>Actions</Text>
            <Pressable
              style={styles.actionMenuItem}
              onPress={() => {
                if (!questionActionItem) return;
                setPreviewQuestion(questionActionItem);
                setQuestionActionItem(null);
              }}
            >
              <Text style={styles.actionMenuItemText}>View</Text>
            </Pressable>
            <Pressable
              style={styles.actionMenuItem}
              onPress={() => {
                if (!questionActionItem) return;
                openEditDialog(questionActionItem);
                setQuestionActionItem(null);
              }}
            >
              <Text style={styles.actionMenuItemText}>Edit</Text>
            </Pressable>
            <Pressable
              style={styles.actionMenuItem}
              onPress={async () => {
                if (!questionActionItem) return;
                await deleteQuestion(questionActionItem.id);
                setQuestionActionItem(null);
              }}
              disabled={!!deletingQuestionId}
            >
              {deletingQuestionId ? <ActivityIndicator color="#dc2626" /> : <Text style={styles.actionMenuDangerText}>Delete</Text>}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Assign quiz modal is now handled inside TopicsTab component */}

      <Modal
        visible={isCreateContentDialogOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsCreateContentDialogOpen(false);
          setEditingContentId(null);
        }}
      >
        <Pressable
          style={styles.dialogOverlay}
          onPress={() => {
            setIsCreateContentDialogOpen(false);
            setEditingContentId(null);
          }}
        >
          <Pressable style={styles.dialogCard} onPress={() => {}}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>{editingContentId ? 'Edit Content' : 'Create Content'}</Text>
            </View>
            <ScrollView style={styles.dialogScroll} contentContainerStyle={styles.dialogScrollContent}>
              <View style={styles.row}>
                <Pressable
                  style={[styles.selectorInput, styles.halfInput]}
                  onPress={() => setContentSelectorField('contentFilterClassLevel')}
                >
                  <Text style={contentCreateMeta.classLevel ? styles.selectorText : styles.selectorPlaceholder}>
                    {contentCreateMeta.classLevel ? getStandardLabel(contentCreateMeta.classLevel) : 'Standard'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.selectorInput, styles.halfInput]}
                  onPress={() => setContentSelectorField('contentFilterSubject')}
                >
                  <Text style={contentCreateMeta.subject ? styles.selectorText : styles.selectorPlaceholder}>
                    {contentCreateMeta.subject || 'Subject'}
                  </Text>
                </Pressable>
              </View>
              {!editingContentId ? (
                <>
                  <TextInput
                    value={createTopicSearch}
                    onChangeText={setCreateTopicSearch}
                    placeholder="Search topic by name"
                    style={styles.input}
                  />
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Topic *</Text>
                    <View style={styles.topicSelectList}>
                      {createContentTopicOptions.length === 0 ? (
                        <Text style={styles.emptyText}>No topics found for selected filters.</Text>
                      ) : (
                        createContentTopicOptions.map((topic) => {
                          const selected = contentCreateMeta.topicId === topic.id;
                          return (
                            <Pressable
                              key={topic.id}
                              style={[styles.topicSelectCard, selected && styles.topicSelectCardActive]}
                              onPress={() => setContentCreateMeta((current) => ({ ...current, topicId: topic.id }))}
                            >
                              <Text style={[styles.optionTitle, selected && styles.typeChipTextActive]}>{topic.title}</Text>
                              <Text style={styles.metaText}>
                                {topic.classLevel} • {topic.subject}
                              </Text>
                            </Pressable>
                          );
                        })
                      )}
                    </View>
                  </View>
                </>
              ) : null}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Content Title *</Text>
                <TextInput
                  value={contentCreateMeta.title}
                  onChangeText={(value) => setContentCreateMeta((current) => ({ ...current, title: value }))}
                  placeholder="Enter content title"
                  style={styles.input}
                />
              </View>
              <View style={styles.sectionHeader}>
                <Text style={styles.fieldLabel}>Sections</Text>
                <Pressable style={styles.smallButton} onPress={addCreateSection}>
                  <Text style={styles.smallButtonText}>+ Add Section</Text>
                </Pressable>
              </View>
              {contentCreateSections.map((section, index) => {
                const activeChoice = getCreateSectionChoiceValue(section.contentType);
                return (
                  <View key={section.id} style={styles.optionCard}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={styles.optionTitle}>Section {index + 1}</Text>
                      <Pressable style={styles.inlineRemoveButton} onPress={() => removeCreateSection(section.id)}>
                        <Text style={styles.inlineRemoveButtonText}>Remove</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.fieldLabel}>Section Title (Optional)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Introduction"
                      value={section.title || ''}
                      onChangeText={(val) => updateCreateSection(section.id, { title: val })}
                    />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.typeChipRow}>
                        {CREATE_CONTENT_TYPE_CHOICES.map((choice) => {
                          const selected = activeChoice === choice.value;
                          return (
                            <Pressable
                              key={`${section.id}-${choice.value}`}
                              style={[styles.typeChip, selected && styles.typeChipActive]}
                              onPress={() =>
                                updateCreateSection(section.id, { contentType: choice.value === 'media' ? 'image' : choice.value })
                              }
                            >
                              <Text style={[styles.typeChipText, selected && styles.typeChipTextActive]}>{choice.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </ScrollView>

                    {activeChoice === 'text' ? (
                      <TextInput
                        value={section.textContent}
                        onChangeText={(value) => updateCreateSection(section.id, { textContent: value })}
                        placeholder="Enter content text"
                        multiline
                        style={[styles.input, styles.richTextInput]}
                      />
                    ) : activeChoice === 'youtube_url' || activeChoice === 'reel_url' ? (
                      <TextInput
                        value={section.externalUrl}
                        onChangeText={(value) => updateCreateSection(section.id, { externalUrl: value })}
                        placeholder="Enter URL"
                        autoCapitalize="none"
                        style={styles.input}
                      />
                    ) : (
                      <View style={styles.fieldGroup}>
                        <Pressable style={styles.secondaryButton} onPress={() => uploadCreateContentMedia(section.id)}>
                          {uploadingSectionMediaId === section.id ? (
                            <ActivityIndicator color="#1d4ed8" />
                          ) : (
                            <Text style={styles.secondaryButtonText}>Upload Media (Image / Audio / Video)</Text>
                          )}
                        </Pressable>
                        {section.mediaUrl ? (
                          <Text style={styles.metaText}>{toMediaLabel(section.mediaUrl, 'media', section.mediaLabel)}</Text>
                        ) : null}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
            <View style={styles.dialogActions}>
              <Pressable
                style={[styles.secondaryButton, styles.halfInput]}
                onPress={() => {
                  setIsCreateContentDialogOpen(false);
                  setEditingContentId(null);
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.primaryButton, styles.halfInput]} onPress={createSingleContentItem} disabled={savingContentCreate}>
                {savingContentCreate ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{editingContentId ? 'Save' : 'Create Content'}</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={previewQuiz !== null} transparent animationType="fade" onRequestClose={() => setPreviewQuiz(null)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Quiz Preview</Text>
            {previewQuiz ? (
              <ScrollView style={styles.selectorList}>
                <Text style={styles.previewTitle}>{previewQuiz.title}</Text>
                <Text style={styles.previewMeta}>
                  {previewQuiz.class_level || '-'} • {previewQuiz.subject || '-'} • {previewQuiz.quiz_type}
                </Text>
                <Text style={styles.previewMeta}>Questions: {previewQuiz.total_questions}</Text>
                <Text style={styles.previewMeta}>Status: {previewQuiz.is_published ? 'Published' : 'Draft'}</Text>
                <Text style={styles.previewMeta}>Created: {new Date(previewQuiz.created_at).toLocaleString()}</Text>
              </ScrollView>
            ) : null}
            <Pressable style={styles.primaryButton} onPress={() => setPreviewQuiz(null)}>
              <Text style={styles.primaryButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={previewContentItem !== null} transparent animationType="fade" onRequestClose={() => setPreviewContentItem(null)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Content Preview</Text>
            {previewContentItem ? (
              <ScrollView style={styles.selectorList}>
                <Text style={styles.previewTitle}>{previewContentItem.title}</Text>
                <Text style={styles.previewMeta}>
                  {previewContentItem.classLevel} • {previewContentItem.subject} • {(previewContentItem.sectionCount || previewContentItem.sections?.length || 1)} sections
                </Text>
                {(previewContentItem.sections || []).map((section, index) => (
                  <View key={`preview-content-section-${section.id}-${index}`} style={styles.previewMediaCard}>
                    <Text style={styles.previewMediaLabel}>{section.title ? `${section.title} — ` : `Section ${section.sectionOrder || index + 1} — `}{section.contentType}</Text>
                    {section.textContent ? <Text style={styles.previewInstruction}>{section.textContent}</Text> : null}
                    {section.externalUrl ? (() => {
                      const embedUrl = getYouTubeEmbedUrl(section.externalUrl);
                      if (embedUrl || isVideoContentType(section.contentType)) {
                        const src = embedUrl ?? (isVideoContentType(section.contentType) ? getYouTubeEmbedUrl(section.externalUrl) ?? section.externalUrl : section.externalUrl);
                        return embedUrl ? (
                          <WebView
                            source={{ uri: embedUrl }}
                            style={styles.previewVideoEmbed}
                            allowsFullscreenVideo
                            javaScriptEnabled
                          />
                        ) : (
                          <Text style={styles.previewMeta}>{section.externalUrl}</Text>
                        );
                      }
                      return <Text style={styles.previewMeta}>{section.externalUrl}</Text>;
                    })() : null}
                    {section.mediaUrl ? (
                      section.contentType === 'image' ? (
                        <SafeImage uri={resolveMediaUrl(section.mediaUrl)} style={styles.previewImage} resizeMode="contain" />
                      ) : isVideoContentType(section.contentType) ? (
                        (() => {
                          const embedUrl = getYouTubeEmbedUrl(section.mediaUrl);
                          return embedUrl ? (
                            <WebView source={{ uri: embedUrl }} style={styles.previewVideoEmbed} allowsFullscreenVideo javaScriptEnabled />
                          ) : (
                            <Text style={styles.previewMeta}>{section.mediaUrl}</Text>
                          );
                        })()
                      ) : (
                        <Text style={styles.previewMeta}>{section.mediaUrl}</Text>
                      )
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            ) : null}
            <Pressable style={styles.primaryButton} onPress={() => setPreviewContentItem(null)}>
              <Text style={styles.primaryButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <SelectorModal
        visible={contentSelectorField !== null}
        title={contentSelectorTitle}
        options={contentSelectorOptions.map((o) => ({ label: isContentStandardSelector ? getStandardLabel(o) : o, value: o }))}
        selected={''}
        isSubject={!isContentStandardSelector}
        onSelect={applyContentSelectorValue}
        onClose={() => setContentSelectorField(null)}
      />

      {/* Topic create/edit modal is now handled inside TopicsTab component */}

      <Modal visible={isSectionDialogOpen} transparent animationType="fade" onRequestClose={() => setIsSectionDialogOpen(false)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.dialogTitle}>Create Content Sections</Text>
              <Pressable style={styles.smallButton} onPress={addSectionDraft}>
                <Text style={styles.smallButtonText}>+ Add Section</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.dialogScroll} contentContainerStyle={styles.dialogScrollContent}>
              {sectionDrafts.map((section, index) => (
                <View key={section.id} style={styles.optionCard}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.optionTitle}>Section {index + 1}</Text>
                    <Pressable style={styles.inlineRemoveButton} onPress={() => removeSectionDraft(section.id)}>
                      <Text style={styles.inlineRemoveButtonText}>Remove</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.fieldLabel}>Section Title (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Introduction"
                    value={section.title || ''}
                    onChangeText={(val) => updateSectionDraft(section.id, { title: val })}
                  />

                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.typeChipRow}>
                      {CONTENT_TYPE_CHOICES.map((choice) => {
                        const selected = section.contentType === choice.value;
                        return (
                          <Pressable
                            key={`${section.id}-${choice.value}`}
                            style={[styles.typeChip, selected && styles.typeChipActive]}
                            onPress={() => updateSectionDraft(section.id, { contentType: choice.value })}
                          >
                            <Text style={[styles.typeChipText, selected && styles.typeChipTextActive]}>{choice.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>

                  {section.contentType === 'text' ? (
                    <TextInput
                      value={section.textContent}
                      onChangeText={(value) => updateSectionDraft(section.id, { textContent: value })}
                      placeholder="Enter rich text content"
                      multiline
                      style={[styles.input, styles.richTextInput]}
                    />
                  ) : null}

                  {section.contentType === 'youtube_url' || section.contentType === 'reel_url' ? (
                    <TextInput
                      value={section.externalUrl}
                      onChangeText={(value) => updateSectionDraft(section.id, { externalUrl: value })}
                      placeholder="Enter URL"
                      autoCapitalize="none"
                      style={styles.input}
                    />
                  ) : null}

                  {section.contentType === 'image' || section.contentType === 'audio' || section.contentType === 'reel' ? (
                    <View style={styles.fieldGroup}>
                      <View style={styles.mediaActionRow}>
                        <Pressable
                          style={[styles.secondaryButton, styles.mediaActionButton]}
                          onPress={() => uploadSectionMedia(section.id, section.contentType)}
                        >
                          {uploadingSectionMediaId === section.id ? (
                            <ActivityIndicator color="#1d4ed8" />
                          ) : (
                            <Text style={styles.secondaryButtonText}>
                              {section.contentType === 'image'
                                ? 'Upload Image'
                                : section.contentType === 'audio'
                                  ? 'Upload Audio'
                                  : 'Upload Reel'}
                            </Text>
                          )}
                        </Pressable>
                      </View>
                      {section.mediaUrl.trim() ? (
                        <View style={styles.previewCard}>
                          <View style={styles.previewHeader}>
                            <View style={styles.previewHeaderContent}>
                              <Text style={styles.mediaInfoLabel}>Selected Media</Text>
                              <Text style={styles.mediaInfoValue}>{toMediaLabel(section.mediaUrl, 'media')}</Text>
                            </View>
                            <Pressable
                              style={styles.previewRemoveButton}
                              onPress={() => updateSectionDraft(section.id, { mediaUrl: '', mediaLabel: '' })}
                            >
                              <Text style={styles.previewRemoveButtonText}>Remove</Text>
                            </Pressable>
                          </View>
                          {section.contentType === 'image' ? (
                            <SafeImage uri={resolveMediaUrl(section.mediaUrl)} style={styles.optionImagePreview} resizeMode="contain" />
                          ) : (
                            <Text style={styles.metaText}>{section.mediaLabel || section.mediaUrl}</Text>
                          )}
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              ))}
            </ScrollView>
            <View style={styles.dialogActions}>
              <Pressable style={[styles.secondaryButton, styles.halfInput]} onPress={() => setIsSectionDialogOpen(false)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.primaryButton, styles.halfInput]} onPress={saveTopicSections} disabled={savingSections}>
                {savingSections ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Save Content</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isCreateDialogOpen && activeLearningTab === 'question'} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setIsCreateDialogOpen(false)}>
        {renderDialogContent('create')}
      </Modal>

      <Modal visible={editingQuestionId !== null && activeLearningTab === 'question'} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setEditingQuestionId(null)}>
        {renderDialogContent('edit')}
      </Modal>

      <SelectorModal
        visible={selectorField !== null && activeLearningTab === 'question'}
        title={selectorTitle}
        options={selectorOptions.map((o) => ({ label: isQuestionStandardSelector ? getStandardLabel(o) : o, value: o }))}
        selected={''}
        isSubject={!isQuestionStandardSelector}
        onSelect={applySelectorValue}
        onClose={() => setSelectorField(null)}
      />

      <Modal visible={previewQuestion !== null && activeLearningTab === 'question'} transparent animationType="fade" onRequestClose={() => setPreviewQuestion(null)}>
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
                    <SafeImage uri={resolveMediaUrl(questionDataPromptImage(previewQuestion.question_data).trim())} style={styles.previewImage} resizeMode="contain" />
                  </View>
                ) : null}

                {normalizeQuestionType(previewQuestion.question_type) === 'logico' ? (
                  <View style={styles.previewMediaCard}>
                    <Text style={styles.previewMediaLabel}>Logico Mapping Preview</Text>
                    <View style={qFormS.logicoPreviewWrap}>
                      {Array.from({ length: 10 }, (_, index) => {
                        const slotId = index + 1;
                        const mapped = questionDataToLogicoOptions(previewQuestion.question_data).find((option) => option.slotPosition === slotId);
                        return (
                          <View key={`preview-logico-${slotId}`} style={qFormS.logicoPreviewRow}>
                            <Text style={qFormS.logicoPreviewSlotText}>{slotId}</Text>
                            <Text style={qFormS.logicoPreviewOptionText}>{mapped?.label || `Position ${slotId}`}</Text>
                            {mapped ? <LogicoButtonBadge buttonId={mapped.id} /> : <View style={qFormS.logicoPreviewEmptyButton} />}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ) : (
                  questionDataToOptions(previewQuestion.question_data)
                    .filter((option) => option.image.trim())
                    .map((option, index) => (
                      <View key={`preview-option-${index}`} style={styles.previewMediaCard}>
                        <Text style={styles.previewMediaLabel}>Option {index + 1}: {option.label || 'Untitled'}</Text>
                        <SafeImage uri={resolveMediaUrl(option.image.trim())} style={styles.previewImage} resizeMode="contain" />
                      </View>
                    ))
                )}

                {questionDataToMatchPairs(previewQuestion.question_data)
                  .filter((pair) => pair.image.trim())
                  .map((pair, index) => (
                    <View key={`preview-pair-${index}`} style={styles.previewMediaCard}>
                      <Text style={styles.previewMediaLabel}>
                        Pair {index + 1}: {pair.itemLabel || 'Item'} → {pair.targetLabel || 'Target'}
                      </Text>
                      <SafeImage uri={resolveMediaUrl(pair.image.trim())} style={styles.previewImage} resizeMode="contain" />
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
        visible={pendingMediaRemoval !== null && activeLearningTab === 'question'}
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
        visible={pendingOptionRemoval !== null && activeLearningTab === 'question'}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    gap: 14,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingVertical: 9,
    alignItems: 'center',
  },
  tabButtonActive: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  tabButtonText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 12,
  },
  tabButtonTextActive: {
    color: '#1d4ed8',
  },
  // New tab bar (revamped)
  newTabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F8',
    paddingHorizontal: 4,
  },
  newTab: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  newTabActive: {
    borderBottomColor: '#4A90E2',
  },
  newTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9A9AB0',
  },
  newTabTextActive: {
    color: '#4A90E2',
    fontWeight: '800',
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
    padding: 14,
    gap: 12,
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
  richTextInput: {
    minHeight: 120,
    textAlignVertical: 'top',
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
    gap: 10,
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
    overflow: 'visible',
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
    width: 180,
  },
  actionsCell: {
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'visible',
  },
  topicActionsTrigger: {
    borderWidth: 1,
    borderColor: '#f5b66c',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  topicActionsTriggerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d97706',
  },
  actionMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  actionMenuCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 10,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  actionMenuTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    paddingHorizontal: 8,
    paddingTop: 2,
  },
  actionMenuMeta: {
    fontSize: 12,
    color: '#64748b',
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  actionMenuItem: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  actionMenuItemText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  actionMenuDangerText: {
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '600',
  },
  deleteButtonText: {
    color: '#b91c1c',
    fontWeight: '700',
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    padding: 20,
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
  topicDialogCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  topicDialogBody: {
    padding: 16,
    gap: 12,
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
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  confirmCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 12,
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
    marginBottom: 10,
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
  previewVideoEmbed: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#000',
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
    marginTop: 6,
    gap: 14,
  },
  topicDetailHeader: {
    flexDirection: 'column',
    gap: 10,
    marginBottom: 2,
  },
  topicDetailTitleRow: {
    flex: 1,
    minWidth: 0,
  },
  topicDetailActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  inlineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  topicCoverImage: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#e2e8f0',
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
    gap: 10,
  },
  topicSelectList: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 10,
    backgroundColor: '#f8fbff',
    padding: 10,
    gap: 8,
    maxHeight: 240,
  },
  topicSelectCard: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  topicSelectCardActive: {
    borderColor: '#60a5fa',
    backgroundColor: '#eff6ff',
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
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    marginTop: 8,
  },
  paginationButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  paginationButtonDisabled: {
    borderColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
  },
  paginationButtonText: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '600',
  },
  paginationButtonTextDisabled: {
    color: '#94a3b8',
  },
  paginationText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  metaText: {
    fontSize: 12,
    color: '#64748b',
  },
});

// ── Question form full-screen styles ──────────────────────────────────────────
const qFormS = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: '#F5F7FF' },
  header:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  backBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backArrow:{ fontSize: 28, color: '#1a1a2e', fontWeight: '300', lineHeight: 34 },
  titleText:{ fontSize: 17, fontWeight: '900', color: '#1a1a2e' },
  subTitle: { fontSize: 11, color: '#9A9AB0', fontWeight: '600', marginTop: 2 },
  saveBtn:  { backgroundColor: '#4A90E2', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText:{ color: '#fff', fontWeight: '800', fontSize: 13 },

  tabBar:        { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  tab:           { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:     { borderBottomColor: '#4A90E2' },
  tabText:       { fontSize: 13, fontWeight: '600', color: '#9A9AB0' },
  tabTextActive: { color: '#4A90E2', fontWeight: '800' },

  toast:            { marginHorizontal: 16, marginTop: 8, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#E0E4F0', backgroundColor: '#F0F4FF' },
  toastText:        { fontSize: 13, fontWeight: '600', color: '#1a1a2e', textAlign: 'center' },
  toastError:       { backgroundColor: '#FFE8E8', borderColor: '#FF7043' },
  toastErrorText:   { color: '#B91C1C' },
  toastSuccess:     { backgroundColor: '#D6F5D6', borderColor: '#7DC67A' },
  toastSuccessText: { color: '#1A6B1A' },

  tabContent: { padding: 16, gap: 16, paddingBottom: 40 },
  group:      { gap: 8 },
  groupLabel: { fontSize: 10, fontWeight: '800', color: '#9A9AB0', letterSpacing: 1, textTransform: 'uppercase', paddingLeft: 4 },
  fieldCard:  { backgroundColor: '#fff', borderRadius: 16, padding: 14, gap: 10, shadowColor: '#1a1a2e', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#9A9AB0', textTransform: 'uppercase', letterSpacing: 0.5 },
  input:      { fontSize: 14, color: '#1a1a2e', fontWeight: '500', paddingVertical: 6 },
  divider:    { height: 1, backgroundColor: '#F0F0F8' },
  selectorRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  selectorVal:{ fontSize: 14, color: '#1a1a2e', fontWeight: '500' },
  selectorPlaceholder: { fontSize: 14, color: '#B0B8D0' },
  twoCol:     { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  colDivider: { width: 1, backgroundColor: '#F0F0F8', alignSelf: 'stretch', marginVertical: 4 },

  qtypeChip:  { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#F0F0F8', borderWidth: 1.5, borderColor: 'transparent' },
  qtypeEmoji: { fontSize: 16 },
  qtypeLabel: { fontSize: 12, fontWeight: '600', color: '#9A9AB0' },
  qtypeDesc:  { fontSize: 12, color: '#9A9AB0', fontStyle: 'italic', lineHeight: 18, paddingTop: 4 },

  uploadBtn:     { borderRadius: 8, borderWidth: 1, borderColor: '#D6EAFF', backgroundColor: '#F5F9FF', paddingVertical: 10, alignItems: 'center' },
  uploadBtnText: { fontSize: 13, fontWeight: '700', color: '#4A90E2' },
  mediaRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  mediaThumb:    { width: 56, height: 44, borderRadius: 8, backgroundColor: '#F0F0F8' },
  mediaName:     { fontSize: 12, color: '#9A9AB0', fontWeight: '500' },
  audioIcon:     { fontSize: 22 },
  playBtn:       { borderRadius: 8, backgroundColor: '#D6EAFF', paddingHorizontal: 10, paddingVertical: 6 },
  playBtnText:   { fontSize: 12, fontWeight: '700', color: '#1A4DA2' },
  removeBtn:     { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FFE8E8', alignItems: 'center', justifyContent: 'center' },
  removeBtnWide: { borderRadius: 8, backgroundColor: '#FFE8E8', paddingHorizontal: 10, paddingVertical: 6 },
  removeBtnText: { fontSize: 11, fontWeight: '800', color: '#FF7043' },

  secGroup:   { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  secHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F8' },
  secTitle:   { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  secHint:    { fontSize: 12, color: '#9A9AB0', paddingHorizontal: 14, paddingVertical: 8 },
  addBtn:     { backgroundColor: '#D6EAFF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  addBtnText: { fontSize: 12, fontWeight: '800', color: '#1A4DA2' },

  optBlock:       { borderBottomWidth: 1, borderBottomColor: '#F5F7FF' },
  optBlockHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 10 },
  optNumBadge:    { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E0E4F0', alignItems: 'center', justifyContent: 'center' },
  optNum:         { fontSize: 12, fontWeight: '800', color: '#9A9AB0' },
  optInput:       { fontSize: 14, color: '#1a1a2e', fontWeight: '500', backgroundColor: '#F8F9FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#ECEEF4' },
  correctBtn:     { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F0F0F8', alignItems: 'center', justifyContent: 'center' },
  correctBtnActive:{ backgroundColor: '#D6F5D6' },
  correctBtnText: { fontSize: 15, color: '#9A9AB0', fontWeight: '700' },
  correctBtnTextActive:{ color: '#7DC67A' },
  pairHeaderRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F7FF' },
  pairNum:        { fontSize: 13, fontWeight: '800', color: '#1a1a2e' },
  logicoWorksheetPreview:{ width: '100%', height: 180, borderRadius: 10, backgroundColor: '#F8FAFC', marginBottom: 10 },
  logicoBlockerBanner:{ backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10 },
  logicoBlockerText:{ fontSize: 12, fontWeight: '700', color: '#B91C1C' },
  logicoGrid:{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  logicoCard:{ width: '48%', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 10, gap: 8, backgroundColor: '#FFFFFF' },
  logicoButtonCell:{ gap: 8, alignItems: 'center', justifyContent: 'center' },
  logicoButtonLabel:{ fontSize: 12, fontWeight: '700', color: '#334155', textAlign: 'center' },
  logicoSlotCell: { gap: 4 },
  logicoSlotInput:{ fontSize: 14, color: '#1a1a2e', fontWeight: '700', backgroundColor: '#F8F9FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#ECEEF4', textAlign: 'center' },
  logicoLabelCell:{ flex: 1, gap: 4 },
  logicoButtonCircle:{ borderWidth: 2, borderColor: '#1f2937', alignItems: 'center', justifyContent: 'center' },
  logicoButtonRingInner:{ backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#9ca3af' },
  logicoPreviewWrap:{ marginHorizontal: 14, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, overflow: 'hidden' },
  logicoPreviewRow:{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  logicoPreviewSlotText:{ width: 24, fontSize: 12, fontWeight: '800', color: '#334155', textAlign: 'center' },
  logicoPreviewOptionText:{ flex: 1, fontSize: 12, fontWeight: '600', color: '#1e293b' },
  logicoPreviewEmptyButton:{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#E2E8F0', borderWidth: 1, borderColor: '#CBD5E1' },

  previewCard:    { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' },
  previewHero:    { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 20 },
  previewTypeBadge:    { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 6 },
  previewTypeBadgeText:{ fontSize: 11, fontWeight: '700' },
  previewTitle:   { fontSize: 17, fontWeight: '900', color: '#1a1a2e', lineHeight: 24 },
  previewMeta:    { fontSize: 12, color: '#9A9AB0', marginTop: 4 },
  previewStats:   { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F5F7FF' },
  previewStat:    { flex: 1, alignItems: 'center', paddingVertical: 14, borderRightWidth: 1, borderRightColor: '#F5F7FF', gap: 2 },
  previewStatVal: { fontSize: 20, fontWeight: '900', color: '#1a1a2e' },
  previewStatLabel:{ fontSize: 10, fontWeight: '700', color: '#9A9AB0', textTransform: 'uppercase' },
  previewInstBlock:{ margin: 14, backgroundColor: '#F8F9FF', borderRadius: 12, padding: 12 },
  previewInstText: { fontSize: 13, color: '#5A6A8A', lineHeight: 20 },
  previewImage:   { width: '100%', height: 180, marginBottom: 8 },
  previewOptRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F7FF', borderRadius: 0 },
  previewOptDot:  { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  previewOptText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1a1a2e' },
  previewCorrectBadge:{ fontSize: 14, color: '#7DC67A', fontWeight: '800' },
  previewPairRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F7FF', justifyContent: 'space-between' },
  previewPairText:{ fontSize: 13, fontWeight: '700', color: '#1a1a2e', flex: 1, textAlign: 'center' },
});
