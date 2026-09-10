const modelCache = new Map();
function normalizeBaseUrl(rawUrl) {
    let url = (rawUrl || 'https://api.factory.ai/v1').trim().replace(/\/$/, '');
    if (url.endsWith('/chat/completions')) {
        url = url.slice(0, -'/chat/completions'.length);
    }
    return url.replace(/\/$/, '');
}
/**
 * Dynamically queries the provider's /models endpoint to discover available AI models.
 * Caches results in memory for 5 minutes.
 */
export async function fetchAvailableModels(rawBaseUrl, apiKey, timeoutMs = 4000) {
    const cleanBase = normalizeBaseUrl(rawBaseUrl);
    const cached = modelCache.get(cleanBase);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.models;
    }
    try {
        const res = await fetch(`${cleanBase}/models`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok)
            return [];
        const json = (await res.json());
        let list = [];
        if (Array.isArray(json?.data)) {
            list = json.data.map((m) => (typeof m === 'string' ? m : m?.id)).filter(Boolean);
        }
        else if (Array.isArray(json?.models)) {
            list = json.models.map((m) => (typeof m === 'string' ? m : m?.id || m?.name)).filter(Boolean);
        }
        if (list.length > 0) {
            modelCache.set(cleanBase, { models: list, expiresAt: Date.now() + 5 * 60 * 1000 });
        }
        return list;
    }
    catch {
        return [];
    }
}
/**
 * Creates an AgentProvider that works dynamically with any OpenAI-compatible AI API
 * (Factory AI, OpenAI, Groq, OpenRouter, DeepSeek, vLLM, etc.) with automatic
 * model detection and SSE streaming.
 */
export function createDynamicProvider(config) {
    const apiKey = config.apiKey.trim();
    const baseUrl = normalizeBaseUrl(config.baseUrl);
    return {
        id: config.id,
        label: config.label,
        async isAvailable() {
            if (!apiKey)
                return false;
            // If we have an API key, check if /models or the endpoint responds
            try {
                const models = await fetchAvailableModels(baseUrl, apiKey, 2500);
                return models.length > 0 || true;
            }
            catch {
                return Boolean(apiKey);
            }
        },
        async *stream({ messages, model: requestModel, signal }) {
            if (!apiKey) {
                throw new Error(`API key missing for provider "${config.id}"`);
            }
            // 1. Dynamic model selection:
            // Request model -> configured default model -> dynamically detected model -> fallback default
            let chosenModel = requestModel || config.model;
            if (!chosenModel) {
                const detected = await fetchAvailableModels(baseUrl, apiKey);
                if (detected.length > 0) {
                    const eligible = detected.filter((m) => !/whisper|guard|safeguard|embed|tts|audio/i.test(m));
                    chosenModel =
                        eligible.find((m) => /qwen|gpt|llama|claude|mistral|deepseek|compound/i.test(m)) ||
                            eligible[0] ||
                            detected[0];
                }
            }
            if (!chosenModel) {
                chosenModel = 'qwen/qwen3.8-27b';
            }
            const requestUrl = `${baseUrl}/chat/completions`;
            let res;
            try {
                res = await fetch(requestUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        model: chosenModel,
                        messages,
                        stream: true,
                        stream_options: { include_usage: true },
                    }),
                    signal,
                });
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                throw new Error(`Failed to connect to ${config.label} at ${baseUrl}: ${msg}`);
            }
            if (!res.ok || !res.body) {
                const errText = await res.text().catch(() => '');
                throw new Error(`${config.label} returned HTTP ${res.status}: ${errText || res.statusText}`);
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done)
                        break;
                    buffer += decoder.decode(value, { stream: true });
                    let newlineIndex = buffer.indexOf('\n');
                    while (newlineIndex !== -1) {
                        const line = buffer.slice(0, newlineIndex).trim();
                        buffer = buffer.slice(newlineIndex + 1);
                        newlineIndex = buffer.indexOf('\n');
                        if (!line || !line.startsWith('data:'))
                            continue;
                        const payload = line.slice(5).trim();
                        if (payload === '[DONE]')
                            return;
                        let parsed;
                        try {
                            parsed = JSON.parse(payload);
                        }
                        catch {
                            continue;
                        }
                        if (parsed?.error) {
                            const errMsg = typeof parsed.error === 'string' ? parsed.error : parsed.error.message || JSON.stringify(parsed.error);
                            throw new Error(`${config.label} stream error: ${errMsg}`);
                        }
                        const delta = parsed?.choices?.[0]?.delta;
                        const textChunk = delta?.content || delta?.reasoning_content;
                        if (typeof textChunk === 'string' && textChunk.length > 0) {
                            yield { type: 'delta', text: textChunk };
                        }
                        if (parsed?.usage) {
                            yield {
                                type: 'usage',
                                promptTokens: parsed.usage.prompt_tokens,
                                completionTokens: parsed.usage.completion_tokens,
                            };
                        }
                    }
                }
            }
            finally {
                reader.releaseLock();
            }
        },
    };
}
