import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// Shape mirrors the report_json produced by the backend scoring engine.
export type CounselingReportData = {
  summary: {
    overallScore: number;
    level: string;
    growthPotential: string;
    studyPatternType: string;
  };
  studentProfile?: { name?: string; classLevel?: string; age?: number | string; board?: string };
  subjectPerformance: Array<{ subject: string; score: number; band: string; confidenceScore: number }>;
  skillAnalysis: {
    cognitiveStrengths: string[];
    behavioralTraits: Record<string, string>;
    socialEmotional: Record<string, string>;
  };
  keyInsights: string[];
  riskIndicators: Array<{ name: string; severity: string }>;
  recommendations: {
    subjectLevel: string[];
    skillLevel: string[];
    courseSuggestions: Array<{ track: string; level: string }>;
    aiInterventionSuggestion: string;
  };
  graphs: {
    radarSkills: { cognitive: number; behavioral: number; learning: number; emotional: number };
    subjectBars: Array<{ subject: string; score: number }>;
  };
  openResponse?: {
    weakness?: string;
    improvementAreas?: string;
    motivationTrigger?: string;
    parentComments?: string;
  };
};

const COLORS = {
  primary: '#4A7FE0',
  accent: '#FF7B54',
  success: '#52B788',
  warning: '#F4A261',
  purple: '#9B8EC4',
  text: '#1A1D3A',
  muted: '#525C6B',
  border: '#E8ECF4',
  bg: '#F5F7FF',
};

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function bandColor(band: string): string {
  if (band === 'Strong') return COLORS.success;
  if (band === 'Moderate') return COLORS.warning;
  return COLORS.accent;
}

function severityColor(sev: string): string {
  if (sev === 'High') return '#EF4444';
  if (sev === 'Medium') return COLORS.warning;
  return COLORS.muted;
}

// ── Circular score gauge ─────────────────────────────────────────────────────
function scoreGaugeSvg(score: number): string {
  const r = 54;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const dash = c * pct;
  const color = score >= 75 ? COLORS.success : score >= 45 ? COLORS.primary : COLORS.accent;
  return `
  <svg width="140" height="140" viewBox="0 0 140 140">
    <circle cx="70" cy="70" r="${r}" fill="none" stroke="${COLORS.border}" stroke-width="14" />
    <circle cx="70" cy="70" r="${r}" fill="none" stroke="${color}" stroke-width="14"
      stroke-linecap="round" stroke-dasharray="${dash} ${c}" transform="rotate(-90 70 70)" />
    <text x="70" y="66" text-anchor="middle" font-size="34" font-weight="800" fill="${COLORS.text}">${score}</text>
    <text x="70" y="90" text-anchor="middle" font-size="12" fill="${COLORS.muted}">/ 100</text>
  </svg>`;
}

