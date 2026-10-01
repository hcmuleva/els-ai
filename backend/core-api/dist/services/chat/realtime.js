import * as Ably from 'ably';
let restClient = null;
function getAblyRest() {
    const key = process.env.ABLY_API_KEY;
    if (!key)
        return null;
    if (!restClient) {
        restClient = new Ably.Rest({ key });
    }
    return restClient;
}
export const ChatRealtime = {
    getChannelName(chatType, sessionId) {
        return `chat:${chatType}:${sessionId}`;
    },
    getReviewChannelName(organizationId, teacherId) {
        return teacherId ? `review:${organizationId}:${teacherId}` : `review:${organizationId}`;
    },
    async publishMessage(chatType, sessionId, event, data) {
        const rest = getAblyRest();
        if (!rest)
            return;
        try {
            const channelName = this.getChannelName(chatType, sessionId);
            const channel = rest.channels.get(channelName);
            await channel.publish(event, data);
        }
        catch (err) {
            console.warn('[ChatRealtime] failed to publish message event', { chatType, sessionId, event, err });
        }
    },
    async publishReviewUpdate(organizationId, teacherId, data) {
        const rest = getAblyRest();
        if (!rest)
            return;
        try {
            const channelName = this.getReviewChannelName(organizationId, teacherId);
            const channel = rest.channels.get(channelName);
            await channel.publish('review_needed', data);
        }
        catch (err) {
            console.warn('[ChatRealtime] failed to publish review update', { organizationId, teacherId, err });
        }
    },
    async issueChatToken(userId, chatType, sessionId) {
        const rest = getAblyRest();
        if (!rest)
            return null;
        const channelName = this.getChannelName(chatType, sessionId);
        try {
            const tokenRequest = await rest.auth.createTokenRequest({
                clientId: userId,
                capability: JSON.stringify({
                    [channelName]: ['subscribe', 'presence', 'history'],
                }),
                ttl: 60 * 60 * 1000,
            });
            return { tokenRequest, channel: channelName };
        }
        catch (err) {
            console.error('[ChatRealtime] token request failed', err);
            return null;
        }
    },
};
//# sourceMappingURL=realtime.js.map