import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, CheckCircle2 } from 'lucide-react-native';

interface Props {
  message?: string;
  valid?: boolean;
}

export default function SectionValidationMessage({ message, valid }: Props) {
  if (!message) return null;
  const color = valid ? '#2FA36B' : '#D64545';
  const bg = valid ? '#E1F6EC' : '#FDEAEA';
  return (
    <View style={[styles.row, { backgroundColor: bg }]}>
      {valid ? <CheckCircle2 size={16} color={color} /> : <AlertTriangle size={16} color={color} />}
      <Text style={[styles.text, { color }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, marginTop: 6 },
  text: { fontSize: 13, flex: 1, lineHeight: 18 },
});
