import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { logicopiccoloStyles } from './styles';

export type WorksheetOption = {
  id: string;
  title: string;
  color: string;
};

type WorksheetSelectorProps = {
  worksheets: WorksheetOption[];
  selectedWorksheetId: string;
  onSelect: (worksheetId: string) => void;
};

export function WorksheetSelector({
  worksheets,
  selectedWorksheetId,
  onSelect,
}: WorksheetSelectorProps) {
  return (
    <View style={logicopiccoloStyles.selectorWrap}>
      <Text style={logicopiccoloStyles.selectorTitle}>Worksheet Selector</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={logicopiccoloStyles.selectorRow}>
        {worksheets.map((worksheet) => {
          const selected = worksheet.id === selectedWorksheetId;
          return (
            <TouchableOpacity
              key={worksheet.id}
              activeOpacity={0.85}
              style={[logicopiccoloStyles.thumb, selected && logicopiccoloStyles.thumbSelected]}
              onPress={() => onSelect(worksheet.id)}
            >
              <View style={[logicopiccoloStyles.thumbBadge, { backgroundColor: worksheet.color }]} />
              <Text style={logicopiccoloStyles.thumbTitle}>{worksheet.title}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
