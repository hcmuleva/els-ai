import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BookOpenCheck, Clock, Play, RotateCcw } from 'lucide-react-native';

import { useAuth } from '../../context/AuthContext';

type Story = {
  id: string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  status: 'draft' | 'scheduled' | 'live' | 'ended';
  scheduledAt: string | null;
  sectionCount?: number;
};

function useCountdown(target: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (!target) return null;
  const ms = Math.max(0, new Date(target).getTime() - now);
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return { d, h, m, s, totalMs: ms };
}

export default function StoryHomeStrip() {
  const { apiFetch } = useAuth();
  const [live, setLive] = useState<Story | null>(null);
  const [next, setNext] = useState<Story | null>(null);
  const [previous, setPrevious] = useState<Story[]>([]);
  const [progress, setProgress] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/stories/home/feed');
      if (res.ok) {
        const data = await res.json();
        setLive(data.live || null);
        setNext(data.nextScheduled || null);
        setPrevious(data.previous || []);
        setProgress(data.progress || null);
      }
    } catch { /* ignore */ }
  }, [apiFetch]);

  useEffect(() => { load(); }, [load]);

  const countdown = useCountdown(next?.scheduledAt || null);

  if (!live && !next && previous.length === 0) return null;

  const hasProgress = !!progress?.completed_section_ids?.length;
  const open = (id: string) => router.push(`/story/${id}` as any);

  return (
    <View style={s.container}>
      <View style={s.headerRow}>
        <BookOpenCheck size={18} color="#7C3AED" />
        <Text style={s.heading}>Stories</Text>
      </View>

      {live && (
        <TouchableOpacity style={s.liveCard} onPress={() => open(live.id)} activeOpacity={0.85}>
          {live.coverImageUrl ? (
            <Image source={{ uri: live.coverImageUrl }} style={s.liveCover} resizeMode="cover" />
          ) : (
            <View style={[s.liveCover, s.liveCoverFallback]}>
              <BookOpenCheck size={42} color="#fff" />
            </View>
          )}
          <View style={s.liveOverlay}>
            <View style={s.liveBadge}>
              <View style={s.liveDot} />
              <Text style={s.liveBadgeText}>LIVE</Text>
            </View>
            <Text style={s.liveTitle} numberOfLines={2}>{live.title}</Text>
            {!!live.description && <Text style={s.liveDesc} numberOfLines={2}>{live.description}</Text>}
            <View style={s.liveCta}>
              <Play size={14} color="#fff" />
              <Text style={s.liveCtaText}>{hasProgress ? 'Resume Story' : 'Start Story'}</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {next && countdown && (
        <View style={s.countdownCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.countdownEyebrow}>Next Story</Text>
            <Text style={s.countdownTitle} numberOfLines={1}>{next.title}</Text>
          </View>
          <View style={s.countdownGrid}>
            {countdown.d > 0 && <CountUnit label="d" value={countdown.d} />}
            <CountUnit label="h" value={countdown.h} />
            <CountUnit label="m" value={countdown.m} />
            <CountUnit label="s" value={countdown.s} />
          </View>
        </View>
      )}

      {previous.length > 0 && (
        <View style={{ marginTop: 14 }}>
          <Text style={s.subheading}>Previous Stories</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
            {previous.map((p) => (
              <TouchableOpacity key={p.id} style={s.prevCard} onPress={() => open(p.id)}>
                {p.coverImageUrl ? (
                  <Image source={{ uri: p.coverImageUrl }} style={s.prevCover} />
                ) : (
                  <View style={[s.prevCover, s.prevCoverFallback]}>
                    <BookOpenCheck size={24} color="#9B8EC4" />
                  </View>
                )}
                <View style={s.prevBody}>
                  <Text style={s.prevTitle} numberOfLines={2}>{p.title}</Text>
                  <View style={s.prevCta}>
                    <RotateCcw size={11} color="#7C3AED" />
                    <Text style={s.prevCtaText}>Replay</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function CountUnit({ label, value }: { label: string; value: number }) {
  return (
    <View style={s.countUnit}>
      <Text style={s.countVal}>{String(value).padStart(2, '0')}</Text>
      <Text style={s.countLbl}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: 16, marginTop: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  heading: { fontSize: 16, fontWeight: '900', color: '#1a1a2e' },
  subheading: { fontSize: 13, fontWeight: '800', color: '#5A6A8A', marginBottom: 8, paddingLeft: 4 },

  liveCard: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#0F0B1F', minHeight: 200 },
  liveCover: { width: '100%', height: 200 },
  liveCoverFallback: { backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
  liveOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: 'rgba(15,11,31,0.65)' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: '#EF4444', marginBottom: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  liveTitle: { fontSize: 18, fontWeight: '900', color: '#fff' },
  liveDesc: { fontSize: 12, color: '#E2D9F3', marginTop: 2 },
  liveCta: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#7C3AED', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, marginTop: 12 },
  liveCtaText: { color: '#fff', fontWeight: '900', fontSize: 13 },

  countdownCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, padding: 12, backgroundColor: '#FAF6FF', borderRadius: 14, borderWidth: 1, borderColor: '#E5D9F8' },
  countdownEyebrow: { fontSize: 10, fontWeight: '900', color: '#7C3AED', letterSpacing: 0.6, textTransform: 'uppercase' },
  countdownTitle: { fontSize: 14, fontWeight: '800', color: '#1a1a2e', marginTop: 2 },
  countdownGrid: { flexDirection: 'row', gap: 4 },
  countUnit: { minWidth: 36, paddingVertical: 4, paddingHorizontal: 4, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5D9F8', alignItems: 'center' },
  countVal: { fontSize: 14, fontWeight: '900', color: '#7C3AED', fontVariant: ['tabular-nums'] },
  countLbl: { fontSize: 9, fontWeight: '800', color: '#9B8EC4', textTransform: 'uppercase' },

  prevCard: { width: 140, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#ECEFF5' },
  prevCover: { width: '100%', height: 80 },
  prevCoverFallback: { backgroundColor: '#F2EAFE', alignItems: 'center', justifyContent: 'center' },
  prevBody: { padding: 8 },
  prevTitle: { fontSize: 12, fontWeight: '800', color: '#1a1a2e', minHeight: 32 },
  prevCta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  prevCtaText: { fontSize: 10, fontWeight: '800', color: '#7C3AED' },
});
