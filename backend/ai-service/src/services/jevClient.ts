/**
 * JevClient — Fast TypeSafe System One structured decision client.
 *
 * Implements the provider abstraction per better-chatbot.md:
 *   - Primitives: 'choice' (always with 'unclear'), 'noul' (specificity/validity), 'score' (concern/trend level)
 *   - Provider-agnostic: openjev.sh, OpenRouter, Vercel AI Gateway, or graceful local fallback
 */

export interface JevQuestionChoice {
  type: 'choice';
  instructions: string;
  criteria?: Record<string, string> | string[];
  choices?: string[];
}

export interface JevQuestionNoul {
  type: 'noul' | 'boolean';
  instructions: string;
}

export interface JevQuestionScore {
  type: 'score';
  instructions: string;
  criteria?: string[];
  scale?: { min: number; max: number };
}

export type JevQuestion = JevQuestionChoice | JevQuestionNoul | JevQuestionScore;

export interface JevAnswers {
  [key: string]: {
    value?: any;
    choice?: string;
    score?: number;
    confidence?: number;
    raw?: any;
  };
}

export interface JevEvaluationResult<T = JevAnswers> {
  success: boolean;
  data?: T;
  raw?: any;
  error?: string;
  latencyMs: number;
  fallbackUsed?: boolean;
}

export interface JevClient {
  ask<T extends Record<string, JevQuestion>>(
    state: unknown,
    questions: T,
    options?: { timeoutMs?: number }
  ): Promise<JevEvaluationResult<Record<keyof T, any>>>;
}

const OPENJEV_ENDPOINT = process.env.OPENJEV_URL || 'https://openjev.sh/v1/systemone';
const OPENROUTER_ENDPOINT = process.env.OPENROUTER_URL || 'https://openrouter.ai/api/v1/chat/completions';
const VERCEL_AI_GATEWAY_BASE = process.env.VERCEL_AI_GATEWAY_URL || 'https://ai-gateway.vercel.sh/v1';

export function isJevConfigured(): boolean {
  return Boolean(
    (process.env.OPENJEV_API_KEY && process.env.OPENJEV_API_KEY.trim().length > 0) ||
    (process.env.JEV_API_KEY && process.env.JEV_API_KEY.trim().length > 0) ||
    (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim().length > 0)
  );
}

/**
 * Heuristic fallback evaluator when external Jev endpoint is unreachable or in offline dev.
 * Provides safe defaults without breaking the conversation flow.
 */
function heuristicFallbackEvaluation(
  state: any,
  questions: Record<string, JevQuestion>
): JevAnswers {
  const result: JevAnswers = {};
  const stateStr = typeof state === 'string' ? state : JSON.stringify(state || '');
  const lower = stateStr.toLowerCase();

  for (const [key, q] of Object.entries(questions)) {
    if (q.type === 'choice') {
      const criteria = q.criteria;
      let matchedKey = 'unclear';

      if (criteria && !Array.isArray(criteria)) {
        for (const [choiceKey, desc] of Object.entries(criteria)) {
          if (choiceKey === 'unclear') continue;
          const keywords = `${choiceKey} ${desc}`.toLowerCase();
          if (keywords.split(/\s+/).some((kw) => kw.length > 3 && lower.includes(kw))) {
            matchedKey = choiceKey;
            break;
          }
        }
      } else if (Array.isArray(q.choices || criteria)) {
        const list = (q.choices || criteria) as string[];
        matchedKey = list.find((c) => lower.includes(c.toLowerCase())) || list[0] || 'unclear';
      }

      result[key] = {
        choice: matchedKey,
        value: matchedKey,
        confidence: matchedKey === 'unclear' ? 0.3 : 0.65,
      };
    } else if (q.type === 'noul' || q.type === 'boolean') {
      // Is message substantive (> 20 chars, has specific indicator)
      const hasContent = lower.length > 25 && !lower.includes("don't know") && !lower.includes('not sure');
      result[key] = {
        value: hasContent,
        confidence: hasContent ? 0.7 : 0.4,
      };
    } else if (q.type === 'score') {
      let scoreIdx = 0;
      if (lower.includes('critical') || lower.includes('severe') || lower.includes('struggl')) {
        scoreIdx = 3;
      } else if (lower.includes('concern') || lower.includes('issue') || lower.includes('sometimes')) {
        scoreIdx = 2;
      } else if (lower.includes('mild') || lower.includes('monitor') || lower.includes('better')) {
        scoreIdx = 1;
      }

      const criteria = q.criteria;
      const label = criteria && Array.isArray(criteria) && criteria[scoreIdx] ? criteria[scoreIdx] : undefined;

      result[key] = {
        score: scoreIdx,
        value: label ?? scoreIdx,
        choice: label,
        confidence: 0.6,
      };
    }
  }

  return result;
}

