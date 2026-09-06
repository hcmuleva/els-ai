// Persists AI-chat conversations/messages by calling back through the gateway
// to core-api's /ai-conversations routes, reusing the caller's own JWT — the
// same pattern already used by ../content-generator/persist.ts. ai-service
// itself has no direct DB connection by design (core-api is the single
// source of DB access for this platform).
async function requestJson(gatewayBaseUrl, authorization, path, options) {
    const response = await fetch(`${gatewayBaseUrl}${path}`, {
        method: options.method,
        headers: {
            Authorization: authorization,
            'Content-Type': 'application/json',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const payload = (await response.json().catch(() => ({})));
    return { status: response.status, data: payload };
}
export async function createConversation(gatewayBaseUrl, authorization, input) {
    const result = await requestJson(gatewayBaseUrl, authorization, '/ai-conversations', { method: 'POST', body: input });
    if (result.status !== 201 || !result.data.conversation) {
        throw new Error(result.data.message || 'Failed to create conversation');
    }
    return result.data.conversation;
}
export async function loadConversationMessages(gatewayBaseUrl, authorization, conversationId) {
    const result = await requestJson(gatewayBaseUrl, authorization, `/ai-conversations/${conversationId}/messages`, { method: 'GET' });
    if (result.status !== 200 || !result.data.conversation) {
        throw new Error(result.data.message || 'Conversation not found');
    }
    return { conversation: result.data.conversation, messages: result.data.messages || [] };
}
export async function appendMessage(gatewayBaseUrl, authorization, conversationId, input) {
    const result = await requestJson(gatewayBaseUrl, authorization, `/ai-conversations/${conversationId}/messages`, { method: 'POST', body: input });
    if (result.status !== 201 || typeof result.data.message !== 'object' || !result.data.message) {
        throw new Error('Failed to persist chat message');
    }
    return result.data.message;
}
