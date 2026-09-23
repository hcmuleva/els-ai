import { config } from 'dotenv';
config();
import { createDynamicProvider } from './dynamicModelProvider.js';
import { createOllamaProvider } from './ollamaProvider.js';
import type { AgentProvider, AgentRunEvent, ChatMessage } from './types.js';

/**
 * Per-role provider allowlist. `undefined` for a role means "every
 * registered provider is allowed" — the permissive default, since today
 * there's only one (free, local) provider and nothing to gate. This is the
 * seam for later restricting e.g. a paid provider to teacher/admin roles
 * without touching the router logic itself.
 */
const ROLE_PROVIDER_ALLOWLIST: Record<string, string[] | undefined> = {};

export type AgentRunParams = {
  /** Explicit provider id from the request, if the caller asked for one. */
  providerId?: string;
  /** Explicit model name from the request or env, if specified. */
  model?: string;
  role?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  format?: 'json';
  temperature?: number;
  signal?: AbortSignal;
};

export class UnknownProviderError extends Error {
  constructor(providerId: string, reason?: string) {
    super(reason ? `Unknown AI provider "${providerId}" (${reason})` : `Unknown AI provider "${providerId}"`);
  }
}

export class NoProviderAvailableError extends Error {
  constructor(cause?: unknown) {
    const reason = cause instanceof Error ? cause.message : cause ? String(cause) : undefined;
    super(reason ? `No AI provider is currently available: ${reason}` : 'No AI provider is currently available');
  }
}

class AgentRouter {
  private providers: AgentProvider[] = [];

  register(provider: AgentProvider) {
    this.providers.push(provider);
  }

  /** Providers a given role is allowed to use, in registration order. */
  private allowedProviders(role: string | undefined): AgentProvider[] {
    const allowlist = role ? ROLE_PROVIDER_ALLOWLIST[role] : undefined;
    if (!allowlist) return this.providers;
    return this.providers.filter((p) => allowlist.includes(p.id));
  }

  /** Metadata for a future provider-selector UI — id/label pairs the caller's role may use. */
  list(role?: string): Array<{ id: string; label: string }> {
    return this.allowedProviders(role).map((p) => ({ id: p.id, label: p.label }));
  }

  /**
   * Candidate provider chain for this run, in priority order:
   *   1. The explicitly-requested provider, if caller asked for one.
   *   2. Fallbacks in registration order (filtered to providers the caller's role may use).
   */
  private candidateChain(providerId: string | undefined, role: string | undefined): AgentProvider[] {
    const candidates = this.allowedProviders(role);
    if (!providerId) return candidates;
    const requested = candidates.find((p) => p.id === providerId);
    if (!requested) {
      throw new UnknownProviderError(providerId, `role "${role ?? 'unknown'}" cannot use it or it is not registered`);
    }
    return [requested, ...candidates.filter((p) => p.id !== providerId)];
  }

  /**
   * Run a prompt against the candidate chain with automatic fallback.
   *
   * Fallback only happens if the primary provider fails to *start* responding;
   * once a provider has started streaming text to the caller, switching
   * mid-response would silently splice together two different replies, so
   * a failure at that point is surfaced as an error instead.
   */
  async *run(params: AgentRunParams): AsyncGenerator<AgentRunEvent> {
    const chain = this.candidateChain(params.providerId, params.role);
    if (chain.length === 0) {
      throw new NoProviderAvailableError('no provider registered for this role');
    }

    let lastError: unknown;
    for (const provider of chain) {
      if (!params.providerId) {
        const available = await provider.isAvailable().catch(() => false);
        if (!available) continue;
      }
      yield { type: 'attempt', providerId: provider.id };
      let yieldedAny = false;
      try {
        for await (const event of provider.stream({
          messages: params.messages,
          model: params.model,
          maxTokens: params.maxTokens,
          format: params.format,
          temperature: params.temperature,
          signal: params.signal,
        })) {
          yieldedAny = true;
          yield { ...event, providerId: provider.id };
        }
        return; // provider completed its stream without throwing
      } catch (error) {
        lastError = error;
        if (yieldedAny) throw error; // already mid-response — don't splice in another provider
        continue; // never started responding — try the next candidate
      }
    }
    throw new NoProviderAvailableError(lastError);
  }
}

export const agentRouter = new AgentRouter();

// 1. Groq Provider (prioritized if GROQ_API_KEY is configured)
const groqApiKey = process.env.GROQ_API_KEY?.trim();
if (groqApiKey) {
  agentRouter.register(
    createDynamicProvider({
      id: 'groq',
      label: 'Groq',
      apiKey: groqApiKey,
      baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
      model: process.env.GROQ_MODEL,
    }),
  );
}

// 2. Factory AI Provider (only if an explicit chat completions BASE_URL is configured)
const factoryApiKey = process.env.FACTORY_API_KEY?.trim();
if (factoryApiKey && process.env.FACTORY_BASE_URL) {
  agentRouter.register(
    createDynamicProvider({
      id: 'factory',
      label: 'Factory AI',
      apiKey: factoryApiKey,
      baseUrl: process.env.FACTORY_BASE_URL,
      model: process.env.FACTORY_MODEL,
    }),
  );
}

// 2. Generic AI Provider (if AI_API_KEY is configured)
const aiApiKey = process.env.AI_API_KEY?.trim();
if (aiApiKey) {
  agentRouter.register(
    createDynamicProvider({
      id: 'ai',
      label: 'Dynamic AI Provider',
      apiKey: aiApiKey,
      baseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
      model: process.env.AI_MODEL,
    }),
  );
}

// 3. OpenAI Provider (if OPENAI_API_KEY is configured)
const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
if (openaiApiKey) {
  agentRouter.register(
    createDynamicProvider({
      id: 'openai',
      label: 'OpenAI',
      apiKey: openaiApiKey,
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      model: process.env.OPENAI_MODEL,
    }),
  );
}

// 4. Local Ollama Provider (fallback)
agentRouter.register(createOllamaProvider());

