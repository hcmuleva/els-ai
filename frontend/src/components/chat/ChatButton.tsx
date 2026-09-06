import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles, X } from 'lucide-react-native';
import { useAiChat } from '../../context/AiChatContext';
import { Colors, Shadow } from '../../theme';

// Floating action button, always visible above the tab bar, that opens the
// AI Chat panel. Positioning accounts for the custom tab bar's height
// (~52 slot + vertical padding + safe-area inset) so it never overlaps it.
export function ChatButton() {
  const insets = useSafeAreaInsets();
  const { isOpen, toggle } = useAiChat();

  return (
    <Pressable
      onPress={toggle}
      style={[s.button, { bottom: Math.max(insets.bottom, 8) + 78 }]}
      accessibilityRole="button"
      accessibilityLabel={isOpen ? 'Close AI assistant' : 'Open AI assistant'}
      hitSlop={8}
    >
      {isOpen ? <X size={24} color="#FFFFFF" strokeWidth={2.5} /> : <Sparkles size={24} color="#FFFFFF" strokeWidth={2.5} />}
    </Pressable>
  );
}

const s = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    ...Shadow.lg,
  },
});
