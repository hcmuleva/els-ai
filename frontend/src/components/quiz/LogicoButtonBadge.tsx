import { View } from 'react-native';
import { qFormS } from './questionEditor.styles';
import { getLogicoButtonColor, isRingButton } from './questionEditor.helpers';

export default function LogicoButtonBadge({ buttonId, size = 26 }: { buttonId: string; size?: number }) {
  const color = getLogicoButtonColor(buttonId);
  return (
    <View
      style={[
        qFormS.logicoButtonCircle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
      ]}
    >
      {isRingButton(buttonId) ? (
        <View
          style={[
            qFormS.logicoButtonRingInner,
            { width: size * 0.44, height: size * 0.44, borderRadius: (size * 0.44) / 2 },
          ]}
        />
      ) : null}
    </View>
  );
}
