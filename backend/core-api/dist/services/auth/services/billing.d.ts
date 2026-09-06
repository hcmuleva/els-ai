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
export declare function getCurrentOrganizationSubscription(organizationId: string): Promise<OrganizationSubscription | null>;
export declare function ensureTrialSubscription(organizationId: string): Promise<OrganizationSubscription>;
export declare function enforceSubscriptionState(organizationId: string): Promise<OrganizationSubscription>;
export declare function isSubscriptionActive(subscription: OrganizationSubscription): boolean;
//# sourceMappingURL=billing.d.ts.map