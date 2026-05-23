import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ButtonIdentity } from '../../types';
import { Slot, SLOT_COL_WIDTH } from './Slot';
import { TenSlotGrid } from './TenSlotGrid';

interface FrameSlotRailProps {
  height: number;
  slotCount: number;
  headerHeight?: number;
  offsetY?: number;
  placements: Map<number, ButtonIdentity>;
  onSlotPress: (slotId: number) => void;
  debug?: boolean;
}

/** Frame right column: 10 equal rows aligned with card options column. */
export const FrameSlotRail: React.FC<FrameSlotRailProps> = ({
  height,
  slotCount,
  headerHeight = 0.145,
  offsetY = 0,
  placements,
  onSlotPress,
  debug = false,
}) => {
  return (
    <View style={[styles.rail, { width: SLOT_COL_WIDTH, height, transform: [{ translateY: offsetY }] }]}>
      <TenSlotGrid
        height={height}
        headerHeight={headerHeight}
        slotCount={slotCount}
        showHeader
        headerColor="transparent"
        debug={debug}
        renderSlot={(slotId) => (
          <Slot
            slotId={slotId}
            placedButton={placements.get(slotId) ?? null}
            onPress={() => onSlotPress(slotId)}
          />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  rail: {
    backgroundColor: 'rgba(0,0,0,0.12)',
    borderRadius: 8,
    overflow: 'hidden',
  },
});
