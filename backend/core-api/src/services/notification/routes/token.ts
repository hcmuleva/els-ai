import { Router } from 'express';
import * as Ably from 'ably';
import { requireAuth } from '../middleware/auth.js';

export const tokenRouter = Router();

let restClient: Ably.Rest | null = null;
function getRest(): Ably.Rest | null {
  const key = process.env.ABLY_API_KEY;
  if (!key) return null;
  if (!restClient) restClient = new Ably.Rest({ key });
  return restClient;
}

tokenRouter.post('/', requireAuth, async (req, res) => {
  const userId = (req as any).user?.userId as string | undefined;
  const orgId = (req as any).user?.organizationId as string | undefined;
  if (!userId || !orgId) return res.status(400).json({ message: 'User not found in auth context' });

  const rest = getRest();
  if (!rest) {
    return res.status(503).json({ message: 'Realtime notifications disabled (ABLY_API_KEY missing)' });
  }

  const channelName = `notification:${orgId}:${userId}`;
  try {
    const tokenRequest = await rest.auth.createTokenRequest({
      clientId: userId,
      capability: JSON.stringify({ [channelName]: ['subscribe', 'presence', 'history'] }),
      ttl: 60 * 60 * 1000,
    });
    return res.json({ tokenRequest, channel: channelName });
  } catch (err) {
    console.error('[notification-service] token request failed', err);
    return res.status(500).json({ message: 'Failed to issue Ably token' });
  }
});
