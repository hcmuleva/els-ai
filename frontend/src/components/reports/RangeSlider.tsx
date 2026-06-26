import React, { useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Colors, Radius } from '../../theme';

const PAD = 16; // half thumb width, keeps thumbs inside the track

/**
 * Discrete two-thumb range slider. `value` = inclusive [from, to] indices into
 * a 0..count-1 scale. Drag either thumb to change the visible range.
 */
export function RangeSlider({
  count,
  value,
  onChange,
  labelFor,
}: {
  count: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  labelFor: (i: number) => string;
}) {
  const [w, setW] = useState(0);
  const valRef = useRef(value);
  valRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const startRef = useRef<[number, number]>(value);

  const usable = Math.max(1, w - PAD * 2);
  const step = count > 1 ? usable / (count - 1) : usable;
  const idxToX = (i: number) => PAD + (count > 1 ? (i / (count - 1)) * usable : usable / 2);

  const responders = useMemo(() => {
    const make = (which: 0 | 1) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          startRef.current = valRef.current;
        },
        onPanResponderMove: (_evt, g) => {
          if (count <= 1) return;
          const start = startRef.current[which];
          const ni = Math.min(count - 1, Math.max(0, start + Math.round(g.dx / step)));
          let [a, b] = valRef.current;
          if (which === 0) a = Math.min(ni, b);
          else b = Math.max(ni, a);
          if (a !== valRef.current[0] || b !== valRef.current[1]) onChangeRef.current([a, b]);
        },
      });
    return [make(0), make(1)] as const;
    // recreate when the scale changes so `step`/`count` stay accurate
  }, [count, step]);

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const [a, b] = value;
  const xa = idxToX(a);
  const xb = idxToX(b);

  return (
    <View style={s.wrap}>
      <View style={s.labelRow}>
        <Text style={s.rangeText}>
          {labelFor(a)}
          {b !== a ? `  →  ${labelFor(b)}` : ''}
        </Text>
      </View>
      <View style={s.track} onLayout={onLayout}>
        <View style={s.rail} />
        {w > 0 && <View style={[s.fill, { left: xa, width: Math.max(0, xb - xa) }]} />}
        {w > 0 && (
          <>
            <View style={[s.thumb, { left: xa - PAD }]} {...responders[0].panHandlers}>
              <View style={s.thumbDot} />
            </View>
            <View style={[s.thumb, { left: xb - PAD }]} {...responders[1].panHandlers}>
              <View style={s.thumbDot} />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 6 },
  labelRow: { alignItems: 'center' },
  rangeText: { fontSize: 11.5, fontWeight: '800', color: Colors.primaryDark },
  track: { height: 32, justifyContent: 'center' },
  rail: { height: 5, borderRadius: 3, backgroundColor: Colors.surfaceAlt, marginHorizontal: PAD },
  fill: { position: 'absolute', height: 5, borderRadius: 3, backgroundColor: Colors.primary },
  thumb: { position: 'absolute', width: PAD * 2, height: 32, alignItems: 'center', justifyContent: 'center' },
  thumbDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 3,
    borderColor: Colors.primary,
    ...({ elevation: 2 } as object),
  },
});
