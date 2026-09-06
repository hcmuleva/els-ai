import { Platform } from 'react-native';

export type InvoiceStatus = 'pending' | 'paid' | 'expired' | 'renewed' | 'cancelled';

export type Invoice = {
  id: string;
  organizationId: string;
  organizationName?: string;
  organizationSubdomain?: string;
  subscriptionId?: string;
  planId?: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  billingKind: string;
  planName?: string;
  membershipTier?: string;
  billingCycle?: string;
  seatCount: number;
  subtotal: number;
  discountTotal: number;
  amountDue: number;
  currency: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  dueAt?: string | null;
  issuedAt?: string | null;
  paidAt?: string | null;
  paymentMethod?: string;
  paymentReference?: string;
  notes?: string;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  description?: string;
  membershipTier: 'bronze' | 'silver' | 'gold' | 'platinum';
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
  basePrice: number;
  offerDiscountPercent: number;
  specialDiscountPercent: number;
  groupDiscountPercent: number;
  maxUsersForGroupDiscount: number;
  isActive?: boolean;
};

const TIER_THEME: Record<SubscriptionPlan['membershipTier'], { from: string; to: string; accent: string; label: string }> = {
  bronze:   { from: '#F7C089', to: '#C46B2E', accent: '#7B3F00', label: 'Bronze'   },
  silver:   { from: '#D7DCE5', to: '#8C95A6', accent: '#3A475C', label: 'Silver'   },
  gold:     { from: '#FFE082', to: '#D49B17', accent: '#7A5800', label: 'Gold'     },
  platinum: { from: '#C8E1F4', to: '#5B7DA6', accent: '#1E3859', label: 'Platinum' },
};

export const tierTheme = (tier: SubscriptionPlan['membershipTier']) => TIER_THEME[tier] || TIER_THEME.silver;

export const statusColor = (status: InvoiceStatus) => {
  switch (status) {
    case 'paid':      return { bg: '#D4EFE3', fg: '#1F7A4D', border: '#52B788' };
    case 'pending':   return { bg: '#FFF0DC', fg: '#9C5B12', border: '#F4A261' };
    case 'expired':   return { bg: '#FEE2E2', fg: '#9B1C1C', border: '#EF4444' };
    case 'renewed':   return { bg: '#D6E8FF', fg: '#1E40AF', border: '#4A7FE0' };
    case 'cancelled': return { bg: '#E5E7EB', fg: '#374151', border: '#9CA3AF' };
  }
};

