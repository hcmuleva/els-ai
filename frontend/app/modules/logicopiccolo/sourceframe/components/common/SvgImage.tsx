import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

interface SvgImageProps {
  xml: string;
  width?: number | string;
  height?: number | string;
  style?: StyleProp<ImageStyle>;
}

export const SvgImage: React.FC<SvgImageProps> = ({
  xml,
  width = '100%',
  height = '100%',
  style,
}) => {
  return (
    <Image
      source={{ uri: `data:image/svg+xml;utf8,${encodeURIComponent(xml)}` }}
      style={[{ width: width as any, height: height as any }, style]}
      resizeMode="contain"
    />
  );
};
