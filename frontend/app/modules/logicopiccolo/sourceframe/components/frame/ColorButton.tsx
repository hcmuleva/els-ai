// src/components/frame/ColorButton.tsx

import React from 'react';
import { TouchableOpacity, StyleSheet, View, Dimensions } from 'react-native';
import { ColorType, ButtonVariant } from '../../types';
import { COLOR_MAP } from '../../utils/colors';

const { width } = Dimensions.get('window');
const isMobile = width < 600;

interface ColorButtonProps {
  color: ColorType;
  variant?: ButtonVariant;
  size?: 'default' | 'parking' | 'slot';
  onPress?: () => void;
  style?: object;
  isPlaced?: boolean;
}

const SIZES = {
  default: { mobile: 32, desktop: 50 },
  parking: { mobile: 26, desktop: 34 },
  slot: { mobile: 22, desktop: 30 },
};

const RING_STROKE_MAP: Partial<Record<ColorType, string>> = {
  red: '#9A231C',
  blue: '#0450A5',
  green: '#1C8A37',
  yellow: '#BC9100',
  orange: '#B86700',
};

export const ColorButton: React.FC<ColorButtonProps> = ({
  color,
  variant = 'solid',
  size = 'default',
  onPress,
  style,
  isPlaced = false
}) => {
  const isRing = variant === 'ring';
  const dim = isMobile ? SIZES[size].mobile : SIZES[size].desktop;
  const centerSize = Math.max(10, Math.round(dim * 0.56));
  const ringStrokeColor = RING_STROKE_MAP[color] ?? 'rgba(0,0,0,0.35)';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.button,
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          backgroundColor: COLOR_MAP[color],
        },
        isRing && {
          borderColor: ringStrokeColor,
          borderWidth: isPlaced ? 1.5 : 2,
        },
        style
      ]}
    >
      {isRing && (
        <View
          style={[
            styles.innerCircle,
            {
              width: centerSize,
              height: centerSize,
              borderRadius: centerSize / 2,
            },
          ]}
        />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  innerCircle: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
