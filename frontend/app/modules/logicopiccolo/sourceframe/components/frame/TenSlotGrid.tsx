import React from 'react';
import { View, StyleSheet } from 'react-native';

interface TenSlotGridProps {
  height: number;
  headerHeight?: number;
  slotCount: number;
  renderSlot: (slotId: number) => React.ReactNode;
  showHeader?: boolean;
  headerColor?: string;
  debug?: boolean;
}

/**
 * Splits the area below the header into `slotCount` equal rows.
 * Used for both the card options column and the frame button rail.
 */
export const TenSlotGrid: React.FC<TenSlotGridProps> = ({
  height,
  headerHeight = 0.145,
  slotCount,
  renderSlot,
  showHeader = true,
  headerColor = '#7CFC00',
  debug = false,
}) => {
  const headerH = height * headerHeight;

  return (
    <View style={[styles.root, { height }, debug && styles.debugRoot]}>
      {showHeader && (
        <View
          style={[
            styles.header,
            { height: headerH, backgroundColor: headerColor },
            debug && styles.debugHeader,
          ]}
        />
      )}
      <View style={[styles.grid, debug && styles.debugGrid]}>
        {Array.from({ length: slotCount }, (_, i) => {
          const slotId = i + 1;
          return (
            <View key={slotId} style={[styles.cell, debug && styles.debugCell]}>
              {renderSlot(slotId)}
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    width: '100%',
    overflow: 'hidden',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  grid: {
    flex: 1,
    flexDirection: 'column',
  },
  cell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 0,
  },
  debugRoot: {
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.5)',
  },
  debugHeader: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,0,255,0.8)',
  },
  debugGrid: {
    backgroundColor: 'rgba(0,255,255,0.05)',
  },
  debugCell: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,0,255,0.35)',
  },
});