// ── Subject bar chart ────────────────────────────────────────────────────────
function subjectBarsSvg(bars: Array<{ subject: string; score: number }>): string {
  const W = 460;
  const H = 200;
  const padL = 40;
  const padB = 46;
  const chartH = H - padB - 10;
  const barW = (W - padL - 20) / bars.length - 18;
  const ticks = [0, 25, 50, 75, 100];

  const gridlines = ticks
    .map((t) => {
      const y = 10 + chartH - (t / 100) * chartH;
      return `<line x1="${padL}" y1="${y}" x2="${W - 10}" y2="${y}" stroke="${COLORS.border}" stroke-width="1" />
        <text x="${padL - 6}" y="${y + 3}" text-anchor="end" font-size="9" fill="${COLORS.muted}">${t}</text>`;
    })
    .join('');

  const barsSvg = bars
    .map((b, i) => {
      const x = padL + 10 + i * ((W - padL - 20) / bars.length);
      const h = (b.score / 100) * chartH;
      const y = 10 + chartH - h;
      const color = b.score >= 70 ? COLORS.success : b.score >= 45 ? COLORS.warning : COLORS.accent;
      return `
        <rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="5" fill="${color}" />
        <text x="${x + barW / 2}" y="${y - 5}" text-anchor="middle" font-size="10" font-weight="700" fill="${COLORS.text}">${b.score}</text>
        <text x="${x + barW / 2}" y="${H - 26}" text-anchor="middle" font-size="9" fill="${COLORS.muted}">${esc(b.subject)}</text>`;
    })
    .join('');

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${gridlines}${barsSvg}</svg>`;
}

// ── Skills radar (4 axes) ────────────────────────────────────────────────────
function radarSvg(skills: { cognitive: number; behavioral: number; learning: number; emotional: number }): string {
  const size = 230;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 80;
  const axes = [
    { label: 'Cognitive', value: skills.cognitive, angle: -90 },
    { label: 'Behavioral', value: skills.behavioral, angle: 0 },
    { label: 'Learning', value: skills.learning, angle: 90 },
    { label: 'Emotional', value: skills.emotional, angle: 180 },
  ];
  const pt = (angleDeg: number, r: number) => {
    const a = (angleDeg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };

  const rings = [0.25, 0.5, 0.75, 1]
    .map((f) => {
      const pts = axes.map((ax) => pt(ax.angle, maxR * f).join(',')).join(' ');
      return `<polygon points="${pts}" fill="none" stroke="${COLORS.border}" stroke-width="1" />`;
    })
    .join('');

  const spokes = axes
    .map((ax) => {
      const [x, y] = pt(ax.angle, maxR);
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${COLORS.border}" stroke-width="1" />`;
    })
    .join('');

  const dataPts = axes.map((ax) => pt(ax.angle, maxR * (Math.max(0, Math.min(100, ax.value)) / 100)).join(',')).join(' ');

  const labels = axes
    .map((ax) => {
      const [x, y] = pt(ax.angle, maxR + 22);
      return `<text x="${x}" y="${y}" text-anchor="middle" font-size="10" font-weight="700" fill="${COLORS.text}">${ax.label}</text>
        <text x="${x}" y="${y + 12}" text-anchor="middle" font-size="9" fill="${COLORS.primary}">${ax.value}</text>`;
    })
    .join('');

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${rings}${spokes}
    <polygon points="${dataPts}" fill="${COLORS.primary}33" stroke="${COLORS.primary}" stroke-width="2" />
    ${labels}
  </svg>`;
}

function listHtml(items: string[]): string {
  if (!items || items.length === 0) return `<p class="muted">No items.</p>`;
  return `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
}

function chipRow(map: Record<string, string>): string {
  return `<div class="chips">${Object.entries(map)
    .map(([k, v]) => `<span class="chip"><b>${esc(k)}</b>: ${esc(v)}</span>`)
    .join('')}</div>`;
}

