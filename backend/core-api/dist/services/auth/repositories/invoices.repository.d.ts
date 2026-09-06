export type InvoiceStatus = 'pending' | 'paid' | 'expired' | 'renewed' | 'cancelled';
export declare const invoicesRepository: {
    findById(id: string): Promise<any>;
    listForOrganization(organizationId: string, filters: {
        status?: InvoiceStatus;
        from?: string;
        to?: string;
    }): Promise<any[]>;
    markPaid(id: string, paymentMethod: string, paymentReference: string, notes?: string): Promise<any>;
};
//# sourceMappingURL=invoices.repository.d.ts.map