export const formatCurrency = (amount: number, currency = 'INR') => {
  const symbol = currency === 'INR' ? '\u20B9' : `${currency} `;
  return `${symbol}${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export function renderInvoiceHtml(invoice: Invoice, orgName?: string): string {
  const safe = (value?: string | null) => (value ? String(value) : '—');
  const accent = '#4A7FE0';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Invoice ${invoice.invoiceNumber}</title>
<style>
  *{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}
  body{margin:0;padding:32px;background:#F5F7FF;color:#1A1D3A;}
  .sheet{max-width:780px;margin:0 auto;background:#fff;border-radius:18px;padding:36px;box-shadow:0 12px 32px rgba(26,29,58,0.08);}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #E8ECF4;padding-bottom:24px;margin-bottom:24px;}
  .brand{display:flex;align-items:center;gap:12px;}
  .brand-mark{width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,${accent},#7AAFFF);}
  .brand-name{font-size:22px;font-weight:800;color:${accent};letter-spacing:1px;}
  .meta{text-align:right;}
  .meta h1{font-size:22px;margin:0 0 6px;color:#1A1D3A;}
  .meta p{margin:2px 0;color:#4B5563;font-size:12px;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;}
  .section{background:#F8F9FF;border-radius:12px;padding:16px;}
  .label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;margin-bottom:4px;}
  .value{font-size:14px;font-weight:600;color:#1A1D3A;}
  table{width:100%;border-collapse:collapse;margin-bottom:24px;}
  th,td{padding:10px 12px;text-align:left;font-size:13px;}
  thead th{background:#EAF1FB;color:#243447;font-weight:700;text-transform:uppercase;letter-spacing:.6px;font-size:11px;}
  tbody tr{border-bottom:1px solid #F0F2FA;}
  .totals{margin-left:auto;width:280px;}
  .totals .row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#4B5563;}
  .totals .row.grand{border-top:2px solid #4A7FE0;margin-top:8px;padding-top:12px;color:#1A1D3A;font-weight:800;font-size:16px;}
  .badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;}
  .badge-pending{background:#FFF0DC;color:#9C5B12;}
  .badge-paid{background:#D4EFE3;color:#1F7A4D;}
  .badge-expired{background:#FEE2E2;color:#9B1C1C;}
  .badge-renewed{background:#D6E8FF;color:#1E40AF;}
  .badge-cancelled{background:#E5E7EB;color:#374151;}
  .footer{margin-top:32px;padding-top:16px;border-top:1px dashed #E8ECF4;font-size:11px;color:#9CA3AF;text-align:center;}
</style>
</head>
<body>
<div class="sheet">
  <div class="header">
    <div class="brand">
      <div class="brand-mark"></div>
      <div>
        <div class="brand-name">ELS · AI</div>
        <div style="color:#9CA3AF;font-size:11px;">Smart Learning Platform</div>
      </div>
    </div>
    <div class="meta">
      <h1>Invoice</h1>
      <p><strong>${safe(invoice.invoiceNumber)}</strong></p>
      <p>Issued: ${formatDate(invoice.issuedAt)}</p>
      <p>Due: ${formatDate(invoice.dueAt)}</p>
      <p><span class="badge badge-${invoice.status}">${invoice.status}</span></p>
    </div>
  </div>
  <div class="grid">
    <div class="section">
      <div class="label">Billed To</div>
      <div class="value">${safe(orgName || invoice.organizationName)}</div>
      <p style="margin:4px 0 0;color:#4B5563;font-size:12px;">${safe(invoice.organizationSubdomain)}</p>
    </div>
    <div class="section">
      <div class="label">Subscription</div>
      <div class="value">${safe(invoice.planName)} · ${safe(invoice.membershipTier)}</div>
      <p style="margin:4px 0 0;color:#4B5563;font-size:12px;">Cycle: ${safe(invoice.billingCycle)} · Seats: ${invoice.seatCount}</p>
    </div>
  </div>
  <table>
    <thead><tr><th>Description</th><th>Seats</th><th>Period</th><th style="text-align:right;">Amount</th></tr></thead>
    <tbody>
      <tr>
        <td>
          <strong>${safe(invoice.planName)}</strong><br/>
          <span style="color:#9CA3AF;font-size:11px;">${safe(invoice.membershipTier)} · ${safe(invoice.billingCycle)}</span>
        </td>
        <td>${invoice.seatCount}</td>
        <td>${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}</td>
        <td style="text-align:right;">${formatCurrency(invoice.subtotal, invoice.currency)}</td>
      </tr>
    </tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
    <div class="row"><span>Discounts</span><span>- ${formatCurrency(invoice.discountTotal, invoice.currency)}</span></div>
    <div class="row grand"><span>Amount Due</span><span>${formatCurrency(invoice.amountDue, invoice.currency)}</span></div>
  </div>
  <div class="footer">
    Payment Method: ${safe(invoice.paymentMethod)} · Ref: ${safe(invoice.paymentReference)}<br/>
    ELS · AI billing — Generated for ${safe(orgName || invoice.organizationName)}. This invoice is auto generated.
  </div>
</div>
</body>
</html>`;
}

export function exportInvoice(invoice: Invoice, orgName?: string) {
  const html = renderInvoiceHtml(invoice, orgName);
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoice.invoiceNumber}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    const w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      setTimeout(() => {
        try { w.print(); } catch (_e) { /* ignore */ }
      }, 350);
    }
    return { ok: true, message: 'Invoice exported. Use Print → Save as PDF in the new tab.' };
  }
  return { ok: false, message: 'PDF export available on web only. Open the dashboard in browser to export.' };
}
