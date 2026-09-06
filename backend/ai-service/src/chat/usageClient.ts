// Records one AI-provider invocation by calling back through the gateway to
// core-api's /ai-usage route, reusing the caller's own JWT — same
// call-back-through-the-gateway pattern as persistClient.ts. This is the
// "Cost Tracker" / "Audit" half of the multi-agent router (see
// agents/router.ts): every request the router serves, success or failure,
// gets one row so provider spend/reliability can be reported on later.

export type ProviderUsageInput = {
  provider: string;
  conversationId?: string;
  success: boolean;
  errorMessage?: string;
  promptTokens?: number;
  completionTokens?: number;
  durationMs?: number;
};

export async function recordProviderUsage(
  gatewayBaseUrl: string,
  authorization: string,
  input: ProviderUsageInput,
): Promise<void> {
  try {
    await fetch(`${gatewayBaseUrl}/ai-usage`, {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch (error) {
    // Usage logging is best-effort — never let a logging failure affect the
    // chat response the user is already looking at.
    console.error('[ai-chat] failed to record provider usage', error);
  }
}
