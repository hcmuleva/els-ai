// Question editor — pure helpers extracted from manage.tsx.
import { Platform } from 'react-native';
import { frameButtons } from '../../../app/modules/logicopiccolo/generated/buttons';
import { API_BASE_URL } from '../../context/AuthContext';
import {
  MatchPairDraft,
  OptionDraft,
  QuestionDraft,
  QuestionEditorMode,
  QUESTION_TYPE_ALIASES,
  QUESTION_TYPE_DEFAULT_INSTRUCTIONS,
  QUESTION_TYPE_LABELS,
  SupportedQuestionType,
} from './questionEditor.types';
import { PickedFile, pickFileAsDataUrl } from '../../utils/fileUpload';
import { getStorageItem } from '../../utils/storage';

export const LOGICO_BUTTON_ORDER = frameButtons.map((button) => button.id);
export const LOGICO_BUTTON_COLOR_MAP: Record<string, string> = Object.fromEntries(
  frameButtons.map((button) => [button.id, button.color]),
);

export const toSlug = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export const buildAutoId = (seed: string, fallbackPrefix: string, index: number) => {
  const slug = toSlug(seed);
  return `${slug || fallbackPrefix}_${index + 1}`;
};

export const normalizeQuestionType = (value: string): string =>
  QUESTION_TYPE_ALIASES[value] || value;

export const isSupportedQuestionType = (value: unknown): value is SupportedQuestionType =>
  value === 'guess_image' ||
  value === 'drag_drop_match' ||
  value === 'memory_match' ||
  value === 'fill_blank' ||
  value === 'jigsaw' ||
  value === 'guess_audio' ||
  value === 'true_false' ||
  value === 'single_choice' ||
  value === 'multi_choice' ||
  value === 'logico';

export const getDefaultInstructionByType = (questionType: string): string => {
  const normalized = normalizeQuestionType(questionType);
  return isSupportedQuestionType(normalized) ? QUESTION_TYPE_DEFAULT_INSTRUCTIONS[normalized] : '';
};