export class DefaultJevClient implements JevClient {
  async ask<T extends Record<string, JevQuestion>>(
    state: unknown,
    questions: T,
    options?: { timeoutMs?: number }
  ): Promise<JevEvaluationResult<Record<keyof T, any>>> {
    const startTime = Date.now();
    const timeoutMs = options?.timeoutMs || 8000;

    const apiKey =
      process.env.OPENJEV_API_KEY?.trim() ||
      process.env.JEV_API_KEY?.trim() ||
      process.env.OPENROUTER_API_KEY?.trim();

    if (!apiKey) {
      // Dev mode fallback
      const data = heuristicFallbackEvaluation(state, questions);
      return {
        success: true,
        data: data as any,
        latencyMs: Date.now() - startTime,
        fallbackUsed: true,
      };
    }

    try {
      // 1. Direct openjev.sh or Vercel AI Gateway POST /v1/systemone
      const isSystemOne = process.env.OPENJEV_URL || process.env.OPENJEV_API_KEY;
      const endpoint = isSystemOne ? OPENJEV_ENDPOINT : `${VERCEL_AI_GATEWAY_BASE}/evaluate`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openjev',
          state,
          questions,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      const latencyMs = Date.now() - startTime;
      const json: any = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.warn(`[JevClient] API returned ${response.status}: ${JSON.stringify(json)}. Falling back.`);
        const fallback = heuristicFallbackEvaluation(state, questions);
        return {
          success: true,
          data: fallback as any,
          latencyMs,
          fallbackUsed: true,
          error: json?.error?.message || `Status ${response.status}`,
        };
      }

      // Format response to standard structure
      const formatted: JevAnswers = {};
      const returnedData = json.data || json.questions || json;

      for (const key of Object.keys(questions)) {
        if (returnedData[key]) {
          formatted[key] = {
            value: returnedData[key].value ?? returnedData[key].choice ?? returnedData[key],
            choice: returnedData[key].choice ?? (typeof returnedData[key] === 'string' ? returnedData[key] : undefined),
            score: returnedData[key].score ?? (typeof returnedData[key] === 'number' ? returnedData[key] : undefined),
            confidence: returnedData[key].confidence ?? 0.85,
            raw: returnedData[key],
          };
        }
      }

      return {
        success: true,
        data: formatted as any,
        raw: json,
        latencyMs,
      };
    } catch (err: any) {
      console.warn(`[JevClient] Call failed (${err?.message}). Running safe heuristic fallback.`);
      const fallback = heuristicFallbackEvaluation(state, questions);
      return {
        success: true,
        data: fallback as any,
        latencyMs: Date.now() - startTime,
        fallbackUsed: true,
        error: err?.message,
      };
    }
  }
}

export const jevClient = new DefaultJevClient();

/**
 * Quick survey answer evaluator implementing Section 6.2 of better-chatbot.md
 */
