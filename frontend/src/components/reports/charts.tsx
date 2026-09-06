/**
 * Reusable SVG/RN chart primitives for the student trend report.
 * Gauge · LineChart (date axis + forecast) · VBars · HBars · Donut ·
 * Radar · ActivityHeatmap · Timeline · RiskRow.
 */
import React, { useState } from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Polygon,
  Polyline,
  Text as SvgText,
} from 'react-native-svg';

import { Colors, Radius } from '../../theme';

export const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const round = (v: number) => Math.round(v);

// ── width-measuring wrapper ─────────────────────────────────────────────────
function Measured({ children }: { children: (w: number) => React.ReactNode }) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  return <View onLayout={onLayout}>{w > 0 ? children(w) : null}</View>;
}

// ── Gauge (semicircle) ──────────────────────────────────────────────────────
export function Gauge({
  value,
  max = 100,
  label,
  color = Colors.primary,
}: {
  value: number;
  max?: number;
  label?: string;
  color?: string;
}) {
  return (
    <Measured>
      {(w) => {
        const size = Math.min(w, 240);
        const r = size / 2 - 12;
        const cx = w / 2;
        const cy = r + 12;
        const arc = (f0: number, f1: number) => {
          const steps = Math.max(2, Math.round(46 * (f1 - f0)));
          const pts: string[] = [];
          for (let i = 0; i <= steps; i++) {
            const f = f0 + (f1 - f0) * (i / steps);
            const a = ((180 - f * 180) * Math.PI) / 180;
            pts.push(`${cx + r * Math.cos(a)},${cy - r * Math.sin(a)}`);
          }
          return pts.join(' ');
        };
        const frac = clamp(value / max, 0, 1);
        return (
          <Svg width={w} height={cy + 18}>
            <Polyline points={arc(0, 1)} stroke="#ECEFF5" strokeWidth={14} fill="none" strokeLinecap="round" />
            <Polyline points={arc(0, frac)} stroke={color} strokeWidth={14} fill="none" strokeLinecap="round" />
            <SvgText x={cx} y={cy - 4} fontSize={34} fontWeight="900" fill={Colors.text} textAnchor="middle">
              {round(value)}
            </SvgText>
            {label ? (
              <SvgText x={cx} y={cy + 14} fontSize={11} fontWeight="700" fill={Colors.textMuted} textAnchor="middle">
                {label}
              </SvgText>
            ) : null}
          </Svg>
        );
      }}
    </Measured>
  );
}

// ── Line chart (multi-series, date x-axis, optional dashed forecast) ─────────
export type LineSeries = {
  label: string;
  color: string;
  points: (number | null)[];
  dashed?: boolean;
};

