import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ButtonIdentity, CardOptionSlot } from '../../types';
import { TenSlotGrid } from './TenSlotGrid';
import { ColorButton } from './ColorButton';
import { SvgImage } from '../common/SvgImage';

interface OptionsColumnProps {
  width: number;
  height: number;
  optionSlots: CardOptionSlot[];
  expectedPlacements: Map<number, ButtonIdentity>;
  showAnswer: boolean;
  overlayOnly?: boolean;
  headerHeight?: number;
  expectedOffsetY?: number;
  debug?: boolean;
}

/** Right part of card: 10 equal option boxes (same grid as frame rail). */
export const OptionsColumn: React.FC<OptionsColumnProps> = ({
  width,
  height,
  optionSlots,
  expectedPlacements,
  showAnswer,
  overlayOnly = false,
  headerHeight = 0.145,
  expectedOffsetY = 0,
  debug = false,
}) => {
  const sorted = [...optionSlots].sort((a, b) => a.id - b.id);

  return (
    <View style={[styles.column, overlayOnly && styles.overlayOnlyColumn, { width, height }]}>
      <TenSlotGrid
        height={height}
        headerHeight={headerHeight}
        slotCount={sorted.length}
        showHeader
        headerColor={overlayOnly ? 'transparent' : '#7CFC00'}
        debug={debug}
        renderSlot={(slotId) => {
          const slot = sorted.find((s) => s.id === slotId);
          const expected = expectedPlacements.get(slotId);

          if (overlayOnly) {
            return (
              <View style={styles.overlayOnlyOptionBox}>
                {showAnswer && expected && (
                  <View style={{ transform: [{ translateY: expectedOffsetY }] }}>
                    <ColorButton
                      color={expected.color}
                      variant={expected.variant}
                      size="slot"
                    />
                  </View>
                )}
              </View>
            );
          }

          return (
            <View style={styles.optionBox}>
              {slot?.visualXml ? (
                <SvgImage xml={slot.visualXml} width="90%" height="90%" />
              ) : (
                <Text style={styles.optionText} numberOfLines={1}>
                  {slot?.value ?? ''}
                </Text>
              )}
              {showAnswer && expected && (
                <View style={styles.clipButtonOverlay}>
                  <ColorButton
                    color={expected.color}
                    variant={expected.variant}
                    size="slot"
                  />
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  column: {
    backgroundColor: '#fff',
    borderLeftWidth: 1,
    borderLeftColor: '#333',
    overflow: 'hidden',
  },
  overlayOnlyColumn: {
    backgroundColor: 'transparent',
    borderLeftWidth: 0,
  },
  optionBox: {
    position: 'relative',
    height: '92%',
    aspectRatio: 1,
    maxWidth: '92%',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#222',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 1,
  },
  overlayOnlyOptionBox: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clipButtonOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
  },
});
