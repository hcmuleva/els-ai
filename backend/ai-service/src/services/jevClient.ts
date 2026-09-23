export interface JevQuestion {
  type: 'boolean' | 'choice' | 'score';
  instructions: string;
  choices?: string[];
  scale?: { min: number; max: number };
}

export interface JevEvaluationResult<T = Record<string, any>> {
  success: boolean;
  data?: T;
  raw?: any;
  error?: string;
  latencyMs?: number;
}

const VERCEL_AI_GATEWAY_BASE = process.env.VERCEL_AI_GATEWAY_URL || 'https://ai-gateway.vercel.sh/v1';

export function isJevConfigured(): boolean {
  return Boolean(process.env.JEV_API_KEY && process.env.JEV_API_KEY.trim().length > 0);
}

/**
 * Runs a structured evaluation using TypeSafe AI's Jev model on Vercel AI Gateway.
 * Jev is a System One evaluation model designed for fast, typed decisions (booleans, choices, scores).
 */
export async function evaluateWithJev<T = Record<string, any>>(
  state: string,
  questions: Record<string, JevQuestion>,
  options?: { timeoutMs?: number }
): Promise<JevEvaluationResult<T>> {
  const apiKey = process.env.JEV_API_KEY?.trim();
  if (!apiKey) {
    return {
      success: false,
      error: 'JEV_API_KEY is not configured in backend/ai-service/.env',
    };
  }

  const startTime = Date.now();
  try {
    const response = await fetch(`${VERCEL_AI_GATEWAY_BASE}/evaluate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'typesafe-ai/jev',
        state,
        questions,
      }),
      signal: AbortSignal.timeout(options?.timeoutMs || 10000),
    });

    const latencyMs = Date.now() - startTime;
    const json: any = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage = json?.error?.message || `Vercel AI Gateway returned status ${response.status}`;
      return {
        success: false,
        error: errorMessage,
        raw: json,
        latencyMs,
      };
    }

    return {
      success: true,
      data: json as T,
      raw: json,
      latencyMs,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to call Jev via Vercel AI Gateway',
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * Quick classification helper: evaluates text against a list of choices using Jev.
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

  const selected = res.data?.category?.choice || null;
  return { choice: selected };
}

/**
 * Quick verification / rubrics helper: checks if a statement or submission satisfies criteria.
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
    passed: Boolean(res.data?.satisfied?.value),
    score: res.data?.quality_score?.value,
  };
}