export function buildCounselingReportHtml(data: CounselingReportData): string {
  const p = data.studentProfile ?? {};
  const generatedAt = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  const subjectRows = data.subjectPerformance
    .map(
      (s) => `<tr>
        <td>${esc(s.subject)}</td>
        <td><b>${s.score}</b>/100</td>
        <td><span class="badge" style="background:${bandColor(s.band)}1a;color:${bandColor(s.band)}">${esc(s.band)}</span></td>
        <td>${Math.round(s.confidenceScore * 100)}%</td>
      </tr>`,
    )
    .join('');

  const risks = data.riskIndicators.length
    ? data.riskIndicators
        .map(
          (r) =>
            `<span class="badge" style="background:${severityColor(r.severity)}1a;color:${severityColor(r.severity)}">${esc(r.name)} · ${esc(r.severity)}</span>`,
        )
        .join(' ')
    : `<span class="muted">No significant risks detected.</span>`;

  const courses = data.recommendations.courseSuggestions
    .map((c) => `<li>${esc(c.track)} <span class="muted">(${esc(c.level)})</span></li>`)
    .join('');

  const open = data.openResponse ?? {};
  const openRows = [
    ['Key weaknesses', open.weakness],
    ['Improvement areas', open.improvementAreas],
    ['What motivates them', open.motivationTrigger],
    ['Parent comments', open.parentComments],
  ].filter(([, v]) => v && String(v).trim().length > 0);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: ${COLORS.text}; margin: 0; padding: 0; }
  .page { padding: 28px 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${COLORS.primary}; padding-bottom: 14px; }
  .brand { font-size: 13px; font-weight: 800; letter-spacing: .5px; }
  .brand .ai { color: ${COLORS.accent}; }
  .brand .els { color: ${COLORS.primary}; }
  h1 { font-size: 22px; margin: 4px 0 2px; }
  h2 { font-size: 15px; margin: 22px 0 10px; padding-bottom: 6px; border-bottom: 1px solid ${COLORS.border}; }
  .muted { color: ${COLORS.muted}; font-size: 12px; }
  .top { display: flex; gap: 20px; align-items: center; margin-top: 16px; background: ${COLORS.bg}; border-radius: 16px; padding: 16px; }
  .top .meta { flex: 1; }
  .pills span { display: inline-block; background: #fff; border: 1px solid ${COLORS.border}; border-radius: 999px; padding: 5px 12px; margin: 4px 6px 0 0; font-size: 12px; font-weight: 600; }
  .pills b { color: ${COLORS.primary}; }
  .charts { display: flex; gap: 20px; align-items: center; justify-content: space-around; flex-wrap: wrap; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid ${COLORS.border}; }
  th { color: ${COLORS.muted}; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; }
  .badge { display: inline-block; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; }
  ul { margin: 6px 0; padding-left: 18px; font-size: 12px; line-height: 1.7; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { background: ${COLORS.bg}; border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 5px 10px; font-size: 11px; }
  .grid2 { display: flex; gap: 22px; }
  .grid2 > div { flex: 1; }
  .callout { background: ${COLORS.primary}10; border-left: 4px solid ${COLORS.primary}; border-radius: 8px; padding: 10px 14px; font-size: 12px; margin-top: 10px; }
  .footer { margin-top: 26px; text-align: center; color: ${COLORS.muted}; font-size: 10px; }
</style></head>
<body><div class="page">
  <div class="header">
    <div>
      <div class="brand"><span class="els">ELS</span> · <span class="ai">AI</span></div>
      <h1>Student Counseling Report</h1>
      <div class="muted">Holistic assessment · ${esc(generatedAt)}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:16px;font-weight:800">${esc(p.name || 'Student')}</div>
      <div class="muted">${esc(p.classLevel ? 'Class ' + p.classLevel : '')} ${esc(p.board || '')}</div>
      <div class="muted">${esc(p.age ? 'Age ' + p.age : '')}</div>
    </div>
  </div>

  <div class="top">
    ${scoreGaugeSvg(data.summary.overallScore)}
    <div class="meta">
      <div style="font-size:13px;font-weight:700;color:${COLORS.muted}">OVERALL READINESS</div>
      <div class="pills">
        <span><b>Level:</b> ${esc(data.summary.level)}</span>
        <span><b>Growth:</b> ${esc(data.summary.growthPotential)}</span>
        <span><b>Study pattern:</b> ${esc(data.summary.studyPatternType)}</span>
      </div>
    </div>
  </div>

  <h2>Performance Snapshot</h2>
  <div class="charts">
    <div>${subjectBarsSvg(data.graphs.subjectBars)}</div>
    <div>${radarSvg(data.graphs.radarSkills)}</div>
  </div>

  <h2>Subject Performance</h2>
  <table>
    <tr><th>Subject</th><th>Score</th><th>Band</th><th>Confidence</th></tr>
    ${subjectRows}
  </table>

  <h2>Skill Analysis</h2>
  <div class="grid2">
    <div>
      <div class="muted">Cognitive strengths</div>
      ${listHtml(data.skillAnalysis.cognitiveStrengths)}
      <div class="muted">Behavioral traits</div>
      ${chipRow(data.skillAnalysis.behavioralTraits)}
    </div>
    <div>
      <div class="muted">Social & emotional</div>
      ${chipRow(data.skillAnalysis.socialEmotional)}
    </div>
  </div>

  <h2>Key Insights</h2>
  ${listHtml(data.keyInsights)}

  <h2>Risk Indicators</h2>
  <div class="chips">${risks}</div>

  <h2>Recommendations</h2>
  <div class="grid2">
    <div>
      <div class="muted">Subject focus</div>
      ${listHtml(data.recommendations.subjectLevel)}
    </div>
    <div>
      <div class="muted">Skill building</div>
      ${listHtml(data.recommendations.skillLevel)}
    </div>
  </div>
  <div class="muted" style="margin-top:8px">Suggested learning tracks</div>
  <ul>${courses || '<li class="muted">None</li>'}</ul>
  <div class="callout"><b>AI intervention:</b> ${esc(data.recommendations.aiInterventionSuggestion)}</div>

  ${
    openRows.length
      ? `<h2>Parent Notes</h2>${openRows
          .map(([label, v]) => `<p style="font-size:12px"><b>${esc(label)}:</b> ${esc(v)}</p>`)
          .join('')}`
      : ''
  }

  <div class="footer">Generated by ELS·AI Counseling Engine · This report is guidance for parents and educators, not a clinical diagnosis.</div>
</div></body></html>`;
}

// Renders the report to a PDF and opens the native share sheet (web: print dialog).
export async function exportCounselingReportPdf(data: CounselingReportData): Promise<void> {
  const html = buildCounselingReportHtml(data);

  if (Platform.OS === 'web') {
    const win = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 350);
    }
    return;
  }

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Counseling Report', UTI: 'com.adobe.pdf' });
  }
}
