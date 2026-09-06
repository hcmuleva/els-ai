import { streamOllamaChat } from '../chat/ollamaClient.js';
import type { AgentProvider, AgentStreamEvent, AgentStreamParams } from './types.js';

/**
 * Wraps the existing Ollama wire client (chat/ollamaClient.ts) in the
 * generic `AgentProvider` shape so the router can treat it like any other
 * provider. Config is read lazily inside the factory (not at module load)
 * so tests/other callers can construct one against a different env.
 */
export function createOllamaProvider(): AgentProvider {
  const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');
  const model = process.env.OLLAMA_MODEL || 'llama3.2';

  return {
    id: 'ollama',
    label: `Local (Ollama · ${model})`,

    async isAvailable() {
      try {
        const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
        return res.ok;
      } catch {
        return false;
      }
    },

    async *stream({ messages, signal }: AgentStreamParams): AsyncGenerator<AgentStreamEvent> {
      for await (const event of streamOllamaChat({ baseUrl, model, messages, signal })) {
        if (event.type === 'delta') {
          yield { type: 'delta', text: event.text };
        } else {
          yield { type: 'usage', promptTokens: event.promptTokens, completionTokens: event.completionTokens };
        }
      }
    },
  };
}
