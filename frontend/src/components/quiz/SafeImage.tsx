import { useState } from 'react';
import { Image, View, ImageResizeMode, ViewStyle, ImageStyle } from 'react-native';
import { Image as ImageIcon } from 'lucide-react-native';

type Props = {
  uri: string;
  style?: any;
  resizeMode?: ImageResizeMode;
};

export default function SafeImage({ uri, style, resizeMode = 'contain' }: Props) {
  const [error, setError] = useState(false);
  if (!uri || error) {
    return (
      <View
        style={[
          style as ViewStyle,
          { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F4FB', overflow: 'hidden' },
        ]}
      >
        <ImageIcon size={24} color="#9A9AB0" />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={style as ImageStyle}
      resizeMode={resizeMode}
      onError={() => setError(true)}
    />
  );
}
