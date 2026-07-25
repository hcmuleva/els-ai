// Question Dump — Validation & Payload Helpers for Bulk JSON Import

import {
  QUESTION_TYPE_CHOICES,
  SupportedQuestionType,
} from '../quiz/questionEditor.types';
import {
  isSupportedQuestionType,
  normalizeQuestionType,
} from '../quiz/questionEditor.helpers';

export interface QuestionValidationError {
  questionIndex: number;
  questionTitle?: string;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidatedQuestionItem {
  index: number;
  raw: Record<string, unknown>;
  payload: Record<string, unknown>;
  title: string;
  questionType: string;
  classLevel?: string;
  subject?: string;
  points: number;
  timeLimitSeconds: number;
  warnings: string[];
}

export interface ValidationReport {
  total: number;
  validCount: number;
  invalidCount: number;
  warningCount: number;
  errors: QuestionValidationError[];
  validItems: ValidatedQuestionItem[];
}

const SUPPORTED_TYPES = new Set([
  'guess_image',
  'drag_drop_match',
  'guess_audio',
  'true_false',
  'single_choice',
  'multi_choice',
  'logico',
  'memory_match',
  'fill_blank',
  'jigsaw',
]);

function extractOptionLabel(opt: unknown): string {
  if (typeof opt === 'string' || typeof opt === 'number') {
    return String(opt).trim();
  }
  if (opt && typeof opt === 'object' && !Array.isArray(opt)) {
    const record = opt as Record<string, unknown>;
    const val = record.label ?? record.text ?? record.value ?? record.option ?? record.title ?? record.name;
    if (val !== undefined && val !== null && String(val).trim()) {
      return String(val).trim();
    }
  }
  return '';
}

/**
 * Validates an individual raw question JSON object against business rules and API requirements.
 */
export function validateSingleQuestion(
  raw: Record<string, unknown>,
  index: number,
): { errors: QuestionValidationError[]; item?: ValidatedQuestionItem } {
  const errors: QuestionValidationError[] = [];
  const warnings: string[] = [];

  const addError = (message: string, field?: string) => {
    errors.push({ questionIndex: index + 1, questionTitle: String(raw.questionTitle || raw.title || `Question #${index + 1}`), field, message, severity: 'error' });
  };

  const addWarning = (message: string, field?: string) => {
    errors.push({ questionIndex: index + 1, questionTitle: String(raw.questionTitle || raw.title || `Question #${index + 1}`), field, message, severity: 'warning' });
    warnings.push(message);
  };

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    addError('Item must be a JSON object');
    return { errors };
  }

  // Question Title
  const title = String(raw.questionTitle || raw.title || '').trim();
  if (!title) {
    addError('Missing questionTitle', 'questionTitle');
  }

  // Question Type
  const rawType = String(raw.questionType || raw.type || '').trim();
  const normalizedType = normalizeQuestionType(rawType);

  if (!rawType) {
    addError('Missing questionType', 'questionType');
  } else if (!isSupportedQuestionType(normalizedType) && !SUPPORTED_TYPES.has(normalizedType)) {
    addError(
      `Invalid questionType "${rawType}". Supported types: ${Array.from(SUPPORTED_TYPES).join(', ')}`,
      'questionType',
    );
  }

  // Standard numeric bounds
  const points = Number(raw.points ?? 10);
  if (Number.isNaN(points) || points < 0 || points > 1000) {
    addError('Points must be a number between 0 and 1000', 'points');
  }

  const timeLimitSeconds = Number(raw.timeLimitSeconds ?? 30);
  if (Number.isNaN(timeLimitSeconds) || timeLimitSeconds < 1 || timeLimitSeconds > 600) {
    addError('Time limit must be a number between 1 and 600 seconds', 'timeLimitSeconds');
  }

  const sortOrder = raw.sortOrder !== undefined && raw.sortOrder !== null ? Number(raw.sortOrder) : undefined;
  if (sortOrder !== undefined && (Number.isNaN(sortOrder) || sortOrder < 0 || sortOrder > 10000)) {
    addError('Sort order must be a number between 0 and 10000', 'sortOrder');
  }

  const classLevel = String(raw.classLevel || raw.class_level || '').trim();
  const subject = String(raw.subject || '').trim();

  // Validate questionData / details depending on questionType
  const questionData = (raw.questionData || raw.data || {}) as Record<string, unknown>;
  let normalizedOptions: Array<Record<string, unknown>> = [];