export const getQuestionEditorMode = (questionType: string): QuestionEditorMode => {
  const normalized = normalizeQuestionType(questionType);
  if (normalized === 'logico') return 'logico';
  if (normalized === 'drag_drop_match') return 'drag_drop';
  if (normalized === 'memory_match') return 'memory_match';
  if (normalized === 'fill_blank') return 'fill_blank';
  if (normalized === 'jigsaw') return 'jigsaw';
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

export const getQuestionTypeLabel = (questionType: string) => {
  const normalized = normalizeQuestionType(questionType);
  if (isSupportedQuestionType(normalized)) {
    return QUESTION_TYPE_LABELS[normalized];
  }
  return QUESTION_TYPE_LABELS[questionType] || questionType || 'Custom';
};

export const resolveMediaUrl = (url: string | undefined): string => {
  if (!url) return '';
  if (url.includes('media.els-ai.in')) {
    const clean = url.split('?')[0].split('#')[0];
    const base = clean.substring(clean.lastIndexOf('/') + 1).replace(/\.[a-z0-9]+$/i, '');
    const label = base.replace(/[-_]+/g, ' ').trim().replace(/\b\w/g, (m) => m.toUpperCase()) || 'Image';
    return `https://placehold.co/400x400/EEF2FF/4338CA?text=${encodeURIComponent(label)}`;
  }
  if (url.startsWith('/media')) return `${API_BASE_URL}${url}`;
  if (url.startsWith('/assets') || url.startsWith('./assets') || url.startsWith('assets/')) {
    const cleanUrl = url.startsWith('./') ? url.slice(1) : url.startsWith('assets/') ? `/${url}` : url;
    const frontendBaseUrl = API_BASE_URL.replace(/\/api\/?$/, '');
    return `${frontendBaseUrl}${cleanUrl}`;
  }
  return url;
};

export const extractFileName = (source: string): string => {
  const trimmed = source.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:')) {
    const mime = trimmed
      .slice(5, trimmed.indexOf(';') > -1 ? trimmed.indexOf(';') : undefined)
      .trim();
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

export const toMediaLabel = (source: string, fallback: string, explicitLabel?: string) => {
  if (explicitLabel?.trim()) return explicitLabel.trim();
  if (!source.trim()) return `No ${fallback} selected`;
  return extractFileName(source);
};

export const makeEmptyMatchPair = (): MatchPairDraft => ({
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

export const makeEmptyOption = (): OptionDraft => ({
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

export const makeTrueFalseOptions = (): OptionDraft[] => [
  { ...makeEmptyOption(), id: 'true', slotPosition: 1, label: 'True', isCorrect: true },
  { ...makeEmptyOption(), id: 'false', slotPosition: 2, label: 'False', isCorrect: false },
];

export const makeLogicoOptions = (): OptionDraft[] =>
  LOGICO_BUTTON_ORDER.map((buttonId, index) => ({
    ...makeEmptyOption(),
    id: buttonId,
    slotPosition: index + 1,
    label: '',
    isCorrect: true,
  }));

export const makeDefaultOptionsByType = (questionType: string): OptionDraft[] => {
  const normalized = normalizeQuestionType(questionType);
  if (normalized === 'true_false') return makeTrueFalseOptions();
  if (normalized === 'logico') return makeLogicoOptions();
  return [makeEmptyOption()];
};

export const makeInitialDraft = (questionType: string = 'guess_image'): QuestionDraft => ({
  classLevel: '',
  subject: '',
  questionTitle: '',
  questionInstruction: getDefaultInstructionByType(questionType),
  explanation: '',
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
  rawQuestionData: questionType === 'jigsaw' ? { gridSize: '3x3', difficulty: 'medium', clickLimit: 20 } : {},
});

export const normalizeLogicoButtonId = (id: string) => id.trim().toLowerCase();

export const getLogicoButtonColor = (buttonId: string) => {
  const normalized = normalizeLogicoButtonId(buttonId);
  return LOGICO_BUTTON_COLOR_MAP[normalized] || '#4b5563';
};

export const isRingButton = (buttonId: string) =>
  normalizeLogicoButtonId(buttonId).includes('-ring');

function toRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function pickString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') return value;
  }
  return '';
}

function pickBoolean(record: Record<string, unknown>, keys: string[]): boolean {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1') return true;
      if (normalized === 'false' || normalized === '0') return false;
    }
  }
  return false;
}

function pickNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function questionDataToOptions(questionData: unknown): OptionDraft[] {
  const data = toRecord(questionData);
  if (!data) {
    return [makeEmptyOption()];
  }
  const options =
    data.options ??
    data.option_list ??
    data.optionList ??
    data.choices;
  if (!Array.isArray(options) || options.length === 0) {
    return [makeEmptyOption()];
  }
  return options.map((item) => {
    const record = toRecord(item);
    if (record) {
      const rawSlot = pickNumber(record, [
        'slot_position',
        'slotPosition',
        'slot',
        'position',
      ]);
      const resolvedSlot =
        rawSlot !== null && Number.isInteger(rawSlot) && rawSlot > 0 ? rawSlot : 1;
      const image = pickString(record, ['image', 'image_url', 'imageUrl', 'mediaUrl']);
      const audio = pickString(record, ['audio', 'sound', 'audio_url', 'audioUrl', 'soundUrl']);
      return {
        id: pickString(record, ['id', 'option_id', 'optionId']),
        slotPosition: resolvedSlot,
        image,
        imageLabel: image ? toMediaLabel(image, 'image') : '',
        imageAssetId: pickString(record, ['image_asset_id', 'imageAssetId']),
        audio,
        audioLabel: audio ? toMediaLabel(audio, 'audio') : '',
        audioAssetId: pickString(record, ['audio_asset_id', 'audioAssetId', 'sound_asset_id', 'soundAssetId']),
        label: pickString(record, ['label', 'text', 'value', 'title', 'option']),
        isCorrect: pickBoolean(record, ['is_correct', 'isCorrect', 'correct', 'answer']),
      };
    }
    return makeEmptyOption();
  });
}

export function questionDataToLogicoOptions(questionData: unknown): OptionDraft[] {
  const data = toRecord(questionData);
  if (!data) {
    return makeLogicoOptions();
  }
  const buttonSlotMapRaw = data.button_slot_map ?? data.buttonSlotMap;
  const optionSlotsRaw = data.option_slots ?? data.optionSlots;
  const buttonSlotMap: Record<string, number> =
    buttonSlotMapRaw && typeof buttonSlotMapRaw === 'object' && !Array.isArray(buttonSlotMapRaw)
      ? Object.fromEntries(
          Object.entries(buttonSlotMapRaw)
            .map(([buttonId, slot]) => [buttonId, Number(slot)])
            .filter(([, slot]) => Number.isInteger(slot)),
        )
      : {};
  const normalizedButtonSlotMap = Object.fromEntries(
    Object.entries(buttonSlotMap).map(([buttonId, slot]) => [normalizeLogicoButtonId(buttonId), slot]),
  );
  const optionSlotLabelById = new Map<number, string>();
  if (Array.isArray(optionSlotsRaw)) {
    optionSlotsRaw.forEach((slot) => {
      const record = toRecord(slot);
      if (!record) return;
      const slotId = Number(record.id ?? record.slot ?? record.slotId);
      if (!Number.isInteger(slotId)) return;
      optionSlotLabelById.set(slotId, pickString(record, ['value', 'label', 'text']));
    });
  }
  return LOGICO_BUTTON_ORDER.map((buttonId, index) => {
    const slotPosition =
      buttonSlotMap[buttonId] ?? normalizedButtonSlotMap[normalizeLogicoButtonId(buttonId)];
    const safeSlot =
      Number.isInteger(slotPosition) && slotPosition >= 1 && slotPosition <= 10
        ? slotPosition
        : index + 1;
    return {
      ...makeEmptyOption(),
      id: buttonId,
      slotPosition: safeSlot,
      label: optionSlotLabelById.get(safeSlot) ?? '',
      isCorrect: true,
    };
  });
}

export function questionDataToMatchPairs(questionData: unknown): MatchPairDraft[] {
  const data = toRecord(questionData);
  if (!data) {
    return [makeEmptyMatchPair()];
  }
  const dragItems = Array.isArray(data.drag_items) ? data.drag_items : Array.isArray(data.dragItems) ? data.dragItems : [];
  const dropTargets = Array.isArray(data.drop_targets) ? data.drop_targets : Array.isArray(data.dropTargets) ? data.dropTargets : [];
  const matchRules = Array.isArray(data.match_rules) ? data.match_rules : Array.isArray(data.matchRules) ? data.matchRules : [];
  if (dragItems.length === 0) return [makeEmptyMatchPair()];

  const dropTargetLabels = new Map<string, string>();
  for (const target of dropTargets) {
    const targetRecord = toRecord(target);
    if (targetRecord) {
      const id = pickString(targetRecord, ['id', 'target_id', 'targetId']);
      const label = pickString(targetRecord, ['label', 'text', 'value']);
      if (id) dropTargetLabels.set(id, label);
    }
  }
  const matchedTargetByDragId = new Map<string, string>();
  for (const rule of matchRules) {
    const ruleRecord = toRecord(rule);
    if (ruleRecord) {
      const dragId = pickString(ruleRecord, ['drag_item_id', 'dragItemId', 'drag_id', 'dragId']);
      const targetId = pickString(ruleRecord, ['drop_target_id', 'dropTargetId', 'target_id', 'targetId']);
      if (dragId && targetId) matchedTargetByDragId.set(dragId, targetId);
    }
  }
  const pairs: MatchPairDraft[] = [];
  for (const dragItem of dragItems) {
    const dragRecord = toRecord(dragItem);
    if (dragRecord) {
      const id = pickString(dragRecord, ['id', 'drag_item_id', 'dragItemId']);
      const itemLabel = pickString(dragRecord, ['label', 'itemLabel', 'text', 'value']);
      const image = pickString(dragRecord, ['image', 'image_url', 'imageUrl']);
      const imageAssetId = pickString(dragRecord, ['image_asset_id', 'imageAssetId']);
      const audio = pickString(dragRecord, ['sound', 'audio', 'soundUrl', 'audioUrl']);
      const audioAssetId = pickString(dragRecord, ['sound_asset_id', 'soundAssetId', 'audio_asset_id', 'audioAssetId']);
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

export function questionDataPromptAudio(questionData: unknown): string {
  const data = toRecord(questionData);
  if (!data) return '';
  return pickString(data, ['prompt_audio', 'promptAudio']);
}
export function questionDataPromptAudioAssetId(questionData: unknown): string {
  const data = toRecord(questionData);
  if (!data) return '';
  return pickString(data, ['prompt_audio_asset_id', 'promptAudioAssetId']);
}
export function questionDataPromptImage(questionData: unknown): string {
  const data = toRecord(questionData);
  if (!data) return '';
  return pickString(data, ['prompt_image', 'promptImage', 'image', 'imageUrl']);
}
export function questionDataPromptImageAssetId(questionData: unknown): string {
  const data = toRecord(questionData);
  if (!data) return '';
  return pickString(data, ['prompt_image_asset_id', 'promptImageAssetId', 'image_asset_id', 'imageAssetId']);
}

export function toPersistentMediaUrl(url: string): string {
  return url.trim();
}

export function draftToPayload(draft: QuestionDraft) {
  if (!draft.questionTitle.trim()) throw new Error('Question title is required.');
  if (!draft.questionType.trim()) throw new Error('Question type is required.');

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
      .filter((o) => o.id || o.image || o.audio || o.label);

    if (normalizedType === 'true_false') {
      if (preparedOptions.length !== 2) throw new Error('True / False requires exactly 2 options.');
    } else if (preparedOptions.length < 2) {
      throw new Error('Add at least 2 options.');
    }
    const correct = preparedOptions.filter((o) => o.isCorrect).length;
    if (normalizedType === 'multi_choice') {
      if (correct < 1) throw new Error('Mark at least one correct option for Multi Choice.');
    } else if (correct !== 1) {
      throw new Error('Mark exactly one option as the correct answer.');
    }
    if (normalizedType === 'guess_image') {
      if (!mainImage) throw new Error('Add main media for Guess the Image / Video questions.');
      preparedOptions.forEach((o, i) => {
        if (!o.image) throw new Error(`Add an image for option ${i + 1}.`);
      });
    }
    if (normalizedType === 'guess_audio' && !mainAudio) {
      throw new Error('Add main audio for Guess the Audio questions.');
    }

    const normalizedOptions = preparedOptions.map((o, i) => ({
      id: o.id || buildAutoId(o.label, 'option', i),
      slot_position: o.slotPosition || i + 1,
      image: o.image || undefined,
      image_asset_id: o.imageAssetId || undefined,
      audio: o.audio || undefined,
      audio_asset_id: o.audioAssetId || undefined,
      label: o.label || `Option ${i + 1}`,
      is_correct: o.isCorrect,
    }));
    questionData = {
      options: normalizedOptions,
      ...(normalizedType === 'guess_image' && mainImage ? { prompt_image: mainImage } : {}),
      ...(normalizedType === 'guess_image' && mainImageAssetId
        ? { prompt_image_asset_id: mainImageAssetId }
        : {}),
      ...(normalizedType === 'guess_audio' && mainAudio ? { prompt_audio: mainAudio } : {}),
      ...(normalizedType === 'guess_audio' && mainAudioAssetId
        ? { prompt_audio_asset_id: mainAudioAssetId }
        : {}),
      ...(normalizedType ? { variant: normalizedType } : {}),
    };
  } else if (mode === 'logico') {
    if (!mainImage) throw new Error('Add worksheet image for Logico questions.');
    const mappings = draft.options.map((option, index) => ({
      buttonId: normalizeLogicoButtonId(option.id || LOGICO_BUTTON_ORDER[index] || ''),
      slotPosition: Number(option.slotPosition),
      label: option.label.trim(),
    }));
    if (mappings.some((m) => !m.buttonId)) throw new Error('Each Logico button mapping must have a valid button id.');
    if (mappings.length !== LOGICO_BUTTON_ORDER.length)
      throw new Error('Logico questions require mapping for all 10 buttons.');
    if (mappings.some((m) => !Number.isInteger(m.slotPosition) || m.slotPosition < 1 || m.slotPosition > 10))
      throw new Error('Each Logico button must be mapped to a position from 1 to 10.');
    if (new Set(mappings.map((m) => m.slotPosition)).size !== 10)
      throw new Error('Logico button positions must be unique (1 to 10).');

    const buttonSlotMap = Object.fromEntries(mappings.map((m) => [m.buttonId, m.slotPosition]));
    const optionSlots = Array.from({ length: 10 }, (_, i) => {
      const slotId = i + 1;
      const mapped = mappings.find((m) => m.slotPosition === slotId);
      return { id: slotId, value: mapped?.label || '' };
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
      .map((p) => ({
        id: p.id.trim(),
        itemLabel: p.itemLabel.trim(),
        targetLabel: p.targetLabel.trim(),
        image: toPersistentMediaUrl(p.image),
        imageAssetId: p.imageAssetId.trim(),
        audio: toPersistentMediaUrl(p.audio),
        audioAssetId: p.audioAssetId.trim(),
      }))
      .filter((p) => p.id || p.itemLabel || p.targetLabel || p.image || p.audio);
    if (preparedPairs.length === 0) throw new Error('Add at least one match pair.');

    const dragItems = preparedPairs.map((pair, index) => {
      if (!pair.image) throw new Error(`Add an image for pair ${index + 1}.`);
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
    const dropTargets = preparedPairs.map((pair, index) => ({
      id: dragItems[index].id,
      label: pair.targetLabel || pair.itemLabel || `Target ${index + 1}`,
    }));
    const matchRules = dragItems.map((item) => ({ drag_item_id: item.id, drop_target_id: item.id }));
    questionData = { drag_items: dragItems, drop_targets: dropTargets, match_rules: matchRules };
  } else if (mode === 'memory_match') {
    const pairs = (draft.rawQuestionData as any)?.pairs;
    if (!Array.isArray(pairs) || pairs.length === 0) throw new Error('Add at least one pair for Memory Match.');
    const rawClickLimit = (draft.rawQuestionData as any)?.clickLimit ?? 0;
    questionData = {
      grid: (draft.rawQuestionData as any)?.grid ?? '4x4',
      pairs,
      ...(rawClickLimit > 0 ? { clickLimit: rawClickLimit } : {}),
    };
  } else if (mode === 'fill_blank') {
    const sentence = ((draft.rawQuestionData as any)?.sentence ?? '').trim();
    const answer = ((draft.rawQuestionData as any)?.answer ?? '').trim();
    const opts = ((draft.rawQuestionData as any)?.options ?? []) as string[];
    if (!sentence) throw new Error('Sentence is required for Fill in the Blank.');
    if (!sentence.includes('___')) throw new Error('Sentence must include ___ to mark the blank.');
    if (!answer) throw new Error('Correct answer is required.');
    if (opts.length < 2) throw new Error('Add at least 2 answer options.');
    if (!opts.some((o) => o.toLowerCase() === answer.toLowerCase())) {
      throw new Error('The correct answer must be one of the options.');
    }
    questionData = {
      sentence,
      answer,
      hint: ((draft.rawQuestionData as any)?.hint ?? '').trim() || undefined,
      options: opts.filter(Boolean),
    };
  } else if (mode === 'jigsaw') {
    if (!mainImage) throw new Error('Add puzzle image for Jigsaw questions.');
    const rawGridSize = String((draft.rawQuestionData as any)?.gridSize ?? '3x3');
    const gridSize = ['2x2', '3x3', '4x4', '5x5'].includes(rawGridSize) ? rawGridSize : '3x3';
    const rawDifficulty = String((draft.rawQuestionData as any)?.difficulty ?? 'medium');
    const difficulty = ['easy', 'medium', 'hard'].includes(rawDifficulty) ? rawDifficulty : 'medium';
    const rawClickLimit = Number((draft.rawQuestionData as any)?.clickLimit ?? 0);
    questionData = {
      image: mainImage,
      ...(mainImageAssetId ? { image_asset_id: mainImageAssetId } : {}),
      gridSize,
      difficulty,
      ...(Number.isFinite(rawClickLimit) && rawClickLimit > 0 ? { clickLimit: rawClickLimit } : {}),
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
      rawMeta && typeof rawMeta === 'object' && !Array.isArray(rawMeta)
        ? (rawMeta as Record<string, unknown>)
        : {};
    questionData = {
      ...(questionData as Record<string, unknown>),
      _meta: {
        ...existingMeta,
        classLevel: draft.classLevel.trim() || null,
        subject: draft.subject.trim() || null,
      },
    };
  }

  const payload: Record<string, unknown> = {
    classLevel: draft.classLevel.trim() || undefined,
    subject: draft.subject.trim() || undefined,
    questionTitle: draft.questionTitle.trim(),
    questionInstruction: draft.questionInstruction.trim() || undefined,
    explanation: draft.explanation.trim() || undefined,
    questionType: normalizedType,
    questionAudio: normalizedType === 'guess_audio' ? mainAudio || undefined : undefined,
    points,
    timeLimitSeconds,
    questionData,
  };
  if (draft.sortOrder.trim()) {
    const sortOrder = Number(draft.sortOrder);
    if (!Number.isNaN(sortOrder)) payload.sortOrder = sortOrder;
  }
  return payload;
}

export type { PickedFile };
export { pickFileAsDataUrl };

export function resolvePickedMediaKind(file: PickedFile): 'image' | 'audio' | null {
  const mimeType = file.mimeType.toLowerCase();
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  const fileName = file.fileName.toLowerCase();
  if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(fileName)) return 'image';
  if (/\.(mp3|wav|ogg|aac|m4a|flac)$/.test(fileName)) return 'audio';
  return null;
}

export const pickAudioAsDataUrl = () =>
  pickFileAsDataUrl(
    'audio/*',
    'Audio upload is currently available on web. On mobile, paste audio URL manually.',
  );
export const pickImageAsDataUrl = () =>
  pickFileAsDataUrl(
    'image/*',
    'Image upload is currently available on web. On mobile, paste image URL manually.',
  );
export const pickImageOrVideoAsDataUrl = () =>
  pickFileAsDataUrl(
    'image/*,video/*',
    'Media upload is currently available on web. On mobile, paste media URL manually.',
  );
export const pickMediaAsDataUrl = () =>
  pickFileAsDataUrl(
    'image/*,audio/*',
    'Media upload is currently available on web. On mobile, paste media URL manually.',
  );

export type QEApiFetch = (path: string, options?: RequestInit) => Promise<Response>;
export function hydrateDraftFromQuestion(question: import('./questionEditor.types').QuestionItemForEdit): QuestionDraft {
  const rawMeta =
    question.question_data &&
    typeof question.question_data === 'object' &&
    !Array.isArray(question.question_data) &&
    '_meta' in (question.question_data as Record<string, unknown>)
      ? (question.question_data as Record<string, unknown>)._meta
      : undefined;
  const meta =
    rawMeta && typeof rawMeta === 'object' && !Array.isArray(rawMeta)
      ? (rawMeta as Record<string, unknown>)
      : {};
  const resolvedClassLevel =
    typeof meta.classLevel === 'string' && meta.classLevel.trim()
      ? meta.classLevel.trim()
      : question.class_level || '';
  const resolvedSubject =
    typeof meta.subject === 'string' && meta.subject.trim()
      ? meta.subject.trim()
      : question.subject || '';
  const resolvedMainImage = questionDataPromptImage(question.question_data ?? {});
  const resolvedMainImageAssetId = questionDataPromptImageAssetId(question.question_data ?? {});
  const resolvedMainAudio =
    question.question_audio || questionDataPromptAudio(question.question_data ?? {});
  const resolvedMainAudioAssetId = questionDataPromptAudioAssetId(question.question_data ?? {});
  const normalizedType = normalizeQuestionType(question.question_type || 'guess_image');
  const parsedOptions =
    normalizedType === 'logico'
      ? questionDataToLogicoOptions(question.question_data ?? {})
      : questionDataToOptions(question.question_data ?? {});
  const resolvedOptions =
    normalizedType === 'true_false' &&
    parsedOptions.every((item) => !item.id && !item.label && !item.image && !item.audio)
      ? makeTrueFalseOptions()
      : parsedOptions;
  return {
    classLevel: resolvedClassLevel,
    subject: resolvedSubject,
    questionTitle: question.question_title || '',
    questionInstruction: question.question_instruction || getDefaultInstructionByType(normalizedType),
    explanation: question.explanation || '',
    questionType: normalizedType,
    mainImage: resolvedMainImage,
    mainImageLabel: toMediaLabel(resolvedMainImage, 'image'),
    mainImageAssetId: resolvedMainImageAssetId,
    mainAudio: resolvedMainAudio,
    mainAudioLabel: toMediaLabel(resolvedMainAudio, 'audio'),
    mainAudioAssetId: resolvedMainAudioAssetId,
    points: String(question.points ?? 10),
    timeLimitSeconds: String(question.time_limit_seconds ?? 30),
    sortOrder:
      question.sort_order !== undefined && question.sort_order !== null
        ? String(question.sort_order)
        : '',
    options: resolvedOptions,
    matchPairs: questionDataToMatchPairs(question.question_data ?? {}),
    rawQuestionData: question.question_data ?? {},
  };
}
