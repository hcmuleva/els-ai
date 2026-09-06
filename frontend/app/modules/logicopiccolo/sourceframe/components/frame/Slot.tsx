// src/components/frame/Slot.tsx

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { ButtonIdentity } from '../../types';
import { ColorButton } from './ColorButton';

interface SlotProps {
  slotId: number;
  placedButton: ButtonIdentity | null;
  onPress: () => void;
  correctness?: 'correct' | 'incorrect' | null;
}

const { width } = Dimensions.get('window');
const isMobile = width < 600;

/** Hole size — slot column width is derived from this */
export const SLOT_HOLE_SIZE = isMobile ? 30 : 38;
export const SLOT_COL_WIDTH = SLOT_HOLE_SIZE + 6;

export const Slot: React.FC<SlotProps> = ({ 
  placedButton, 
  onPress,
  correctness = null,
}) => {
  const r = SLOT_HOLE_SIZE / 2;

  return (
    <TouchableOpacity 
      activeOpacity={0.7}
      onPress={onPress}
      style={styles.container}
    >
      <View
        style={[
          styles.slotHole,
          { width: SLOT_HOLE_SIZE, height: SLOT_HOLE_SIZE, borderRadius: r },
          correctness === 'correct' && styles.slotCorrect,
          correctness === 'incorrect' && styles.slotIncorrect,
        ]}
      >
        {placedButton && (
          <ColorButton 
            color={placedButton.color}
            variant={placedButton.variant}
            size="slot"
          />
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotHole: {
    backgroundColor: '#3D3D3D',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2A2A2A',
  },
  slotCorrect: {
    borderColor: '#34C759',
    backgroundColor: '#1f3d2a',
  },
  slotIncorrect: {
    borderColor: '#FF3B30',
    backgroundColor: '#4a2421',
  },
});