  if (normalizedType === 'single_choice' || normalizedType === 'multi_choice' || normalizedType === 'true_false' || normalizedType === 'guess_image' || normalizedType === 'guess_audio') {
    const rawOptions = (questionData.options || raw.options) as Array<unknown> | undefined;

    if (!Array.isArray(rawOptions) || rawOptions.length === 0) {
      addError('Question options array is missing or empty', 'options');
    } else {
      if (normalizedType === 'true_false' && rawOptions.length !== 2) {
        addError('True / False questions require exactly 2 options', 'options');
      } else if (rawOptions.length < 2) {
        addError('Choice questions must have at least 2 options', 'options');
      }

      const optionIds = new Set<string>();
      let correctCount = 0;

      normalizedOptions = rawOptions.map((opt, optIdx) => {
        const isObj = typeof opt === 'object' && opt !== null && !Array.isArray(opt);
        const record = isObj ? (opt as Record<string, unknown>) : {};

        const label = extractOptionLabel(opt) || `Option ${optIdx + 1}`;
        const optId = String(record.id || record.option_id || `opt_${optIdx + 1}`).trim();

        if (optionIds.has(optId)) {
          addError(`Duplicate option ID "${optId}" found`, `options[${optIdx}].id`);
        }
        optionIds.add(optId);

        const isCorrect = isObj
          ? Boolean(record.is_correct || record.isCorrect || record.correct)
          : optIdx === 0;

        if (isCorrect) correctCount++;

        const image = String(record.image || record.image_url || record.imageUrl || '').trim();
        const audio = String(record.audio || record.audio_url || record.audioUrl || '').trim();

        if (normalizedType === 'guess_image' && !image) {
          addError(`Option #${optIdx + 1} ("${label}") is missing image for guess_image type`, `options[${optIdx}].image`);
        }

        return {
          id: optId,
          slot_position: Number(record.slot_position || record.slotPosition || optIdx + 1),
          label,
          is_correct: isCorrect,
          ...(image ? { image } : {}),
          ...(audio ? { audio } : {}),
        };
      });

      if (normalizedType === 'multi_choice') {
        if (correctCount < 1) {
          addError('Multi-choice questions require at least 1 correct option (is_correct: true)', 'options');
        }
      } else {
        if (correctCount !== 1) {
          addError(`Questions of type "${normalizedType}" require exactly 1 correct answer (found ${correctCount})`, 'options');
        }
      }
    }

    if (normalizedType === 'guess_image') {
      const promptImage = String(questionData.prompt_image || questionData.promptImage || raw.prompt_image || raw.mainImage || '').trim();
      if (!promptImage) {
        addError('guess_image type requires a prompt_image (main question image)', 'prompt_image');
      }
    }

    if (normalizedType === 'guess_audio') {
      const promptAudio = String(questionData.prompt_audio || questionData.promptAudio || raw.questionAudio || raw.mainAudio || '').trim();
      if (!promptAudio) {
        addError('guess_audio type requires a prompt_audio or questionAudio file URL', 'prompt_audio');
      }
    }
  } else if (normalizedType === 'logico') {
    const promptImage = String(questionData.prompt_image || raw.mainImage || '').trim();
    if (!promptImage) {
      addError('Logico questions require a prompt_image (worksheet image)', 'prompt_image');
    }
    const buttonSlotMap = (questionData.button_slot_map || questionData.buttonSlotMap) as Record<string, number> | undefined;
    if (!buttonSlotMap || typeof buttonSlotMap !== 'object') {
      addError('Logico questions require button_slot_map mapping 10 buttons to positions 1-10', 'button_slot_map');
    } else {
      const slots = Object.values(buttonSlotMap).map(Number);
      if (slots.length !== 10) {
        addError('Logico questions require mapping for all 10 buttons', 'button_slot_map');
      }
      const uniqueSlots = new Set(slots);
      if (uniqueSlots.size !== 10 || slots.some((s) => s < 1 || s > 10)) {
        addError('Logico button positions must uniquely map from 1 to 10', 'button_slot_map');
      }
    }
  } else if (normalizedType === 'drag_drop_match') {
    const dragItems = (questionData.drag_items || questionData.dragItems) as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(dragItems) || dragItems.length === 0) {
      addError('Drag & Drop questions require drag_items array', 'drag_items');
    }
  } else if (normalizedType === 'fill_blank') {
    const sentence = String(questionData.sentence || '').trim();
    const answer = String(questionData.answer || '').trim();
    const options = questionData.options as string[] | undefined;

    if (!sentence) {
      addError('Fill in the Blank questions require a sentence', 'sentence');
    } else if (!sentence.includes('___')) {
      addError('Fill in the Blank sentence must contain "___" to mark the blank spot', 'sentence');
    }
    if (!answer) {
      addError('Fill in the Blank questions require a correct answer', 'answer');
    }
    if (!Array.isArray(options) || options.length < 2) {
      addError('Fill in the Blank questions require at least 2 options', 'options');
    } else if (answer && !options.some((o) => String(o).toLowerCase() === answer.toLowerCase())) {
      addError(`Correct answer "${answer}" is missing from options array`, 'options');
    }
  } else if (normalizedType === 'jigsaw') {
    const image = String(questionData.image || questionData.prompt_image || raw.mainImage || '').trim();
    if (!image) {
      addError('Jigsaw questions require an image URL', 'image');
    }
  }

  // Warnings
  if (!raw.explanation) {
    addWarning('Missing optional explanation');
  }

  // Construct clean API payload
  const payload: Record<string, unknown> = {
    classLevel: classLevel || undefined,
    subject: subject || undefined,
    questionTitle: title,
    questionInstruction: String(raw.questionInstruction || raw.instruction || '').trim() || undefined,
    explanation: String(raw.explanation || '').trim() || undefined,
    questionType: normalizedType,
    questionAudio: String(raw.questionAudio || questionData.prompt_audio || '').trim() || undefined,
    points,
    timeLimitSeconds,
    sortOrder,
    questionData: {
      ...questionData,
      ...(normalizedOptions.length > 0 ? { options: normalizedOptions } : {}),
      _meta: {
        classLevel: classLevel || null,
        subject: subject || null,
      },
    },
  };

  const item: ValidatedQuestionItem = {
    index: index + 1,
    raw,
    payload,
    title,
    questionType: normalizedType,
    classLevel,
    subject,
    points,
    timeLimitSeconds,
    warnings,
  };

  return { errors, item };
}

