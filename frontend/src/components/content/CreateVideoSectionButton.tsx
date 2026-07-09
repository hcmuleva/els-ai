import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Plus } from 'lucide-react-native';

interface Props {
  onPress: () => void;
  disabled?: boolean;
}

export default function CreateVideoSectionButton({ onPress, disabled }: Props) {
  return (
    <Pressable
      style={[styles.btn, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Plus size={18} color="#FFFFFF" />
      <Text style={styles.text}>Add Video Section</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  disabled: { opacity: 0.5 },
  text: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
