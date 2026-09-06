import { LayoutChangeEvent, Text, View } from 'react-native';

import { logicopiccoloStyles } from './styles';
import { SlotState } from './useDragLogic';

type SlotColumnProps = {
  slots: SlotState[];
  hoveredSlotId: number | null;
  labelByButtonId?: Record<string, string>;
  placeholderSize: number;
  showClip?: boolean;
  expectedBySlotId?: Record<number, string>;
  onLayout?: (event: LayoutChangeEvent) => void;
};

export function SlotColumn({
  slots,
  hoveredSlotId,
  labelByButtonId,
  placeholderSize,
  showClip = false,
  expectedBySlotId,
  onLayout,
}: SlotColumnProps) {
  return (
    <View style={logicopiccoloStyles.slotColumn} onLayout={onLayout}>
      {slots.map((slot, index) => {
        const isHighlighted = hoveredSlotId === slot.id;
        const occupiedLabel = slot.occupiedBy ? labelByButtonId?.[slot.occupiedBy] ?? slot.occupiedBy : '-';
        const expected = expectedBySlotId?.[slot.id];
        return (
          <View
            key={slot.id}
            style={[logicopiccoloStyles.slotRow, index === slots.length - 1 && logicopiccoloStyles.slotRowLast]}
          >
            <View
              style={[
                logicopiccoloStyles.slot,
                {
                  width: placeholderSize + 6,
                  height: placeholderSize + 6,
                  borderRadius: (placeholderSize + 6) / 2,
                },
                isHighlighted && logicopiccoloStyles.slotActive,
              ]}
            >
              <Text style={logicopiccoloStyles.slotOccupiedText}>
                {showClip && expected ? labelByButtonId?.[expected] ?? expected : occupiedLabel}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
