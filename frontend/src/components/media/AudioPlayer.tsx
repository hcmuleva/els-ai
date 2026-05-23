import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Audio } from 'expo-av';
import { SkipBack, SkipForward, Play, Pause } from 'lucide-react-native';

type Props = {
  uri: string;
  title: string;
  subtitle?: string;
  emoji?: string;
  accentColor?: string;
  bgColor?: string;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
};

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AudioPlayer({
  uri, title, subtitle, emoji = '🎵',
  accentColor = '#9B8EC4', bgColor = '#EDE4FF',
  onPrev, onNext, hasPrev = false, hasNext = false,
}: Props) {
  const soundRef  = useRef<Audio.Sound | null>(null);
  const [status,  setStatus]  = useState<'loading' | 'ready' | 'error'>('loading');
  const [playing, setPlaying] = useState(false);
  const [pos,     setPos]     = useState(0);   // ms
  const [dur,     setDur]     = useState(0);   // ms

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true },
          (s) => {
            if (!mounted) return;
            if (s.isLoaded) {
              setPos(s.positionMillis ?? 0);
              setDur(s.durationMillis ?? 0);
              setPlaying(s.isPlaying);
            }
          },
        );
        soundRef.current = sound;
        if (mounted) setStatus('ready');
      } catch {
        if (mounted) setStatus('error');
      }
    };

    load();
    return () => {
      mounted = false;
      soundRef.current?.unloadAsync();
    };
  }, [uri]);

  const togglePlay = async () => {
    const s = soundRef.current;
    if (!s) return;
    if (playing) await s.pauseAsync();
    else         await s.playAsync();
  };

  const seek = async (pct: number) => {
    if (!soundRef.current || dur === 0) return;
    await soundRef.current.setPositionAsync(Math.floor(pct * dur));
  };

  const progress = dur > 0 ? pos / dur : 0;

  return (
    <View style={[ap.card, { backgroundColor: bgColor }]}>
      {/* Top row: artwork + info */}
      <View style={ap.topRow}>
        <View style={[ap.artBox, { backgroundColor: `${accentColor}20` }]}>
          <Text style={ap.artEmoji}>{emoji}</Text>
        </View>
        <View style={ap.info}>
          <Text style={ap.title} numberOfLines={2}>{title}</Text>
          {subtitle ? <Text style={ap.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>

      {/* Progress bar */}
      {status === 'ready' ? (
        <>
          <TouchableOpacity
            style={ap.trackWrap}
            activeOpacity={0.9}
            onPress={(e) => {
              // rough seek from tap X position
              const w = 300; // approx
              const x = (e.nativeEvent as any).locationX ?? 0;
              seek(Math.min(1, Math.max(0, x / w)));
            }}
          >
            <View style={[ap.trackBg, { backgroundColor: `${accentColor}25` }]}>
              <View style={[ap.trackFill, { width: `${progress * 100}%`, backgroundColor: accentColor }]} />
              {/* Thumb */}
              <View style={[ap.thumb, { left: `${Math.max(0, progress * 100 - 1)}%`, backgroundColor: accentColor }]} />
            </View>
          </TouchableOpacity>
          <View style={ap.timeRow}>
            <Text style={ap.timeText}>{formatTime(pos)}</Text>
            <Text style={ap.timeText}>{dur > 0 ? formatTime(dur) : '--:--'}</Text>
          </View>
        </>
      ) : status === 'loading' ? (
        <View style={ap.loadingRow}>
          <ActivityIndicator color={accentColor} size="small" />
          <Text style={[ap.loadingTxt, { color: accentColor }]}>Loading audio…</Text>
        </View>
      ) : (
        <Text style={ap.errorTxt}>Could not load audio.</Text>
      )}

      {/* Controls */}
      <View style={ap.controls}>
        <TouchableOpacity
          style={[ap.ctrlBtn, { opacity: hasPrev ? 1 : 0.3 }]}
          onPress={onPrev}
          disabled={!hasPrev}
        >
          <SkipBack size={20} color="#5A5A7A" strokeWidth={2} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[ap.playBtn, { backgroundColor: accentColor, shadowColor: accentColor }]}
          onPress={togglePlay}
          disabled={status !== 'ready'}
        >
          {status === 'loading'
            ? <ActivityIndicator color="#fff" size="small" />
            : playing
              ? <Pause size={24} color="#fff" fill="#fff" />
              : <Play  size={24} color="#fff" fill="#fff" />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[ap.ctrlBtn, { opacity: hasNext ? 1 : 0.3 }]}
          onPress={onNext}
          disabled={!hasNext}
        >
          <SkipForward size={20} color="#5A5A7A" strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ap = StyleSheet.create({
  card: {
    borderRadius: 24, padding: 20,
    gap: 0,
  },

  topRow:  { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  artBox:  { width: 72, height: 72, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  artEmoji:{ fontSize: 40 },
  info:    { flex: 1 },
  title:   { fontSize: 18, fontWeight: '900', color: '#1a1a2e', lineHeight: 25, marginBottom: 4 },
  subtitle:{ fontSize: 13, fontWeight: '500', color: '#9A9AB0' },

  // Track
  trackWrap: { marginBottom: 6 },
  trackBg: {
    height: 8, borderRadius: 999, overflow: 'hidden',
    position: 'relative', justifyContent: 'center',
  },
  trackFill: { position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 999 },
  thumb: {
    position: 'absolute', width: 14, height: 14, borderRadius: 7,
    top: -3, marginLeft: -7,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
    borderWidth: 2, borderColor: '#fff',
  },
  timeRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  timeText:   { fontSize: 12, fontWeight: '600', color: '#9A9AB0' },

  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14 },
  loadingTxt: { fontSize: 12, fontWeight: '600' },
  errorTxt:   { fontSize: 12, color: '#FF4444', paddingVertical: 14 },

  // Controls
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28 },
  ctrlBtn:  {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  playBtn: {
    width: 68, height: 68, borderRadius: 34,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
});
