import { db } from '../db.js';

export type OrganizationSubscription = {
  id: string;
  organization_id: string;
  plan_id: string | null;
  status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';
  trial_start_at: string | null;
  trial_end_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  final_price: number | null;
  seat_count: number | null;
};

export async function getCurrentOrganizationSubscription(organizationId: string): Promise<OrganizationSubscription | null> {
  const result = await db.query(
    `SELECT id, organization_id, plan_id, status, trial_start_at, trial_end_at, starts_at, ends_at, final_price, seat_count
     FROM organization_subscriptions
     WHERE organization_id = $1::uuid
     ORDER BY created_at DESC
     LIMIT 1`,
    [organizationId],
  );
  if ((result.rowCount ?? 0) === 0) {
    return null;
  }
  return result.rows[0] as OrganizationSubscription;
}

export async function ensureTrialSubscription(organizationId: string): Promise<OrganizationSubscription> {
  const current = await getCurrentOrganizationSubscription(organizationId);
  if (current) {
    return current;
  }

  const created = await db.query(
    `INSERT INTO organization_subscriptions (
       organization_id,
       status,
       trial_start_at,
       trial_end_at,
       starts_at
     )
     VALUES (
       $1::uuid,
       'trialing',
       NOW(),
       NOW() + INTERVAL '14 days',
       NOW()
     )
     RETURNING id, organization_id, plan_id, status, trial_start_at, trial_end_at, starts_at, ends_at, final_price, seat_count`,
    [organizationId],
  );
  return created.rows[0] as OrganizationSubscription;
}

export async function enforceSubscriptionState(organizationId: string): Promise<OrganizationSubscription> {
  const subscription = await ensureTrialSubscription(organizationId);

  if (subscription.status === 'trialing' && subscription.trial_end_at) {
    const trialEnd = new Date(subscription.trial_end_at).getTime();
    if (!Number.isNaN(trialEnd) && trialEnd < Date.now()) {
      const updated = await db.query(
        `UPDATE organization_subscriptions
         SET status = 'expired', updated_at = NOW()
         WHERE id = $1
         RETURNING id, organization_id, plan_id, status, trial_start_at, trial_end_at, starts_at, ends_at, final_price, seat_count`,
        [subscription.id],
      );
      return updated.rows[0] as OrganizationSubscription;
    }
  }

  return subscription;
}

export function isSubscriptionActive(subscription: OrganizationSubscription): boolean {
  if (subscription.status === 'active') {
    if (!subscription.ends_at) return true;
    return new Date(subscription.ends_at).getTime() >= Date.now();
  }
  if (subscription.status === 'trialing') {
    if (!subscription.trial_end_at) return false;
    return new Date(subscription.trial_end_at).getTime() >= Date.now();
  }
  return false;
}
