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
  class_id?: string;
  class_level?: string;
  classLevel?: string;
  subject?: string;
  subject_id?: string;
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

  const class_id = String(raw.class_id || raw.class_level || '').trim();
  const class_level = String(raw.class_level || raw.classLevel || class_id || '').trim();
  const subject = String(raw.subject || '').trim();
  const subject_id = String(raw.subject_id || raw.subjectId || '').trim();

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
    class_id: class_id || undefined,
    class_level: class_level || undefined,
    subject_id: subject_id || undefined,
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
        class_id: class_id || null,
        class_level: class_level || null,
        subject: subject || null,
        subject_id: subject_id || null,
      },
    },
  };

  const item: ValidatedQuestionItem = {
    index: index + 1,
    raw,
    payload,
    title,
    questionType: normalizedType,
    class_id: class_id || undefined,
    class_level,
    classLevel: class_level,
    subject,
    subject_id: subject_id || undefined,
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
 * Returns JSON Schema documentation string for users / AI agents to reference.
 * Includes the full ELS-AI subject catalog so AI can emit correct subjectId UUIDs.
 */
export function generateQuestionJsonSchema(): string {
  // ─── ELS ACADEMY subject catalog (org: 8ba8388f-9907-486c-9883-3784c2f2f34e) ───
  // Source: SELECT id, title, class_level FROM subjects WHERE organization_id = '8ba8388f...'
  const SUBJECT_CATALOG = [
    // LKG
    { class_id: 'd2fdf067-670c-4448-8609-49a30b9c5b7e', class_level: 'LKG', subject: 'English',               subject_id: '2797303a-0464-4c96-8a05-a32765bd4829' },
    { class_id: 'd2fdf067-670c-4448-8609-49a30b9c5b7e', class_level: 'LKG', subject: 'Environmental Studies',  subject_id: '229b5140-e4cf-467f-a0a7-12023b146162' },
    { class_id: 'd2fdf067-670c-4448-8609-49a30b9c5b7e', class_level: 'LKG', subject: 'Hindi',                  subject_id: 'dc9e4653-e25b-408a-ac10-32fc8333082c' },
    { class_id: 'd2fdf067-670c-4448-8609-49a30b9c5b7e', class_level: 'LKG', subject: 'Mathematics',            subject_id: '7c08a847-95f9-4eb8-b740-01d9c00ea034' },
    // UKG
    { class_id: 'e5261013-9d6c-4481-a2f9-d595715c0106', class_level: 'UKG', subject: 'English',               subject_id: 'ba13718e-13b0-4772-981f-4e7cd695c5c9' },
    { class_id: 'e5261013-9d6c-4481-a2f9-d595715c0106', class_level: 'UKG', subject: 'Environmental Studies',  subject_id: 'd2608741-ba2d-4c21-a393-f033e87aeb80' },
    { class_id: 'e5261013-9d6c-4481-a2f9-d595715c0106', class_level: 'UKG', subject: 'Hindi',                  subject_id: 'a4374a0c-7e3f-4113-86f8-729dd71378fe' },
    { class_id: 'e5261013-9d6c-4481-a2f9-d595715c0106', class_level: 'UKG', subject: 'Mathematics',            subject_id: '66d6f16c-fcfb-4a41-8849-343efb35c4cc' },
    // Class 1
    { class_id: '97e208e0-8189-4a16-b68c-b7aa5efb41be', class_level: '1', subject: 'Computer Science',          subject_id: 'c919bf64-8085-48b2-9125-54119ed86611' },
    { class_id: '97e208e0-8189-4a16-b68c-b7aa5efb41be', class_level: '1', subject: 'English',                   subject_id: 'efa0f5a7-735c-42cd-ba67-cc70ffedb4fc' },
    { class_id: '97e208e0-8189-4a16-b68c-b7aa5efb41be', class_level: '1', subject: 'Environmental Studies (EVS)', subject_id: 'fd9ca7a2-7959-44fe-817e-930e511dcb1a' },
    { class_id: '97e208e0-8189-4a16-b68c-b7aa5efb41be', class_level: '1', subject: 'Hindi',                     subject_id: '943e74b3-9da3-43cc-be37-b3b8679a97d2' },
    { class_id: '97e208e0-8189-4a16-b68c-b7aa5efb41be', class_level: '1', subject: 'Mathematics',               subject_id: '3afa10fd-084f-4301-bb74-90b189e3128e' },
    // Class 2
    { class_id: 'd5101113-48f3-41e0-ab7f-3f0f435ae364', class_level: '2', subject: 'Computer Science',          subject_id: '023995fd-aa1c-4c11-b128-7e52e1f48952' },
    { class_id: 'd5101113-48f3-41e0-ab7f-3f0f435ae364', class_level: '2', subject: 'English',                   subject_id: '61f7c109-8530-4d31-b7f1-399d708e5ed9' },
    { class_id: 'd5101113-48f3-41e0-ab7f-3f0f435ae364', class_level: '2', subject: 'Environmental Studies (EVS)', subject_id: '77bbb81a-62c0-4aa6-ad8a-bbd7521f19eb' },
    { class_id: 'd5101113-48f3-41e0-ab7f-3f0f435ae364', class_level: '2', subject: 'Hindi',                     subject_id: '0ff13066-6be8-4db9-8c92-fb5dd4a70e7d' },
    { class_id: 'd5101113-48f3-41e0-ab7f-3f0f435ae364', class_level: '2', subject: 'Mathematics',               subject_id: 'c2e10612-558d-4f7b-978c-fb2abdf7d1f4' },
    // Class 3
    { class_id: 'a25bb4cb-662d-44e7-bef1-afe9d084deaf', class_level: '3', subject: 'Computer Science',          subject_id: '463975c8-7258-43a0-8c99-e9983ceb1758' },
    { class_id: 'a25bb4cb-662d-44e7-bef1-afe9d084deaf', class_level: '3', subject: 'English',                   subject_id: '46146236-1ca9-44d2-876d-a969dca6e3e0' },
    { class_id: 'a25bb4cb-662d-44e7-bef1-afe9d084deaf', class_level: '3', subject: 'Environmental Studies (EVS)', subject_id: 'acb7d540-2d41-4ef1-ae33-d42f80ae450f' },
    { class_id: 'a25bb4cb-662d-44e7-bef1-afe9d084deaf', class_level: '3', subject: 'Hindi',                     subject_id: '7584161b-bb1c-4d5b-880c-23630824f94c' },
    { class_id: 'a25bb4cb-662d-44e7-bef1-afe9d084deaf', class_level: '3', subject: 'Mathematics',               subject_id: 'ce67a922-85af-45fc-b6fb-7c01e7cba27e' },
    { class_id: 'a25bb4cb-662d-44e7-bef1-afe9d084deaf', class_level: '3', subject: 'science',                   subject_id: 'a47d7798-0582-4164-bfd1-35c2e630b506' },
    // Class 4
    { class_id: '676484ed-bed2-4e4f-b6c4-b51c47c670ba', class_level: '4', subject: 'Computer Science',          subject_id: '356caf40-324f-4b55-a32b-8abb209e35f2' },
    { class_id: '676484ed-bed2-4e4f-b6c4-b51c47c670ba', class_level: '4', subject: 'English',                   subject_id: '7affcce0-4b3a-4e72-ad80-41360a39db3a' },
    { class_id: '676484ed-bed2-4e4f-b6c4-b51c47c670ba', class_level: '4', subject: 'Environmental Studies (EVS)', subject_id: '6cfba8ae-9bd0-4eb5-8b69-2b79f82eb164' },
    { class_id: '676484ed-bed2-4e4f-b6c4-b51c47c670ba', class_level: '4', subject: 'Hindi',                     subject_id: '02fa6dbc-b823-4d5c-9e77-843a76371c56' },
    { class_id: '676484ed-bed2-4e4f-b6c4-b51c47c670ba', class_level: '4', subject: 'Mathematics',               subject_id: 'cd517f2c-9be4-4ee9-bd90-be07a128a6af' },
    // Class 5
    { class_id: '134ea666-f3e0-460c-812c-26e0f05ff9d6', class_level: '5', subject: 'Computer Science',          subject_id: 'c4745c2f-973e-4416-a62c-6420b2fbbb09' },
    { class_id: '134ea666-f3e0-460c-812c-26e0f05ff9d6', class_level: '5', subject: 'English',                   subject_id: 'c18b4f93-da05-4856-b4b3-de4c514b271a' },
    { class_id: '134ea666-f3e0-460c-812c-26e0f05ff9d6', class_level: '5', subject: 'Environmental Studies (EVS)', subject_id: 'a522f0b8-d2cf-4e65-97d2-ee84f3bd6bf0' },
    { class_id: '134ea666-f3e0-460c-812c-26e0f05ff9d6', class_level: '5', subject: 'Hindi',                     subject_id: 'c5bb89fd-9217-4257-ad0f-7022694169f7' },
    { class_id: '134ea666-f3e0-460c-812c-26e0f05ff9d6', class_level: '5', subject: 'Mathematics',               subject_id: '4254ab39-55a9-4e87-af2e-7961ed880f4f' },
    // Class 6
    { class_id: '09aeba73-31ee-4785-9d67-98381f304fba', class_level: '6', subject: 'Computer Science',          subject_id: '65427ad5-9980-4270-b535-ed09ea4c5fe2' },
    { class_id: '09aeba73-31ee-4785-9d67-98381f304fba', class_level: '6', subject: 'English',                   subject_id: '1b549128-8990-42a0-8b7b-603c8d69fd7d' },
    { class_id: '09aeba73-31ee-4785-9d67-98381f304fba', class_level: '6', subject: 'Hindi',                     subject_id: 'cbc1c9bd-1080-4e5d-85aa-674d305fedad' },
    { class_id: '09aeba73-31ee-4785-9d67-98381f304fba', class_level: '6', subject: 'Mathematics',               subject_id: '71416f26-dc28-4a4a-89b9-671e8cac431c' },
    { class_id: '09aeba73-31ee-4785-9d67-98381f304fba', class_level: '6', subject: 'Sanskrit',                  subject_id: '77bf723c-7d76-42df-9559-e19663b8827a' },
    { class_id: '09aeba73-31ee-4785-9d67-98381f304fba', class_level: '6', subject: 'Science',                   subject_id: '79e3da32-c7e6-4643-b681-573193fa89f9' },
    { class_id: '09aeba73-31ee-4785-9d67-98381f304fba', class_level: '6', subject: 'Social Science',            subject_id: '2471ed09-d4d6-4669-aef9-421a265c25db' },
    // Class 7
    { class_id: '05e57174-ac07-49c8-a3e8-e5977c350a29', class_level: '7', subject: 'Computer Science',          subject_id: '5c7c4fac-1b1f-4eb1-9a42-e76d67e5fa66' },
    { class_id: '05e57174-ac07-49c8-a3e8-e5977c350a29', class_level: '7', subject: 'English',                   subject_id: '38bf7643-8aa5-47c4-82ac-f071acef3571' },
    { class_id: '05e57174-ac07-49c8-a3e8-e5977c350a29', class_level: '7', subject: 'Hindi',                     subject_id: '7875fb6e-c722-417c-9810-cc305c2e006c' },
    { class_id: '05e57174-ac07-49c8-a3e8-e5977c350a29', class_level: '7', subject: 'Mathematics',               subject_id: '961f54f5-2538-46f0-8b28-a288f8190b6a' },
    { class_id: '05e57174-ac07-49c8-a3e8-e5977c350a29', class_level: '7', subject: 'Sanskrit',                  subject_id: '5b514a61-6e4e-442d-bd76-a416be3fa125' },
    { class_id: '05e57174-ac07-49c8-a3e8-e5977c350a29', class_level: '7', subject: 'Science',                   subject_id: '1a35d098-8b8f-417b-9c6b-87a1d57b9e3c' },
    { class_id: '05e57174-ac07-49c8-a3e8-e5977c350a29', class_level: '7', subject: 'Social Science',            subject_id: 'f42949b4-f3e8-41fc-b529-def19a863096' },
    // Class 8
    { class_id: 'b06ac9a5-8996-4256-b62d-8b4de8b7cb76', class_level: '8', subject: 'Computer Science',          subject_id: '9f4c5a6f-9eec-4276-9996-9f11d0e746b0' },
    { class_id: 'b06ac9a5-8996-4256-b62d-8b4de8b7cb76', class_level: '8', subject: 'English',                   subject_id: 'ed99b14b-0944-466d-ac9d-27a6918e9c64' },
    { class_id: 'b06ac9a5-8996-4256-b62d-8b4de8b7cb76', class_level: '8', subject: 'Hindi',                     subject_id: 'd36b44d2-49f4-45b0-ac8a-7b2783f47bd9' },
    { class_id: 'b06ac9a5-8996-4256-b62d-8b4de8b7cb76', class_level: '8', subject: 'Mathematics',               subject_id: 'cc4f0635-3ac5-43bb-a93f-8707da071e35' },
    { class_id: 'b06ac9a5-8996-4256-b62d-8b4de8b7cb76', class_level: '8', subject: 'Sanskrit',                  subject_id: 'cd8e00e4-59ae-472b-8407-48c5e52c0e9e' },
    { class_id: 'b06ac9a5-8996-4256-b62d-8b4de8b7cb76', class_level: '8', subject: 'Science',                   subject_id: 'eb62a1c9-cadf-4ce9-8f43-90a721f18136' },
    { class_id: 'b06ac9a5-8996-4256-b62d-8b4de8b7cb76', class_level: '8', subject: 'Social Science',            subject_id: 'b2bfba71-9ca5-4704-a04d-131bf80c599d' },
    // Class 9
    { class_id: '683ac047-4437-431d-9e6d-beb0e5a171c7', class_level: '9', subject: 'Computer Applications / IT', subject_id: 'd518df68-db0d-4d0e-bdd3-818d15f037bc' },
    { class_id: '683ac047-4437-431d-9e6d-beb0e5a171c7', class_level: '9', subject: 'English',                   subject_id: '621add2d-b223-451a-9767-f0b4d8b977e6' },
    { class_id: '683ac047-4437-431d-9e6d-beb0e5a171c7', class_level: '9', subject: 'Hindi',                     subject_id: '8b2934a1-0b5f-45a6-a7a2-f52c57266c92' },
    { class_id: '683ac047-4437-431d-9e6d-beb0e5a171c7', class_level: '9', subject: 'Mathematics',               subject_id: 'dffe87a3-85fa-4aae-a8a1-ceb79e2d3ac3' },
    { class_id: '683ac047-4437-431d-9e6d-beb0e5a171c7', class_level: '9', subject: 'Science (Physics, Chemistry, Biology)', subject_id: '94af1626-5828-4bd9-9a5a-e52c91ec52f9' },
    { class_id: '683ac047-4437-431d-9e6d-beb0e5a171c7', class_level: '9', subject: 'Social Science',            subject_id: '08a35f50-db22-470d-b793-7a6b78cbb809' },
    // Class 10
    { class_id: '5b36063c-3c35-4914-ba2d-e8aabe86713b', class_level: '10', subject: 'Computer Applications / IT', subject_id: '4c912acb-396f-4d81-a907-e794c8cea28d' },
    { class_id: '5b36063c-3c35-4914-ba2d-e8aabe86713b', class_level: '10', subject: 'English',                  subject_id: 'fa9b80fa-49f5-4b9f-befc-3f4154796dde' },
    { class_id: '5b36063c-3c35-4914-ba2d-e8aabe86713b', class_level: '10', subject: 'Hindi',                    subject_id: '6e9f55ff-3f0c-4f2f-85e6-5a4c283cf749' },
    { class_id: '5b36063c-3c35-4914-ba2d-e8aabe86713b', class_level: '10', subject: 'Mathematics',              subject_id: '7b054446-c922-4f2c-ad50-3fd763b486b4' },
    { class_id: '5b36063c-3c35-4914-ba2d-e8aabe86713b', class_level: '10', subject: 'Science (Physics, Chemistry, Biology)', subject_id: '2ff4b32a-7723-422d-a24f-e55df5e608ec' },
    { class_id: '5b36063c-3c35-4914-ba2d-e8aabe86713b', class_level: '10', subject: 'Social Science',           subject_id: '71d836d7-0eba-4bc7-bd1a-7e9fb72fe493' },
    // Class 11
    { class_id: '49ac1397-c4ca-4691-b8a9-cc56031f6b76', class_level: '11', subject: 'Accountancy',              subject_id: 'a7c8e712-4ef5-4451-8aa1-c30f82a36351' },
    { class_id: '49ac1397-c4ca-4691-b8a9-cc56031f6b76', class_level: '11', subject: 'Biology',                  subject_id: '8b7e5684-5fae-4112-9e0a-d2bea72c0c44' },
    { class_id: '49ac1397-c4ca-4691-b8a9-cc56031f6b76', class_level: '11', subject: 'Business Studies',         subject_id: '9a2af4cd-b644-4616-bbd5-80d1cad4d08b' },
    { class_id: '49ac1397-c4ca-4691-b8a9-cc56031f6b76', class_level: '11', subject: 'Chemistry',                subject_id: 'c58589b0-d81f-4c8e-a899-51429f6afad4' },
    { class_id: '49ac1397-c4ca-4691-b8a9-cc56031f6b76', class_level: '11', subject: 'Computer Science',         subject_id: 'f63982a4-c79a-421e-9089-99f427387a54' },
    { class_id: '49ac1397-c4ca-4691-b8a9-cc56031f6b76', class_level: '11', subject: 'Economics',                subject_id: 'dcd3f893-6727-451b-b6f8-1c96ea582209' },
    { class_id: '49ac1397-c4ca-4691-b8a9-cc56031f6b76', class_level: '11', subject: 'English',                  subject_id: '5e3844ea-a9af-44e4-8afc-18d0553592bb' },
    { class_id: '49ac1397-c4ca-4691-b8a9-cc56031f6b76', class_level: '11', subject: 'Geography',                subject_id: '9f0f1fbc-c9d5-4c03-b1e2-6cfdffb5600c' },
    { class_id: '49ac1397-c4ca-4691-b8a9-cc56031f6b76', class_level: '11', subject: 'History',                  subject_id: 'fb989606-5709-44a5-ada8-d917458ab3ae' },
    { class_id: '49ac1397-c4ca-4691-b8a9-cc56031f6b76', class_level: '11', subject: 'Mathematics',              subject_id: '979e0812-a8d9-4b44-84e6-9bd25f5327a8' },
    { class_id: '49ac1397-c4ca-4691-b8a9-cc56031f6b76', class_level: '11', subject: 'Physics',                  subject_id: 'fb36ae14-6b07-48fa-8c73-a7506bde9926' },
    { class_id: '49ac1397-c4ca-4691-b8a9-cc56031f6b76', class_level: '11', subject: 'Political Science',        subject_id: '3fe60bec-af75-4f46-bbc9-bdf1f1d94c5d' },
    { class_id: '49ac1397-c4ca-4691-b8a9-cc56031f6b76', class_level: '11', subject: 'Psychology',               subject_id: '4cacd6cf-6d82-48ad-aa23-c6d92e82267e' },
    // Class 12
    { class_id: '34990f56-efc2-4969-842c-2da9e8d595b3', class_level: '12', subject: 'Accountancy',              subject_id: '10991b5b-12c3-413c-b469-3032224c24b9' },
    { class_id: '34990f56-efc2-4969-842c-2da9e8d595b3', class_level: '12', subject: 'Biology',                  subject_id: 'a8829448-4945-4f92-9c49-cb89f4b56a1d' },
    { class_id: '34990f56-efc2-4969-842c-2da9e8d595b3', class_level: '12', subject: 'Business Studies',         subject_id: '0854fb40-0689-4f6f-9947-e21bb9fc2f8a' },
    { class_id: '34990f56-efc2-4969-842c-2da9e8d595b3', class_level: '12', subject: 'Chemistry',                subject_id: '41c9d057-a026-47f5-a8c1-4639b00f9960' },
    { class_id: '34990f56-efc2-4969-842c-2da9e8d595b3', class_level: '12', subject: 'Computer Science',         subject_id: '0993accf-90a3-4b93-a726-36683a5958db' },
    { class_id: '34990f56-efc2-4969-842c-2da9e8d595b3', class_level: '12', subject: 'Economics',                subject_id: '4e5d1067-fa9f-4a4d-a0d1-d1afb2e23b81' },
    { class_id: '34990f56-efc2-4969-842c-2da9e8d595b3', class_level: '12', subject: 'English',                  subject_id: 'ba370220-2848-47ee-ad77-19bd36845024' },
    { class_id: '34990f56-efc2-4969-842c-2da9e8d595b3', class_level: '12', subject: 'Geography',                subject_id: '0ddde61d-73ca-412e-9bf5-cdaabd8f61e2' },
    { class_id: '34990f56-efc2-4969-842c-2da9e8d595b3', class_level: '12', subject: 'History',                  subject_id: 'f1ba6cfa-ec78-4d0a-87f7-a602e8e152c2' },
    { class_id: '34990f56-efc2-4969-842c-2da9e8d595b3', class_level: '12', subject: 'Mathematics',              subject_id: 'b4385065-6ad0-4f0c-b7fa-9506539b504a' },
    { class_id: '34990f56-efc2-4969-842c-2da9e8d595b3', class_level: '12', subject: 'Physics',                  subject_id: '3b697807-e6ca-4485-9e76-4c3347b1f286' },
    { class_id: '34990f56-efc2-4969-842c-2da9e8d595b3', class_level: '12', subject: 'Political Science',        subject_id: 'abdab119-4ca8-468b-9b7f-917a3e604ceb' },
    { class_id: '34990f56-efc2-4969-842c-2da9e8d595b3', class_level: '12', subject: 'Psychology',               subject_id: 'eb642f4b-b830-47eb-8686-dbede20dcf68' },
    // ANY (cross-class enrichment subjects)
    { class_id: 'fb413eab-a5cb-40bc-adb0-7540fb40aa31', class_level: 'ANY', subject: 'Activity / Play-based Learning', subject_id: 'b2bf0f7f-7e83-4e54-9e55-b9727a6d2e72' },
    { class_id: 'fb413eab-a5cb-40bc-adb0-7540fb40aa31', class_level: 'ANY', subject: 'Brain Training',          subject_id: 'edfd90d6-0bfe-4fe4-ade1-e15dc7122935' },
    { class_id: 'fb413eab-a5cb-40bc-adb0-7540fb40aa31', class_level: 'ANY', subject: 'Creativity',              subject_id: '3b9bb762-2f7d-42e8-989f-564b455a0a77' },
    { class_id: 'fb413eab-a5cb-40bc-adb0-7540fb40aa31', class_level: 'ANY', subject: 'DIY & Crafts',            subject_id: '1a4043a0-a8fe-4d0e-8584-7682de1403e7' },
    { class_id: 'fb413eab-a5cb-40bc-adb0-7540fb40aa31', class_level: 'ANY', subject: 'Dharm',                   subject_id: '1a99dbfa-9e03-4c12-bf99-7c6385a86cb3' },
    { class_id: 'fb413eab-a5cb-40bc-adb0-7540fb40aa31', class_level: 'ANY', subject: 'Do You Know?',            subject_id: 'fcfa99ef-91f4-4cf7-9084-610466be51f6' },
    { class_id: 'fb413eab-a5cb-40bc-adb0-7540fb40aa31', class_level: 'ANY', subject: 'Drawing & Coloring',      subject_id: 'dfda290a-6031-4338-9f49-0f9248a9e653' },
    { class_id: 'fb413eab-a5cb-40bc-adb0-7540fb40aa31', class_level: 'ANY', subject: 'Experimental Learning',   subject_id: 'f5c4ae50-a329-44e5-8f91-101b35d34e7f' },
    { class_id: 'fb413eab-a5cb-40bc-adb0-7540fb40aa31', class_level: 'ANY', subject: 'Extracurricular Activities', subject_id: '55a25059-11f3-43c9-8c81-088fbe6a1771' },
    { class_id: 'fb413eab-a5cb-40bc-adb0-7540fb40aa31', class_level: 'ANY', subject: 'General Awareness',       subject_id: 'c23f7d0c-1e20-4693-9934-12c672905f4f' },
    { class_id: 'fb413eab-a5cb-40bc-adb0-7540fb40aa31', class_level: 'ANY', subject: 'General Knowledge',       subject_id: '80d7f6d5-6516-4aeb-be23-09a8b3ed485a' },
    { class_id: 'fb413eab-a5cb-40bc-adb0-7540fb40aa31', class_level: 'ANY', subject: 'How Things Work',         subject_id: '6b92ddee-7f63-46f5-bb39-ca4aa0e19258' },
    { class_id: 'fb413eab-a5cb-40bc-adb0-7540fb40aa31', class_level: 'ANY', subject: 'How to Think',            subject_id: '2192a81f-1b9e-43a8-a6f2-308f9599de10' },
    { class_id: 'fb413eab-a5cb-40bc-adb0-7540fb40aa31', class_level: 'ANY', subject: 'IQ Test',                 subject_id: '22025729-6f29-4a6e-9784-c6390d59c315' },
    { class_id: 'fb413eab-a5cb-40bc-adb0-7540fb40aa31', class_level: 'ANY', subject: 'Jr. Scientist',           subject_id: '37ab2eb1-1568-4c33-a892-dfd3acb372f3' },
    { class_id: 'fb413eab-a5cb-40bc-adb0-7540fb40aa31', class_level: 'ANY', subject: 'Logical Reasoning',       subject_id: '3a664e4f-3d64-46d7-9808-f18290f48667' },
    { class_id: 'fb413eab-a5cb-40bc-adb0-7540fb40aa31', class_level: 'ANY', subject: 'Memory Development',      subject_id: '0346dfa0-e042-42c5-bc50-171e8339bc0c' },
    { class_id: 'fb413eab-a5cb-40bc-adb0-7540fb40aa31', class_level: 'ANY', subject: 'Moral Values',            subject_id: '0d6cb140-acb6-457b-af1b-78e63214af41' },
    { class_id: 'fb413eab-a5cb-40bc-adb0-7540fb40aa31', class_level: 'ANY', subject: 'Puzzles & Logic',         subject_id: '00dc1050-8cdd-4657-93e0-f1b1f6d4344f' },
    { class_id: 'fb413eab-a5cb-40bc-adb0-7540fb40aa31', class_level: 'ANY', subject: 'Rhymes & Stories',        subject_id: '1485fe4f-8d75-41fe-b92a-4d16476cc63b' },
    { class_id: 'fb413eab-a5cb-40bc-adb0-7540fb40aa31', class_level: 'ANY', subject: 'Stories & Tales',         subject_id: 'd6e3d259-9ffe-4157-abd4-24538180292d' },
    { class_id: 'fb413eab-a5cb-40bc-adb0-7540fb40aa31', class_level: 'ANY', subject: 'Tips and Tricks',         subject_id: '333e66e6-ed41-43a6-b2e8-a161efaa438c' },
    { class_id: 'd2fdf067-670c-4448-8609-49a30b9c5b7e', class_level: 'LKG', subject: 'English',               subject_id: '2797303a-0464-4c96-8a05-a32765bd4829' },
    { class_id: 'd2fdf067-670c-4448-8609-49a30b9c5b7e', class_level: 'LKG', subject: 'Environmental Studies',  subject_id: '229b5140-e4cf-467f-a0a7-12023b146162' },
    { class_id: 'd2fdf067-670c-4448-8609-49a30b9c5b7e', class_level: 'LKG', subject: 'Hindi',                  subject_id: 'dc9e4653-e25b-408a-ac10-32fc8333082c' },
    { class_id: 'd2fdf067-670c-4448-8609-49a30b9c5b7e', class_level: 'LKG', subject: 'Mathematics',            subject_id: '7c08a847-95f9-4eb8-b740-01d9c00ea034' },
    { class_id: 'e5261013-9d6c-4481-a2f9-d595715c0106', class_level: 'UKG', subject: 'English',               subject_id: 'ba13718e-13b0-4772-981f-4e7cd695c5c9' },
    { class_id: 'e5261013-9d6c-4481-a2f9-d595715c0106', class_level: 'UKG', subject: 'Environmental Studies',  subject_id: 'd2608741-ba2d-4c21-a393-f033e87aeb80' },
    { class_id: 'e5261013-9d6c-4481-a2f9-d595715c0106', class_level: 'UKG', subject: 'Hindi',                  subject_id: 'a4374a0c-7e3f-4113-86f8-729dd71378fe' },
    { class_id: 'e5261013-9d6c-4481-a2f9-d595715c0106', class_level: 'UKG', subject: 'Mathematics',            subject_id: '66d6f16c-fcfb-4a41-8849-343efb35c4cc' }
  ];

  return JSON.stringify(
    {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: 'QuestionDumpImportSchema',
      description: [
        'Schema for bulk importing questions into ELS-AI Question Bank.',
        'IMPORTANT: Use class_id (UUID from class_levels PK) and subject_id (UUID from subjects table)',
        'instead of hardcoded labels or text strings.',
        'Look up class_id and subject_id from the subjectCatalog array below.',
      ].join(' '),
      type: 'array',
      items: {
        type: 'object',
        required: ['questionTitle', 'questionType'],
        properties: {
          class_id: {
            type: 'string',
            format: 'uuid',
            description: 'Class ID UUID matching class_levels primary key',
          },
          class_level: {
            type: 'string',
            enum: ['LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 'ANY'],
            description: 'Class level code string (e.g. "1", "LKG")',
          },
          subject_id: {
            type: 'string',
            format: 'uuid',
            description: 'UUID from the ELS-AI subjects table. Look up in subjectCatalog by class_id + subject.',
          },
          subject: {
            type: 'string',
            description: 'FALLBACK: Plain subject title string. Used only when subject_id is not provided.',
          },
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
                    label: { type: 'string', description: 'Option label or text' },
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
      subjectCatalog: SUBJECT_CATALOG,
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
