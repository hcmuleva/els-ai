import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Question } from '../../types';
import { TenSlotGrid } from './TenSlotGrid';
import { COLOR_MAP } from '../../utils/colors';
import { SvgImage } from '../common/SvgImage';

// 10 scatter positions as [left%, top%] of the content area below the header.
// Arranged in a 2-column staggered pattern so nothing overlaps.
const SCATTER_POSITIONS: [number, number][] = [
  [4,  1],  // slot 1
  [52, 3],  // slot 2
  [4,  21], // slot 3
  [52, 21], // slot 4
  [4,  41], // slot 5
  [52, 41], // slot 6
  [4,  61], // slot 7
  [52, 61], // slot 8
  [4,  80], // slot 9
  [52, 80], // slot 10
];

// Image cell: ~46% wide, ~17% tall of the content area
const IMG_W = 46;
const IMG_H = 17;

interface QuestionColumnProps {
  width: number;
  height: number;
  questions: Question[];
  headerHeight?: number;
  headerTitle?: string;
  debug?: boolean;
}

export const QuestionColumn: React.FC<QuestionColumnProps> = ({
  width,
  height,
  questions,
  headerHeight = 0.145,
  headerTitle = 'Match correctly',
  debug = false,
}) => {
  const allImages = questions.every((q) => !!q.visualXml);

  // ── Scattered image layout ──────────────────────────────────────────────────
  if (allImages) {
    const headerH = height * headerHeight;
    const contentH = height - headerH;

    return (
      <View style={[styles.column, { width, height }]}>
        {/* Green header */}
        <View style={[styles.header, { height: headerH }]} />

        {/* Scattered images in the content area */}
        <View style={[styles.scatterArea, { height: contentH }]}>
          {questions.map((q, i) => {
            const [lPct, tPct] = SCATTER_POSITIONS[i] ?? [0, i * 10];
            const isRing = q.variant === 'ring';
            return (
              <View
                key={q.id}
                style={[
                  styles.scatterItem,
                  {
                    left: `${lPct}%` as any,
                    top: `${tPct}%` as any,
                    width: `${IMG_W}%` as any,
                    height: `${IMG_H}%` as any,
                  },
                ]}
              >
                <SvgImage xml={q.visualXml!} width="100%" height="100%" />
                {/* Colored button overlaid bottom-right */}
                <View
                  style={[
                    styles.markerOverlay,
                    isRing ? styles.markerRing : styles.markerSolid,
                    { borderColor: COLOR_MAP[q.color] },
                    !isRing && { backgroundColor: COLOR_MAP[q.color] },
                  ]}
                />
              </View>
            );
          })}
        </View>

        {/* Header text overlay */}
        <View style={[styles.headerOverlay, { height: headerH }]} pointerEvents="none">
          <Text style={styles.headerText} numberOfLines={1}>{headerTitle}</Text>
        </View>
      </View>
    );
  }

  // ── Text-based grid layout (unchanged) ─────────────────────────────────────
  const bySlot = new Map(questions.map((q) => [q.targetSlot, q]));
  const slotCount = questions.length;

  return (
    <View style={[styles.column, { width, height }]}>
      <TenSlotGrid
        height={height}
        headerHeight={headerHeight}
        slotCount={slotCount}
        showHeader
        headerColor="#7CFC00"
        debug={debug}
        renderSlot={(slotId) => {
          const question = bySlot.get(slotId);
          if (!question) return <View style={styles.row} />;
          return (
            <View style={styles.row}>
              <View
                style={[styles.fallbackDot, { backgroundColor: COLOR_MAP[question.color] }]}
              />
              <Text style={styles.text} numberOfLines={1}>{question.question}</Text>
              <View
                style={[styles.marker, { backgroundColor: COLOR_MAP[question.color] }]}
              />
            </View>
          );
        }}
      />
      <View style={styles.headerOverlay} pointerEvents="none">
        <Text style={styles.headerText} numberOfLines={1}>{headerTitle}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  column: {
    backgroundColor: '#fff',
    overflow: 'hidden',
    position: 'relative',
  },
  header: {
    width: '100%',
    backgroundColor: '#7CFC00',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#184D0B',
  },
  // Scattered image layout
  scatterArea: {
    width: '100%',
    position: 'relative',
  },
  scatterItem: {
    position: 'absolute',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fafafa',
  },
  markerOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2.5,
  },
  markerSolid: {},
  markerRing: {
    backgroundColor: 'transparent',
  },
  // Text-based grid layout
  row: {
    width: '98%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  fallbackDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  text: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  marker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
});
