import { agentRouter } from '../agents/router.js';

/**
 * Attempts to parse JSON string with multiple resilient fallback strategies,
 * including extracting markdown code fences and repairing truncated JSON (unclosed strings/brackets).
 */
export function tryParseJson<T>(raw: string): T | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();

  // 1. Direct parse
  try {
    return JSON.parse(trimmed) as T;
  } catch {}

  // 2. Extract from markdown code fence ```json ... ```
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1].trim()) as T;
    } catch {}
  }

  // 3. Extract between first { and last }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as T;
    } catch {}
  }

  // 4. Attempt repair of truncated JSON (unclosed strings, brackets, or braces)
  let candidate = match && match[1] ? match[1].trim() : trimmed;
  if (firstBrace !== -1) {
    candidate = candidate.slice(firstBrace);
  }

  let inString = false;
  let escaped = false;
  const openStack: string[] = [];

  for (let i = 0; i < candidate.length; i++) {
    const char = candidate[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{' || char === '[') {
        openStack.push(char === '{' ? '}' : ']');
      } else if (char === '}' || char === ']') {
        if (openStack.length > 0 && openStack[openStack.length - 1] === char) {
          openStack.pop();
        }
      }
    }
  }

  let repaired = candidate;
  if (inString) {
    repaired += '"';
  }
  // Remove trailing comma if string ended with comma before closing
  repaired = repaired.replace(/,\s*$/, '');
  while (openStack.length > 0) {
    repaired += openStack.pop();
  }

  try {
    return JSON.parse(repaired) as T;
  } catch {}

  return null;
}

/**
 * Executes an LLM turn and parses the response into JSON type T.
 * Features structured JSON mode, resilient truncation repair, and automatic retry on invalid JSON.
 */
export async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<T> {
  const maxTokens = opts.maxTokens || 4500;
  const temperature = opts.temperature !== undefined ? opts.temperature : 0.75;

  // Attempt 1
  let fullText = '';
  for await (const event of agentRouter.run({
    maxTokens,
    format: 'json',
    temperature,
    messages: [
      {
        role: 'system',
        content: `${opts.system}\n\nIMPORTANT: Your response MUST be valid JSON only. Do not include introductory or concluding remarks.`,
      },
      { role: 'user', content: opts.prompt },
    ],
  })) {
    if (event.type === 'delta') {
      fullText += event.text;
    }
  }

  const parsed = tryParseJson<T>(fullText);
  if (parsed) return parsed;

  console.warn('[llmClient] Initial JSON parse failed or response truncated. Retrying once...');

  // Attempt 2 (Auto-retry with explicit repair instruction)
  let retryText = '';
  for await (const event of agentRouter.run({
    maxTokens,
    format: 'json',
    messages: [
      {
        role: 'system',
        content: `${opts.system}\n\nCRITICAL: Reply with ONLY a complete, syntactically valid JSON object. Do not truncate.`,
      },
      { role: 'user', content: opts.prompt },
      { role: 'assistant', content: fullText.slice(0, 1000) },
      { role: 'user', content: 'The previous output was cut off or malformed. Output ONLY the complete valid JSON now.' },
    ],
  })) {
    if (event.type === 'delta') {
      retryText += event.text;
    }
  }

  const retryParsed = tryParseJson<T>(retryText);
  if (retryParsed) return retryParsed;

  throw new Error(`Model did not return valid JSON: ${fullText.slice(0, 300)}`);
}
