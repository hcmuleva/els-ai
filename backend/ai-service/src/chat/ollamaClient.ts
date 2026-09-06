export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type OllamaChatOptions = {
  baseUrl: string;
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
};

export type OllamaStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; promptTokens?: number; completionTokens?: number };

/**
 * Streams a chat completion from a local Ollama instance (`POST /api/chat`,
 * `stream: true`). Ollama streams newline-delimited JSON objects, one per
 * token/chunk, e.g. `{"message":{"content":"..."},"done":false}` ending with
 * a final `{"done":true,"prompt_eval_count":N,"eval_count":N,...}` object.
 * Yields accumulated text deltas plus a final `done` event carrying Ollama's
 * token counts (used for cost/usage tracking by the agent router), so
 * callers don't need to know Ollama's wire format.
 */
export async function* streamOllamaChat(options: OllamaChatOptions): AsyncGenerator<OllamaStreamEvent> {
  const { baseUrl, model, messages, signal } = options;

  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: true }),
      signal,
    });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`Could not reach Ollama at ${baseUrl} — is it running? (${reason})`);
  }

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Ollama request failed (${response.status}) — is Ollama running at ${baseUrl} with model "${model}" pulled? ${text}`,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf('\n');
        if (!line) continue;

        let parsed: any;
        try {
          parsed = JSON.parse(line);
        } catch {
          continue; // ignore partial/malformed lines rather than aborting the stream
        }
        if (parsed.error) throw new Error(`Ollama error: ${parsed.error}`);
        const chunk = parsed?.message?.content;
        if (typeof chunk === 'string' && chunk.length > 0) {
          yield { type: 'delta', text: chunk };
        }
        if (parsed.done) {
          yield {
            type: 'done',
            promptTokens: typeof parsed.prompt_eval_count === 'number' ? parsed.prompt_eval_count : undefined,
            completionTokens: typeof parsed.eval_count === 'number' ? parsed.eval_count : undefined,
          };
          return;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