/**
 * Validates a batch JSON input string or parsed object array.
 */
export function validateQuestionsJsonBatch(jsonText: string): ValidationReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err: any) {
    return {
      total: 0,
      validCount: 0,
      invalidCount: 0,
      warningCount: 0,
      errors: [
        {
          questionIndex: 0,
          message: `JSON Syntax Error: ${err?.message || 'Invalid JSON format'}`,
          severity: 'error',
        },
      ],
      validItems: [],
    };
  }

  let list: Array<Record<string, unknown>> = [];
  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).questions)) {
    list = (parsed as any).questions;
  } else if (parsed && typeof parsed === 'object') {
    list = [parsed as Record<string, unknown>];
  } else {
    return {
      total: 0,
      validCount: 0,
      invalidCount: 0,
      warningCount: 0,
      errors: [
        {
          questionIndex: 0,
          message: 'Root JSON must be an array of question objects or an object with a "questions" array',
          severity: 'error',
        },
      ],
      validItems: [],
    };
  }

  const allErrors: QuestionValidationError[] = [];
  const validItems: ValidatedQuestionItem[] = [];
  let warningCount = 0;

  list.forEach((item, idx) => {
    const { errors, item: validItem } = validateSingleQuestion(item, idx);
    if (errors.length > 0) {
      allErrors.push(...errors);
    }
    const itemWarnings = errors.filter((e) => e.severity === 'warning');
    warningCount += itemWarnings.length;

    const hasFatal = errors.some((e) => e.severity === 'error');
    if (!hasFatal && validItem) {
      validItems.push(validItem);
    }
  });

  const fatalErrors = allErrors.filter((e) => e.severity === 'error');

  return {
    total: list.length,
    validCount: validItems.length,
    invalidCount: list.length - validItems.length,
    warningCount,
    errors: fatalErrors,
    validItems,
  };
}

/**
 * Returns clean Example JSON for pre-populating the editor or downloading.
 */
export function generateSampleQuestionsJson(): string {
  const sample = [
    {
      classLevel: 'Class 1',
      subject: 'Mathematics',
      questionTitle: 'Identify the Geometric Shape',
      questionInstruction: 'Look at the main image and select the shape that matches.',
      explanation: 'A circle has a round boundary with zero corners.',
      questionType: 'guess_image',
      points: 10,
      timeLimitSeconds: 30,
      questionData: {
        prompt_image: 'https://placehold.co/400x300/EEF2FF/4338CA?text=Circle',
        options: [
          {
            id: 'opt_circle',
            slot_position: 1,
            label: 'Circle',
            image: 'https://placehold.co/200x200/EEF2FF/4338CA?text=Circle',
            is_correct: true,
          },
          {
            id: 'opt_square',
            slot_position: 2,
            label: 'Square',
            image: 'https://placehold.co/200x200/EDE4FF/7B4FCA?text=Square',
            is_correct: false,
          },
          {
            id: 'opt_triangle',
            slot_position: 3,
            label: 'Triangle',
            image: 'https://placehold.co/200x200/FFE8D6/FF7043?text=Triangle',
            is_correct: false,
          },
        ],
      },
    },
    {
      classLevel: 'Class 1',
      subject: 'Science',
      questionTitle: 'Living vs Non-Living Things',
      questionInstruction: 'Read the statement carefully and choose True or False.',
      explanation: 'Plants grow, consume nutrients, and reproduce, making them living organisms.',
      questionType: 'true_false',
      points: 10,
      timeLimitSeconds: 20,
      questionData: {
        options: [
          { id: 'true', slot_position: 1, label: 'True', is_correct: true },
          { id: 'false', slot_position: 2, label: 'False', is_correct: false },
        ],
      },
    },
    {
      classLevel: 'Class 2',
      subject: 'English',
      questionTitle: 'Fill in the Missing Sight Word',
      questionInstruction: 'Choose the word that correctly completes the sentence.',
      explanation: '"Sky" is the correct noun for the sentence context.',
      questionType: 'fill_blank',
      points: 10,
      timeLimitSeconds: 30,
      questionData: {
        sentence: 'The sun is shining in the ___ today.',
        answer: 'sky',
        options: ['sky', 'water', 'ground', 'forest'],
      },
    },
  ];
  return JSON.stringify(sample, null, 2);
}

