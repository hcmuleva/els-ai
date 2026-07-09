import React, { useRef, useState } from 'react';
import { GestureResponderEvent, PanResponder, StyleSheet, Text, View } from 'react-native';
import { formatTime } from '../../utils/timeUtils';

interface Props {
  duration: number;
  start: number;
  end: number;
  minGap?: number;
  playhead?: number | null;
  onChange: (start: number, end: number) => void;
  onScrub?: (time: number, which: 'start' | 'end') => void;
  onScrubEnd?: () => void;
}

const THUMB = 28;
const HITSLOP = { top: 14, bottom: 14, left: 14, right: 14 };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// A dual-handle range slider for picking a video segment. Uses core PanResponder
// so it works on web (mouse) and native (touch) without extra dependencies.
//
// The gesture handlers are created exactly once and read every mutable value
// (current start/end, width, duration, callbacks) through refs. This is critical:
// dragging calls the parent's onChange on every move, which re-renders this
// component; if the PanResponder were rebuilt on each render (e.g. via useMemo on
// the inline callbacks) the in-flight gesture state (dx) would reset and the drag
// would stall after the first move.
export default function VideoRangeSlider({
  duration,
  start,
  end,
  minGap = 1,
  playhead,
  onChange,
  onScrub,
  onScrubEnd,
}: Props) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<'start' | 'end' | null>(null);

  const startRef = useRef(start);
  const endRef = useRef(end);
  const widthRef = useRef(0);
  const durationRef = useRef(duration);
  const minGapRef = useRef(minGap);
  const onChangeRef = useRef(onChange);
  const onScrubRef = useRef(onScrub);
  const onScrubEndRef = useRef(onScrubEnd);
  const dragFrom = useRef(0);

  startRef.current = start;
  endRef.current = end;
  widthRef.current = width;
  durationRef.current = duration;
  minGapRef.current = minGap;
  onChangeRef.current = onChange;
  onScrubRef.current = onScrub;
  onScrubEndRef.current = onScrubEnd;

  const toX = (v: number) => (duration > 0 ? (v / duration) * width : 0);
  const fromX = (x: number) => (widthRef.current > 0 ? clamp((x / widthRef.current) * durationRef.current, 0, durationRef.current) : 0);

  const makePan = (which: 'start' | 'end') =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        dragFrom.current = which === 'start' ? startRef.current : endRef.current;
        setActive(which);
      },
      onPanResponderMove: (_e, g) => {
        const w = widthRef.current;
        const d = durationRef.current;
        if (w <= 0 || d <= 0) return;
        const delta = (g.dx / w) * d;
        const target = Math.round(dragFrom.current + delta);
        if (which === 'start') {
          const next = clamp(target, 0, endRef.current - minGapRef.current);
          onChangeRef.current(next, endRef.current);
          onScrubRef.current?.(next, 'start');
        } else {
          const next = clamp(target, startRef.current + minGapRef.current, d);
          onChangeRef.current(startRef.current, next);
          onScrubRef.current?.(next, 'end');
        }
      },
      onPanResponderRelease: () => {
        setActive(null);
        onScrubEndRef.current?.();
      },
      onPanResponderTerminate: () => {
        setActive(null);
        onScrubEndRef.current?.();
      },
    });

  const startPanRef = useRef<ReturnType<typeof PanResponder.create> | null>(null);
  const endPanRef = useRef<ReturnType<typeof PanResponder.create> | null>(null);
  if (!startPanRef.current) startPanRef.current = makePan('start');
  if (!endPanRef.current) endPanRef.current = makePan('end');
  const startPan = startPanRef.current;
  const endPan = endPanRef.current;

  // Tapping the rail moves whichever handle is nearer to the tapped position.
  const handleTrackTap = (e: GestureResponderEvent) => {
    const t = Math.round(fromX(e.nativeEvent.locationX));
    const nearStart = Math.abs(t - startRef.current) <= Math.abs(t - endRef.current);
    if (nearStart) {
      const next = clamp(t, 0, endRef.current - minGapRef.current);
      onChangeRef.current(next, endRef.current);
      onScrubRef.current?.(next, 'start');
    } else {
      const next = clamp(t, startRef.current + minGapRef.current, durationRef.current);
      onChangeRef.current(startRef.current, next);
      onScrubRef.current?.(next, 'end');
    }
    onScrubEndRef.current?.();
  };

  const startX = toX(start);
  const endX = toX(end);
  // Keep the actively dragged handle on top so overlapping handles stay grabbable.
  const startZ = active === 'start' ? 4 : 2;
  const endZ = active === 'end' ? 4 : 3;

  return (
    <View style={styles.wrap}>
      <View
        style={styles.track}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onResponderRelease={handleTrackTap}
      >
        <View style={styles.rail} />
        <View style={[styles.range, { left: startX, width: Math.max(0, endX - startX) }]} />
        {playhead != null && duration > 0 ? (
          <View style={[styles.playhead, { left: clamp(toX(playhead), 0, Math.max(0, width)) }]} />
        ) : null}
        <View
          {...startPan.panHandlers}
          hitSlop={HITSLOP}
          style={[styles.thumb, active === 'start' && styles.thumbActive, { left: startX - THUMB / 2, zIndex: startZ }]}
        >
          <View style={styles.thumbInner} />
        </View>
        <View
          {...endPan.panHandlers}
          hitSlop={HITSLOP}
          style={[styles.thumb, active === 'end' && styles.thumbActive, { left: endX - THUMB / 2, zIndex: endZ }]}
        >
          <View style={styles.thumbInner} />
        </View>
      </View>
      <View style={styles.labels}>
        <Text style={styles.label}>Start {formatTime(start)}</Text>
        <Text style={styles.label}>End {formatTime(end)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, paddingHorizontal: THUMB / 2, paddingVertical: 6 },
  track: { height: THUMB + 8, justifyContent: 'center' },
  rail: { position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 3, backgroundColor: '#E2E4EE' },
  range: { position: 'absolute', height: 6, borderRadius: 3, backgroundColor: '#4A90E2' },
  playhead: { position: 'absolute', width: 2, height: THUMB, backgroundColor: '#D64545' },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  thumbActive: { borderColor: '#2F6FED', transform: [{ scale: 1.15 }] },
  thumbInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4A90E2' },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  label: { fontSize: 12, color: '#5A5A7A', fontWeight: '600' },
});
