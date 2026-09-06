import { Animated, Text } from 'react-native';
import { PanResponderInstance } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { logicopiccoloStyles } from './styles';
import { DragButton } from './useDragLogic';

type DraggableButtonProps = {
  button: DragButton;
  pan: Animated.ValueXY;
  responder: PanResponderInstance;
  size: number;
};

export function DraggableButton({ button, pan, responder, size }: DraggableButtonProps) {
  const hasSvgAsset = Boolean(button.svgXml);

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[
        logicopiccoloStyles.buttonCircle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: hasSvgAsset ? 'transparent' : button.color,
          borderWidth: hasSvgAsset ? 0 : undefined,
          shadowOpacity: hasSvgAsset ? 0.08 : undefined,
          position: 'absolute',
          transform: pan.getTranslateTransform(),
        },
      ]}
    >
      {hasSvgAsset ? (
        <SvgXml xml={button.svgXml ?? ''} width={size} height={size} />
      ) : (
        <Text style={logicopiccoloStyles.buttonLabel}>{button.label}</Text>
      )}
    </Animated.View>
  );
}