/**
 * Returns JSON Schema documentation string for users to reference.
 */
export function generateQuestionJsonSchema(): string {
  return JSON.stringify(
    {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: 'QuestionDumpImportSchema',
      description: 'Schema definition for bulk importing questions into ELS-AI Question Bank.',
      type: 'array',
      items: {
        type: 'object',
        required: ['questionTitle', 'questionType'],
        properties: {
          classLevel: { type: 'string', description: 'Class level (e.g., "Class 1", "LKG", "Class 5")' },
          subject: { type: 'string', description: 'Subject title (e.g., "Mathematics", "Science")' },
          questionTitle: { type: 'string', description: 'Primary question prompt or question text' },
          questionInstruction: { type: 'string', description: 'Optional instruction guide for student' },
          explanation: { type: 'string', description: 'Optional answer explanation revealed post-submission' },
          questionType: {
            type: 'string',
            enum: [
              'guess_image',
              'drag_drop_match',
              'guess_audio',
              'true_false',
              'single_choice',
              'multi_choice',
              'logico',
              'memory_match',
              'fill_blank',
              'jigsaw',
            ],
            description: 'One of the 10 supported question type enums',
          },
          points: { type: 'number', default: 10, minimum: 0, maximum: 1000, description: 'Score weight' },
          timeLimitSeconds: { type: 'number', default: 30, minimum: 1, maximum: 600, description: 'Time limit in seconds' },
          sortOrder: { type: 'number', minimum: 0, maximum: 10000, description: 'Display order' },
          questionData: {
            type: 'object',
            description: 'Type-specific payload data container',
            properties: {
              prompt_image: { type: 'string', description: 'Main question image URL (required for guess_image & logico)' },
              prompt_audio: { type: 'string', description: 'Main prompt audio URL (required for guess_audio)' },
              options: {
                type: 'array',
                description: 'For choice types (single_choice, multi_choice, true_false, guess_image, guess_audio)',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'Unique option identifier' },
                    slot_position: { type: 'number', description: 'Option slot number (1-indexed)' },
                    label: { type: 'string', description: 'Option label or text (also accepts "text", "value", "option", "title")' },
                    image: { type: 'string', description: 'Option image URL (required for guess_image options)' },
                    audio: { type: 'string', description: 'Optional option audio URL' },
                    is_correct: { type: 'boolean', description: 'Set true for correct option(s)' },
                  },
                },
              },
              button_slot_map: {
                type: 'object',
                description: 'For logico type: object mapping 10 button IDs to slot positions 1-10',
              },
              drag_items: {
                type: 'array',
                description: 'For drag_drop_match: array of draggable items [{ id, label, image }]',
              },
              drop_targets: {
                type: 'array',
                description: 'For drag_drop_match: array of target slots [{ id, label }]',
              },
              match_rules: {
                type: 'array',
                description: 'For drag_drop_match: array of correct pairs [{ drag_item_id, drop_target_id }]',
              },
              sentence: { type: 'string', description: 'For fill_blank: sentence string containing "___"' },
              answer: { type: 'string', description: 'For fill_blank: exact correct fill-in word string' },
              gridSize: { type: 'string', enum: ['2x2', '3x3', '4x4', '5x5'], description: 'For jigsaw puzzle' },
              difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'], description: 'For jigsaw puzzle' },
            },
          },
        },
      },
    },
    null,
    2,
  );
}

/**
 * Downloads a string as a file in browser environment.
 */
export function downloadFileInBrowser(filename: string, content: string, mimeType = 'text/plain') {
  if (typeof window === 'undefined' || !window.document) return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = filename;
  window.document.body.appendChild(a);
  a.click();
  window.document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
