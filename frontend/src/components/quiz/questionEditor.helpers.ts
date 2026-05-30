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
  if (url.startsWith('/media')) {
    return `${API_BASE_URL}${url}`;
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

export function questionDataToOptions(questionData: unknown): OptionDraft[] {
  if (!questionData || typeof questionData !== 'object' || Array.isArray(questionData)) {
    return [makeEmptyOption()];
  }
  const options = (questionData as Record<string, unknown>).options;
  if (!Array.isArray(options) || options.length === 0) {
    return [makeEmptyOption()];
  }
  return options.map((item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const r = item as Record<string, unknown>;
      const rawSlot = Number(r.slot_position);
      return {
        id: typeof r.id === 'string' ? r.id : '',
        slotPosition: Number.isInteger(rawSlot) && rawSlot > 0 ? rawSlot : 1,
        image: typeof r.image === 'string' ? r.image : '',
        imageLabel: typeof r.image === 'string' ? toMediaLabel(r.image, 'image') : '',
        imageAssetId: typeof r.image_asset_id === 'string' ? r.image_asset_id : '',
        audio: typeof r.audio === 'string' ? r.audio : '',
        audioLabel: typeof r.audio === 'string' ? toMediaLabel(r.audio, 'audio') : '',
        audioAssetId: typeof r.audio_asset_id === 'string' ? r.audio_asset_id : '',
        label: typeof r.label === 'string' ? r.label : '',
        isCorrect: Boolean(r.is_correct),
      };
    }
    return makeEmptyOption();
  });
}

export function questionDataToLogicoOptions(questionData: unknown): OptionDraft[] {
  if (!questionData || typeof questionData !== 'object' || Array.isArray(questionData)) {
    return makeLogicoOptions();
  }
  const data = questionData as Record<string, unknown>;
  const buttonSlotMapRaw = data.button_slot_map;
  const optionSlotsRaw = data.option_slots;
  const buttonSlotMap: Record<string, number> =
    buttonSlotMapRaw && typeof buttonSlotMapRaw === 'object' && !Array.isArray(buttonSlotMapRaw)
      ? Object.fromEntries(
          Object.entries(buttonSlotMapRaw)
            .map(([buttonId, slot]) => [buttonId, Number(slot)])
            .filter(([, slot]) => Number.isInteger(slot)),
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
  if (!questionData || typeof questionData !== 'object' || Array.isArray(questionData)) {
    return [makeEmptyMatchPair()];
  }
  const data = questionData as Record<string, unknown>;
  const dragItems = Array.isArray(data.drag_items) ? data.drag_items : [];
  const dropTargets = Array.isArray(data.drop_targets) ? data.drop_targets : [];
  const matchRules = Array.isArray(data.match_rules) ? data.match_rules : [];
  if (dragItems.length === 0) return [makeEmptyMatchPair()];

  const dropTargetLabels = new Map<string, string>();
  for (const target of dropTargets) {
    if (target && typeof target === 'object' && !Array.isArray(target)) {
      const t = target as Record<string, unknown>;
      const id = typeof t.id === 'string' ? t.id : '';
      const label = typeof t.label === 'string' ? t.label : '';
      if (id) dropTargetLabels.set(id, label);
    }
  }
  const matchedTargetByDragId = new Map<string, string>();
  for (const rule of matchRules) {
    if (rule && typeof rule === 'object' && !Array.isArray(rule)) {
      const r = rule as Record<string, unknown>;
      const dragId = typeof r.drag_item_id === 'string' ? r.drag_item_id : '';
      const targetId = typeof r.drop_target_id === 'string' ? r.drop_target_id : '';
      if (dragId && targetId) matchedTargetByDragId.set(dragId, targetId);
    }
  }
  const pairs: MatchPairDraft[] = [];
  for (const dragItem of dragItems) {
    if (dragItem && typeof dragItem === 'object' && !Array.isArray(dragItem)) {
      const d = dragItem as Record<string, unknown>;
      const id = typeof d.id === 'string' ? d.id : '';
      const itemLabel = typeof d.label === 'string' ? d.label : '';
      const image = typeof d.image === 'string' ? d.image : '';
      const imageAssetId = typeof d.image_asset_id === 'string' ? d.image_asset_id : '';
      const audio = typeof d.sound === 'string' ? d.sound : '';
      const audioAssetId =
        typeof d.sound_asset_id === 'string'
          ? d.sound_asset_id
          : typeof d.audio_asset_id === 'string'
          ? d.audio_asset_id
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

export function questionDataPromptAudio(questionData: unknown): string {
  if (!questionData || typeof questionData !== 'object' || Array.isArray(questionData)) return '';
  const v = (questionData as Record<string, unknown>).prompt_audio;
  return typeof v === 'string' ? v : '';
}
export function questionDataPromptAudioAssetId(questionData: unknown): string {
  if (!questionData || typeof questionData !== 'object' || Array.isArray(questionData)) return '';
  const v = (questionData as Record<string, unknown>).prompt_audio_asset_id;
  return typeof v === 'string' ? v : '';
}
export function questionDataPromptImage(questionData: unknown): string {
  if (!questionData || typeof questionData !== 'object' || Array.isArray(questionData)) return '';
  const p = questionData as Record<string, unknown>;
  const v = p.prompt_image ?? p.image;
  return typeof v === 'string' ? v : '';
}
export function questionDataPromptImageAssetId(questionData: unknown): string {
  if (!questionData || typeof questionData !== 'object' || Array.isArray(questionData)) return '';
  const p = questionData as Record<string, unknown>;
  const v = p.prompt_image_asset_id ?? p.image_asset_id;
  return typeof v === 'string' ? v : '';
}

export function toPersistentMediaUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (!trimmed.includes('X-Amz-') && !trimmed.includes('x-amz-')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return trimmed;
  }
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
      if (!mainImage) throw new Error('Add main image for Guess the Image questions.');
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

export type PickedFile = { dataUrl: string; fileName: string; mimeType: string };

export function resolvePickedMediaKind(file: PickedFile): 'image' | 'audio' | null {
  const mimeType = file.mimeType.toLowerCase();
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  const fileName = file.fileName.toLowerCase();
  if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(fileName)) return 'image';
  if (/\.(mp3|wav|ogg|aac|m4a|flac)$/.test(fileName)) return 'audio';
  return null;
}

export async function pickFileAsDataUrl(accept: string, unsupportedMessage: string): Promise<PickedFile> {
  if (Platform.OS !== 'web') throw new Error(unsupportedMessage);
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
export const pickMediaAsDataUrl = () =>
  pickFileAsDataUrl(
    'image/*,audio/*',
    'Media upload is currently available on web. On mobile, paste media URL manually.',
  );

export type QEApiFetch = (path: string, options?: RequestInit) => Promise<Response>;

export async function uploadPickedFileToS3(
  apiFetch: QEApiFetch,
  picked: PickedFile,
  mediaType: 'image' | 'audio' | 'video',
): Promise<{ url: string; canonicalUrl: string; assetId: string; fileName: string }> {
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
}

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
