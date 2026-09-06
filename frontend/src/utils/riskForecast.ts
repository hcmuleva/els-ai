/**
 * Shared risk-classification and trend-forecast helpers.
 *
 * These originally lived only inside TrendAnalysisTab (the single-student
 * Growth Trends report). Extracted so the teacher Student Activity list and
 * the Admin School Analytics dashboard use the exact same definition of
 * "risk" and the exact same forecasting method — one source of truth
 * instead of three independent reimplementations that could quietly drift
 * apart (e.g. a student flagged "Medium" in one screen and "Low" in another
 * because of a slightly different threshold).
 *
 * These are lightweight statistical heuristics (score thresholds + an
 * ordinary-least-squares linear projection), not a trained ML model —
 * there's no data-science/ML service in this stack today. They're written
 * as small, pure functions with no framework/DB dependencies specifically
 * so a future dedicated analytics/forecasting service can be swapped in
 * behind these same call sites without touching any UI code, the same
 * pattern already used for AI providers in `agents/router.ts` on the
 * backend.
 */

export type RiskLevel = 'Low' | 'Medium' | 'High';

/**
 * Classifies a single 0-100 score into a risk band. Defaults (70/50) match
 * the thresholds already in production use for the single-student report;
 * pass different thresholds for a metric that isn't a 0-100 score
 * (e.g. attendance uses hi=75, mid=60 — attendance risk shows up earlier).
 */
export const riskFromScore = (v: number, hi = 70, mid = 50): RiskLevel =>
  v >= hi ? 'Low' : v >= mid ? 'Medium' : 'High';

/**
 * Combines several per-dimension risk levels (academic, attendance,
 * behavioral, ...) into one overall level: any High dominates, else any
 * Medium dominates, else Low.
 */
export const worstRisk = (levels: RiskLevel[]): RiskLevel =>
  levels.includes('High') ? 'High' : levels.includes('Medium') ? 'Medium' : 'Low';

/**
 * Projects the next value in a 0-100 series via ordinary least-squares
 * linear regression over the series' own index as x. Returns null when
 * there isn't enough data (fewer than 2 points) to fit a line.
 */
export function projectNext(vals: number[]): number | null {
  const ys = vals.filter((v) => v != null);
  if (ys.length < 2) return null;
  const n = ys.length;
  const xs = ys.map((_, i) => i);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den ? num / den : 0;
  const intercept = my - slope * mx;
  return Math.min(100, Math.max(0, intercept + slope * n));
}

/**
 * Builds a chart-ready dashed "forecast leg" series: nulls for every real
 * data point except the last one (so the dashed line visually starts where
 * the solid line ends), followed by the projected next value. Pair with a
 * solid series of `[...aligned, null]` for the "actual" line.
 */
export function forecastSeries(aligned: (number | null)[], next: number | null): (number | null)[] {
  const out: (number | null)[] = aligned.map(() => null);
  const lastIdx = [...aligned].reverse().findIndex((v) => v != null);
  if (lastIdx === -1 || next == null) return [...out, null];
  const realIdx = aligned.length - 1 - lastIdx;
  out[realIdx] = aligned[realIdx];
  return [...out, Math.round(next)];
}
