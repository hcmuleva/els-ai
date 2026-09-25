import * as Ably from 'ably';

let restClient: Ably.Rest | null = null;

function getAblyRest(): Ably.Rest | null {
  const key = process.env.ABLY_API_KEY;
  if (!key) return null;
  if (!restClient) {
    restClient = new Ably.Rest({ key });
  }
  return restClient;
}

export const ChatRealtime = {
  getChannelName(chatType: string, sessionId: string): string {
    return `chat:${chatType}:${sessionId}`;
  },

  getReviewChannelName(organizationId: string, teacherId?: string): string {
    return teacherId ? `review:${organizationId}:${teacherId}` : `review:${organizationId}`;
  },

  async publishMessage(
    chatType: string,
    sessionId: string,
    event: 'message' | 'typing' | 'slot_updated' | 'session_completed',
    data: Record<string, unknown>
  ): Promise<void> {
    const rest = getAblyRest();
    if (!rest) return;

    try {
      const channelName = this.getChannelName(chatType, sessionId);
      const channel = rest.channels.get(channelName);
      await channel.publish(event, data);
    } catch (err) {
      console.warn('[ChatRealtime] failed to publish message event', { chatType, sessionId, event, err });
    }
  },

  async publishReviewUpdate(
    organizationId: string,
    teacherId: string | undefined,
    data: Record<string, unknown>
  ): Promise<void> {
    const rest = getAblyRest();
    if (!rest) return;

    try {
      const channelName = this.getReviewChannelName(organizationId, teacherId);
      const channel = rest.channels.get(channelName);
      await channel.publish('review_needed', data);
    } catch (err) {
      console.warn('[ChatRealtime] failed to publish review update', { organizationId, teacherId, err });
    }
  },

  async issueChatToken(
    userId: string,
    chatType: string,
    sessionId: string
  ): Promise<{ tokenRequest: Ably.TokenRequest; channel: string } | null> {
    const rest = getAblyRest();
    if (!rest) return null;

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
    } catch (err) {
      console.error('[ChatRealtime] token request failed', err);
      return null;
    }
  },
};