export async function evaluateSurveyTurn(params: {
  topic: string;
  studentId: string;
  parentMessage: string;
}): Promise<{
  category: string;
  specificEnough: boolean;
  concernLevel: string;
  confidence: number;
  fallbackUsed?: boolean;
}> {
  const result = await jevClient.ask(
    {
      context: { topic_in_progress: params.topic, student_id: params.studentId },
      parent_message: params.parentMessage,
    },
    {
      category: {
        type: 'choice',
        instructions: 'Which report category does this answer belong to?',
        criteria: {
          weakness_academic: 'A specific academic difficulty or learning struggle',
          strength_academic: 'A specific academic strength, improvement, or passion',
          behavior: 'A behavioral, social, or emotional observation at home/school',
          unclear: "Doesn't clearly fit an assessment category or off-topic",
        },
      },
      specific_enough: {
        type: 'noul',
        instructions: 'Is this answer specific enough to log without an immediate follow-up question?',
      },
      concern_level: {
        type: 'score',
        instructions: "How concerning is this observation for the child's academic or developmental progress?",
        criteria: ['No concern', 'Mild, monitor', 'Moderate, worth flagging', 'Needs teacher attention'],
      },
    }
  );

  const category = result.data?.category?.choice || result.data?.category?.value || 'unclear';
  const specificEnough = Boolean(result.data?.specific_enough?.value);
  const concernLevel = result.data?.concern_level?.choice || result.data?.concern_level?.value || 'No concern';
  const confidence = result.data?.category?.confidence ?? 0.85;

  return {
    category,
    specificEnough,
    concernLevel: String(concernLevel),
    confidence,
    fallbackUsed: result.fallbackUsed,
  };
}

/**
 * Intent router for Performance Deep-Dive chat (Section 8 of better-chatbot.md)
 */
export async function classifyMetricIntent(query: string): Promise<{
  metricDomain: 'reading' | 'math' | 'quizzes' | 'attendance' | 'behavior' | 'general';
  confidence: number;
}> {
  const result = await jevClient.ask(
    { user_query: query },
    {
      metric_domain: {
        type: 'choice',
        instructions: 'Which student performance metric or domain is the user asking about?',
        criteria: {
          reading: 'Reading, phonics, stories, literature, language',
          math: 'Math, arithmetic, numbers, counting, logic',
          quizzes: 'Quiz scores, test attempts, accuracy, grades',
          attendance: 'Activity streaks, active days, video watch time',
          behavior: 'Classroom remarks, focus, attention, counseling',
          general: 'General progress summary or overall standing',
        },
      },
    }
  );

  const domain = (result.data?.metric_domain?.choice || 'general') as any;
  return {
    metricDomain: domain,
    confidence: result.data?.metric_domain?.confidence ?? 0.8,
  };
}

/**
 * Direct evaluation wrapper for jev.routes.ts
 */
export async function evaluateWithJev<T = Record<string, any>>(
  state: string,
  questions: Record<string, JevQuestion>,
  options?: { timeoutMs?: number }
): Promise<JevEvaluationResult<T>> {
  const res = await jevClient.ask(state, questions, options);
  return {
    success: res.success,
    data: res.data as any,
    raw: res.raw,
    error: res.error,
    latencyMs: res.latencyMs,
    fallbackUsed: res.fallbackUsed,
  };
}

/**
 * Categorization helper for jev.routes.ts
 */
export async function classifyWithJev(
  text: string,
  choices: string[],
  instructions = 'Select the best matching category'
): Promise<{ choice: string | null; error?: string }> {
  const res = await evaluateWithJev<{ category: { choice?: string } }>(text, {
    category: {
      type: 'choice',
      instructions,
      choices,
    },
  });

  if (!res.success || !res.data) {
    return { choice: null, error: res.error };
  }

  const selected = (res.data as any)?.category?.choice || null;
  return { choice: selected };
}

/**
 * Criteria verification helper for jev.routes.ts
 */
export async function verifyWithJev(
  content: string,
  criteria: string
): Promise<{ passed: boolean; score?: number; error?: string }> {
  const res = await evaluateWithJev<{
    satisfied: { value?: boolean };
    quality_score: { value?: number };
  }>(content, {
    satisfied: {
      type: 'boolean',
      instructions: `Does this content meet the following criteria: "${criteria}"?`,
    },
    quality_score: {
      type: 'score',
      instructions: 'Rate the quality from 1 to 10',
      scale: { min: 1, max: 10 },
    },
  });

  if (!res.success || !res.data) {
    return { passed: false, error: res.error };
  }

  return {
    passed: Boolean((res.data as any)?.satisfied?.value),
    score: (res.data as any)?.quality_score?.value,
  };
}
