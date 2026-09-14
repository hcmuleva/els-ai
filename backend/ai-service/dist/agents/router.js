import { config } from 'dotenv';
config();
import { createDynamicProvider } from './dynamicModelProvider.js';
import { createOllamaProvider } from './ollamaProvider.js';
/**
 * Per-role provider allowlist. `undefined` for a role means "every
 * registered provider is allowed" — the permissive default, since today
 * there's only one (free, local) provider and nothing to gate. This is the
 * seam for later restricting e.g. a paid provider to teacher/admin roles
 * without touching the router logic itself.
 */
const ROLE_PROVIDER_ALLOWLIST = {};
export class UnknownProviderError extends Error {
    constructor(providerId, reason) {
        super(reason ? `Unknown AI provider "${providerId}" (${reason})` : `Unknown AI provider "${providerId}"`);
    }
}
export class NoProviderAvailableError extends Error {
    constructor(cause) {
        const reason = cause instanceof Error ? cause.message : cause ? String(cause) : undefined;
        super(reason ? `No AI provider is currently available: ${reason}` : 'No AI provider is currently available');
    }
}
class AgentRouter {
    providers = [];
    register(provider) {
        this.providers.push(provider);
    }
    /** Providers a given role is allowed to use, in registration order. */
    allowedProviders(role) {
        const allowlist = role ? ROLE_PROVIDER_ALLOWLIST[role] : undefined;
        if (!allowlist)
            return this.providers;
        return this.providers.filter((p) => allowlist.includes(p.id));
    }
    /** Metadata for a future provider-selector UI — id/label pairs the caller's role may use. */
    list(role) {
        return this.allowedProviders(role).map((p) => ({ id: p.id, label: p.label }));
    }
    /**
     * Builds the fallback chain for a request: the explicitly-requested
     * provider first (if any and allowed for the role), then every other
     * allowed provider in registration order.
     */
    candidateChain(providerId, role) {
        const allowed = this.allowedProviders(role);
        if (!providerId)
            return allowed;
        const requested = allowed.find((p) => p.id === providerId);
        if (!requested) {
            const existsAtAll = this.providers.some((p) => p.id === providerId);
            throw new UnknownProviderError(providerId, existsAtAll ? 'not permitted for this role' : undefined);
        }
        return [requested, ...allowed.filter((p) => p.id !== providerId)];
    }
    /**
     * Streams a chat response, trying providers in order. Falls over to the
     * next candidate only if a provider fails before yielding any content —
     * once a provider has started streaming text to the caller, switching
     * mid-response would silently splice together two different replies, so
     * a failure at that point is surfaced as an error instead.
     */
    async *run(params) {
        const chain = this.candidateChain(params.providerId, params.role);
        if (chain.length === 0) {
            throw new NoProviderAvailableError('no provider registered for this role');
        }
        let lastError;
        for (const provider of chain) {
            if (!params.providerId) {
                const available = await provider.isAvailable().catch(() => false);
                if (!available)
                    continue;
            }
            yield { type: 'attempt', providerId: provider.id };
            let yieldedAny = false;
            try {
                for await (const event of provider.stream({
                    messages: params.messages,
                    model: params.model,
                    maxTokens: params.maxTokens,
                    format: params.format,
                    signal: params.signal,
                })) {
                    yieldedAny = true;
                    yield { ...event, providerId: provider.id };
                }
                return; // provider completed its stream without throwing
            }
            catch (error) {
                lastError = error;
                if (yieldedAny)
                    throw error; // already mid-response — don't splice in another provider
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
    agentRouter.register(createDynamicProvider({
        id: 'groq',
        label: 'Groq',
        apiKey: groqApiKey,
        baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
        model: process.env.GROQ_MODEL,
    }));
}
// 2. Factory AI Provider (only if an explicit chat completions BASE_URL is configured)
const factoryApiKey = process.env.FACTORY_API_KEY?.trim();
if (factoryApiKey && process.env.FACTORY_BASE_URL) {
    agentRouter.register(createDynamicProvider({
        id: 'factory',
        label: 'Factory AI',
        apiKey: factoryApiKey,
        baseUrl: process.env.FACTORY_BASE_URL,
        model: process.env.FACTORY_MODEL,
    }));
}
// 2. Generic AI Provider (if AI_API_KEY is configured)
const aiApiKey = process.env.AI_API_KEY?.trim();
if (aiApiKey) {
    agentRouter.register(createDynamicProvider({
        id: 'ai',
        label: 'Dynamic AI Provider',
        apiKey: aiApiKey,
        baseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
        model: process.env.AI_MODEL,
    }));
}
// 3. OpenAI Provider (if OPENAI_API_KEY is configured)
const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
if (openaiApiKey) {
    agentRouter.register(createDynamicProvider({
        id: 'openai',
        label: 'OpenAI',
        apiKey: openaiApiKey,
        baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        model: process.env.OPENAI_MODEL,
    }));
}
// 4. Local Ollama Provider (fallback)
agentRouter.register(createOllamaProvider());
