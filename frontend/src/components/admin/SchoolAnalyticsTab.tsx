/**
 * School Analytics admin panel.
 *
 * Org-wide risk distribution, an at-risk student roster, and a
 * performance-trend forecast — the P2 "Admin AI: School Analytics / Risk
 * Detection / Performance Trends / Forecasts" backlog item.
 *
 * Fetches raw per-student and weekly aggregates from
 * `GET /quizzes/admin/analytics`; risk classification (Low/Medium/High) and
 * the trend forecast are computed here using the same shared heuristics
 * (`utils/riskForecast.ts`) already used by the parent Growth Trends report
 * and the teacher Student Activity list, so "risk" and "forecast" mean the
 * same thing on every screen. There's no ML/data-science service behind
 * this yet — it's a linear-trend + score-threshold heuristic, written
 * behind this same component/endpoint boundary so a dedicated analytics
 * service can replace the query later without any UI changes.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, Sparkles, TrendingUp, Users } from 'lucide-react-native';

import { Colors, Radius, Shadow } from '../../theme';
import { getStandardLabel } from '../../constants/standards';
import { Donut, LineChart, RiskRow, RISK_CLR } from '../reports/charts';
import { type RiskLevel, riskFromScore, projectNext, forecastSeries } from '../../utils/riskForecast';

type RosterEntry = {
  studentId: string;
  firstName: string;
  lastName: string;
  classLevel: string | null;
  attempts: number;
  averageScorePct: number;
};
type TrendPoint = { weekStart: string; attempts: number; averageScorePct: number };

type Props = {
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>;
};

const RISK_ORDER: RiskLevel[] = ['High', 'Medium', 'Low'];

function fmtWeek(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function SchoolAnalyticsTab({ apiFetch }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await apiFetch('/quizzes/admin/analytics');
        if (!res.ok) throw new Error('Failed to load school analytics');
        const data = await res.json();
        if (cancelled) return;
        setRoster((data.riskRoster ?? []) as RosterEntry[]);
        setTrend((data.performanceTrend ?? []) as TrendPoint[]);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load school analytics');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  const rankedRoster = useMemo(
    () =>
      roster
        .map((student) => ({ ...student, risk: riskFromScore(student.averageScorePct) }))
        .sort(
          (a, b) =>
            RISK_ORDER.indexOf(a.risk) - RISK_ORDER.indexOf(b.risk) ||
            a.averageScorePct - b.averageScorePct,
        ),
    [roster],
  );

  const distribution = useMemo(() => {
    const counts: Record<RiskLevel, number> = { Low: 0, Medium: 0, High: 0 };
    rankedRoster.forEach((student) => {
      counts[student.risk] += 1;
    });
    return counts;
  }, [rankedRoster]);

  const atRisk = useMemo(() => rankedRoster.filter((student) => student.risk !== 'Low'), [rankedRoster]);

  const trendChart = useMemo(() => {
    const actual = trend.map((t) => t.averageScorePct);
    const forecast = projectNext(actual);
    return {
      labels: [...trend.map((t) => fmtWeek(t.weekStart)), 'Next'],
      actualSeries: [...actual, null],
      forecastPoints: forecastSeries(actual, forecast),
      forecast,
    };
  }, [trend]);

  if (loading) {
    return (
      <View style={s.card}>
        <ActivityIndicator accessibilityLabel="Loading school analytics" size="small" color={Colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.card}>
        <Text style={s.emptyText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 16 }}>
      {/* Risk distribution */}
      <View style={s.card}>
        <View style={s.headerRow}>
          <View style={[s.headerIcon, { backgroundColor: '#FEE2E2' }]}>
            <AlertTriangle size={18} color="#B71C1C" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>Risk Distribution</Text>
            <Text style={s.cardHint}>
              Based on each student&rsquo;s average quiz score, among students who have attempted at least one quiz.
            </Text>
          </View>
        </View>
        {rankedRoster.length === 0 ? (
          <Text style={s.emptyText}>No quiz attempts recorded yet.</Text>
        ) : (
          <View style={s.distRow}>
            <Donut
              slices={(['High', 'Medium', 'Low'] as RiskLevel[]).map((level) => ({
                label: level,
                value: distribution[level],
                color: RISK_CLR[level].fg,
              }))}
              centerValue={String(rankedRoster.length)}
              centerLabel="students"
            />
            <View style={{ flex: 1, gap: 8, minWidth: 140 }}>
              {(['High', 'Medium', 'Low'] as RiskLevel[]).map((level) => (
                <View key={level} style={s.legendRow}>
                  <View style={[s.legendDot, { backgroundColor: RISK_CLR[level].fg }]} />
                  <Text style={s.legendLabel}>{level} risk</Text>
                  <Text style={s.legendValue}>{distribution[level]}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* At-risk roster */}
      <View style={s.card}>
        <View style={s.headerRow}>
          <View style={[s.headerIcon, { backgroundColor: Colors.primaryLight }]}>
            <Users size={18} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>Students Needing Attention</Text>
            <Text style={s.cardHint}>Sorted worst-first — the same risk levels shown on the teacher dashboard.</Text>
          </View>
        </View>
        {atRisk.length === 0 ? (
          <Text style={s.emptyText}>No students are currently flagged Medium or High risk.</Text>
        ) : (
          <View>
            {atRisk.slice(0, 20).map((student) => (
              <RiskRow
                key={student.studentId}
                label={`${student.firstName} ${student.lastName} · ${getStandardLabel(student.classLevel ?? '') || 'Unassigned'} · avg ${student.averageScorePct}%`}
                level={student.risk}
              />
            ))}
            {atRisk.length > 20 ? (
              <Text style={s.moreText}>+{atRisk.length - 20} more not shown</Text>
            ) : null}
          </View>
        )}
      </View>

      {/* Performance trend & forecast */}
      <View style={s.card}>
        <View style={s.headerRow}>
          <View style={[s.headerIcon, { backgroundColor: Colors.purpleLight }]}>
            <TrendingUp size={18} color={Colors.purple} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>Performance Trend &amp; Forecast</Text>
            <Text style={s.cardHint}>Weekly average quiz score, school-wide, last 8 weeks.</Text>
          </View>
        </View>
        {trend.length < 2 ? (
          <Text style={s.emptyText}>Not enough weekly data yet to chart a trend.</Text>
        ) : (
          <>
            <LineChart
              labels={trendChart.labels}
              series={[
                { label: 'Actual', color: Colors.primary, points: trendChart.actualSeries },
                { label: 'Forecast', color: Colors.primary, dashed: true, points: trendChart.forecastPoints },
              ]}
              yUnit="%"
            />
            <View style={s.insight}>
              <Sparkles size={13} color={Colors.purple} />
              <Text style={s.insightText}>
                {trendChart.forecast != null
                  ? `Based on the last ${trend.length} weeks, the projected school-wide average score next week is about ${Math.round(trendChart.forecast)}%.`
                  : 'Not enough data yet to forecast next week.'}
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.xl,
    padding: 16,
    gap: 12,
    ...Shadow.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 38, height: 38, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '900', color: Colors.text },
  cardHint: { fontSize: 12, color: Colors.textMuted, lineHeight: 17, fontWeight: '500' },
  emptyText: { fontSize: 13, color: Colors.textMuted, fontWeight: '600', paddingVertical: 8 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 20, flexWrap: 'wrap' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.text },
  legendValue: { fontSize: 13, fontWeight: '900', color: Colors.text },
  moreText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600', textAlign: 'center', paddingTop: 8 },
  insight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.purpleLight,
    borderRadius: Radius.md,
    padding: 10,
  },
  insightText: { flex: 1, fontSize: 12, fontWeight: '600', color: Colors.text, lineHeight: 17 },
});

export default SchoolAnalyticsTab;