export function LineChart({
  labels,
  series,
  height = 180,
  yMax = 100,
  yUnit = '',
  showValues = false,
}: {
  labels: string[];
  series: LineSeries[];
  height?: number;
  yMax?: number;
  yUnit?: string;
  showValues?: boolean;
}) {
  const padL = 30;
  const padR = 14;
  const padT = 14;
  const padB = 22;
  const n = labels.length;
  const many = n > 14;
  const dotR = n > 28 ? 0 : many ? 2 : 3.2;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => round(f * yMax));
  const hasData = series.some((s) => s.points.some((p) => p != null));
  const labelStep = Math.max(1, Math.ceil(n / 6));

  return (
    <Measured>
      {(w) => {
        const innerW = Math.max(w - padL - padR, 0);
        const innerH = height - padT - padB;
        const xFor = (i: number) =>
          padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
        const yFor = (v: number) =>
          padT + innerH - (clamp(v, 0, yMax) / yMax) * innerH;
        return (
          <Svg width={w} height={height}>
            {ticks.map((t) => {
              const y = yFor(t);
              return (
                <G key={t}>
                  <Line x1={padL} y1={y} x2={w - padR} y2={y} stroke={t === 0 ? '#D8D8E8' : '#F0F0F8'} strokeWidth={1} />
                  {/* #B0B0C8 measured 2.12:1 on white, well under 4.5:1; matched to the x-axis label color */}
                  <SvgText x={0} y={y + 3} fontSize={9} fill={Colors.textMuted} fontWeight="600">
                    {t}
                    {yUnit}
                  </SvgText>
                </G>
              );
            })}
            {labels.map((lb, i) => {
              if (i % labelStep !== 0 && i !== n - 1) return null;
              return (
                <SvgText key={i} x={xFor(i)} y={height - 6} fontSize={8.5} fill="#525C6B" fontWeight="700" textAnchor="middle">
                  {lb}
                </SvgText>
              );
            })}
            {series.map((s) => {
              const defined = s.points
                .map((v, i) => ({ v, i }))
                .filter((p): p is { v: number; i: number } => p.v != null);
              if (defined.length === 0) return null;
              const dPath = defined
                .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${xFor(p.i)} ${yFor(p.v)}`)
                .join(' ');
              return (
                <G key={s.label}>
                  {defined.length > 1 && (
                    <Path
                      d={dPath}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={s.dashed ? '5,4' : undefined}
                    />
                  )}
                  {dotR > 0 &&
                    defined.map((p) => (
                      <Circle key={p.i} cx={xFor(p.i)} cy={yFor(p.v)} r={dotR} fill={s.dashed ? '#fff' : s.color} stroke={s.color} strokeWidth={1.6} />
                    ))}
                  {showValues && !many &&
                    defined.map((p) => (
                      <SvgText key={`v${p.i}`} x={xFor(p.i)} y={yFor(p.v) - 7} fontSize={8.5} fontWeight="800" fill={s.color} textAnchor="middle">
                        {round(p.v)}
                        {yUnit}
                      </SvgText>
                    ))}
                </G>
              );
            })}
          </Svg>
        );
      }}
    </Measured>
  );
}

// ── Grouped vertical bars (RN) ──────────────────────────────────────────────
export function VBars({
  labels,
  groups,
  yMax = 100,
  unit = '',
  height = 130,
}: {
  labels: string[];
  groups: Array<{ color: string; values: (number | null)[] }>;
  yMax?: number;
  unit?: string;
  height?: number;
}) {
  const niceMax = yMax;
  return (
    <View style={{ paddingTop: 4 }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 28, height, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 6 }}>
          {/* #B0B0C8 measured 2.12:1 on white; matched to the x-axis label color below */}
          {[1, 0.75, 0.5, 0.25, 0].map((f) => (
            <Text key={f} style={{ fontSize: 9, color: Colors.textMuted, fontWeight: '600' }}>
              {round(niceMax * f)}
              {unit}
            </Text>
          ))}
        </View>
        <View style={{ flex: 1, height, justifyContent: 'flex-end' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: '100%', gap: 6 }}>
            {labels.map((_, i) => (
              <View key={i} style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 2, height: '100%' }}>
                {groups.map((g, gi) => {
                  const v = g.values[i] ?? 0;
                  const barH = Math.max(v > 0 ? 3 : 0, (clamp(v, 0, niceMax) / niceMax) * (height - 2));
                  return <View key={gi} style={{ flex: 1, height: barH, borderRadius: 4, backgroundColor: g.color, maxWidth: 16 }} />;
                })}
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginLeft: 28, marginTop: 6, gap: 6 }}>
        {labels.map((lb, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 8.5, color: '#525C6B', fontWeight: '700' }}>
            {lb}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ── Horizontal bars (RN) ────────────────────────────────────────────────────
export function HBars({
  items,
  max = 100,
  unit = '%',
}: {
  items: Array<{ label: string; value: number; color: string }>;
  max?: number;
  unit?: string;
}) {
  return (
    <View style={{ gap: 8 }}>
      {items.map((it) => (
        <View key={it.label} style={hb.row}>
          <Text style={hb.label} numberOfLines={1}>
            {it.label}
          </Text>
          <View style={hb.track}>
            <View style={[hb.fill, { width: `${clamp((it.value / max) * 100, 0, 100)}%`, backgroundColor: it.color }]} />
          </View>
          <Text style={[hb.val, { color: it.color }]}>
            {round(it.value)}
            {unit}
          </Text>
        </View>
      ))}
    </View>
  );
}
const hb = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { width: 96, fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  track: { flex: 1, height: 10, borderRadius: Radius.full, backgroundColor: Colors.border, overflow: 'hidden' },
  fill: { height: 10, borderRadius: Radius.full },
  val: { width: 42, textAlign: 'right', fontSize: 12, fontWeight: '800' },
});

// ── Donut / pie ─────────────────────────────────────────────────────────────
export function Donut({
  slices,
  size = 150,
  thickness = 20,
  centerValue,
  centerLabel,
}: {
  slices: Array<{ label: string; value: number; color: string }>;
  size?: number;
  thickness?: number;
  centerValue?: string;
  centerLabel?: string;
}) {
  const total = slices.reduce((a, sl) => a + sl.value, 0) || 1;
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;
  let offset = 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} stroke="#EEF0F6" strokeWidth={thickness} fill="none" />
        <G rotation={-90} originX={cx} originY={cy}>
          {slices.map((sl) => {
            const len = (sl.value / total) * C;
            const el = (
              <Circle
                key={sl.label}
                cx={cx}
                cy={cy}
                r={r}
                stroke={sl.color}
                strokeWidth={thickness}
                fill="none"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </G>
        {centerValue ? (
          <SvgText x={cx} y={cy - 2} fontSize={20} fontWeight="900" fill={Colors.text} textAnchor="middle">
            {centerValue}
          </SvgText>
        ) : null}
        {centerLabel ? (
          <SvgText x={cx} y={cy + 14} fontSize={9} fontWeight="700" fill={Colors.textMuted} textAnchor="middle">
            {centerLabel}
          </SvgText>
        ) : null}
      </Svg>
      <View style={{ flex: 1, gap: 6 }}>
        {slices.map((sl) => (
          <View key={sl.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: sl.color }} />
            <Text style={{ flex: 1, fontSize: 11, fontWeight: '600', color: Colors.textSecondary }}>{sl.label}</Text>
            <Text style={{ fontSize: 11, fontWeight: '800', color: Colors.text }}>{round(sl.value)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Radar / spider ──────────────────────────────────────────────────────────
export function Radar({
  axes,
  series,
  max = 100,
}: {
  axes: string[];
  series: Array<{ label: string; color: string; values: number[] }>;
  max?: number;
}) {
  const n = axes.length;
  return (
    <Measured>
      {(w) => {
        const size = Math.min(w, 280);
        const cx = w / 2;
        const cy = size / 2 + 6;
        const r = size / 2 - 34;
        const pt = (i: number, frac: number) => {
          const a = (-90 + (i * 360) / n) * (Math.PI / 180);
          return { x: cx + r * frac * Math.cos(a), y: cy + r * frac * Math.sin(a) };
        };
        return (
          <Svg width={w} height={size + 12}>
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <Polygon
                key={f}
                points={axes.map((_, i) => { const p = pt(i, f); return `${p.x},${p.y}`; }).join(' ')}
                fill="none"
                stroke="#ECEFF5"
                strokeWidth={1}
              />
            ))}
            {axes.map((_, i) => { const p = pt(i, 1); return <Line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#ECEFF5" strokeWidth={1} />; })}
            {series.map((se) => (
              <Polygon
                key={se.label}
                points={se.values.map((v, i) => { const p = pt(i, clamp(v / max, 0, 1)); return `${p.x},${p.y}`; }).join(' ')}
                fill={se.color}
                fillOpacity={0.18}
                stroke={se.color}
                strokeWidth={2}
              />
            ))}
            {axes.map((ax, i) => {
              const p = pt(i, 1.18);
              return (
                <SvgText key={ax} x={p.x} y={p.y} fontSize={8.5} fontWeight="700" fill={Colors.textSecondary} textAnchor="middle">
                  {ax}
                </SvgText>
              );
            })}
          </Svg>
        );
      }}
    </Measured>
  );
}

// ── Activity heatmap (calendar-style) ───────────────────────────────────────
export function ActivityHeatmap({
  intensityByDate,
  weeks = 12,
  color = Colors.primary,
}: {
  intensityByDate: Record<string, number>;
  weeks?: number;
  color?: string;
}) {
  const today = new Date();
  const dow = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(today.getDate() - dow - (weeks - 1) * 7);
  const cols: Array<Array<{ date: string; v: number }>> = [];
  for (let w = 0; w < weeks; w++) {
    const col: Array<{ date: string; v: number }> = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + w * 7 + d);
      const key = dt.toISOString().slice(0, 10);
      col.push({ date: key, v: intensityByDate[key] ?? 0 });
    }
    cols.push(col);
  }
  const maxV = Math.max(1, ...Object.values(intensityByDate));
  const shade = (v: number) => {
    if (v <= 0) return '#F1F3F9';
    const t = clamp(v / maxV, 0.2, 1);
    return color + Math.round(t * 255).toString(16).padStart(2, '0');
  };
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {cols.map((col, ci) => (
        <View key={ci} style={{ flex: 1, gap: 3 }}>
          {col.map((cell) => (
            <View key={cell.date} style={{ width: '100%', aspectRatio: 1, borderRadius: 3, backgroundColor: shade(cell.v) }} />
          ))}
        </View>
      ))}
    </View>
  );
}

// ── Timeline (RN) ───────────────────────────────────────────────────────────
export function Timeline({
  items,
}: {
  items: Array<{ title: string; meta?: string; description?: string; color?: string; emoji?: string }>;
}) {
  return (
    <View style={{ gap: 0 }}>
      {items.map((it, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ alignItems: 'center', width: 24 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: (it.color ?? Colors.primary) + '22', alignItems: 'center', justifyContent: 'center' }}>
              {it.emoji ? <Text style={{ fontSize: 11 }}>{it.emoji}</Text> : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: it.color ?? Colors.primary }} />}
            </View>
            {i < items.length - 1 && <View style={{ flex: 1, width: 2, backgroundColor: Colors.border, marginVertical: 2 }} />}
          </View>
          <View style={{ flex: 1, paddingBottom: i < items.length - 1 ? 14 : 0 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: Colors.text }}>{it.title}</Text>
              {it.meta ? <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.textMuted }}>{it.meta}</Text> : null}
            </View>
            {it.description ? <Text style={{ fontSize: 11.5, color: Colors.textSecondary, lineHeight: 17, marginTop: 2 }}>{it.description}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Risk row ────────────────────────────────────────────────────────────────
// fg values are darkened from the original palette (#1F8A5B/#C77B2B/#D63A3A),
// which measured 3.56:1 / 2.98:1 / 3.80:1 against their own bg — all under
// the 4.5:1 needed for this 11px bold label.
export const RISK_CLR: Record<string, { bg: string; fg: string }> = {
  Low: { bg: '#D4EFE3', fg: '#176B47' },
  Medium: { bg: '#FFF0DC', fg: '#8F4A17' },
  High: { bg: '#FEE2E2', fg: '#B71C1C' },
};
export function RiskRow({ label, level }: { label: string; level: 'Low' | 'Medium' | 'High' }) {
  const c = RISK_CLR[level];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Colors.borderLight }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text }}>{label}</Text>
      <View style={{ backgroundColor: c.bg, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 4 }}>
        <Text style={{ fontSize: 11, fontWeight: '900', color: c.fg }}>{level}</Text>
      </View>
    </View>
  );
}
