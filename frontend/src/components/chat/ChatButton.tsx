import { useEffect, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Sparkles, X } from 'lucide-react-native';
import { useAiChat } from '../../context/AiChatContext';
import { Colors, Radius, Shadow } from '../../theme';

interface ChatButtonProps {
  isDesktopDock?: boolean;
}

// Floating action button that opens the AI Chat panel.
// On desktop, it docks right beside the centered navigation capsule.
// On mobile, it docks to the right edge of the screen as a compact expandable tab so it doesn't block content.
export function ChatButton({ isDesktopDock = false }: ChatButtonProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const insets = useSafeAreaInsets();
  const { isOpen, toggle } = useAiChat();
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-collapse after 5 seconds if expanded
  useEffect(() => {
    if (!isExpanded || isOpen) return;
    const timer = setTimeout(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsExpanded(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [isExpanded, isOpen]);

  // If this instance is for the desktop dock, only render on desktop
  if (isDesktopDock) {
    if (!isDesktop) return null;
    return (
      <Pressable
        onPress={toggle}
        style={({ pressed }) =>
          StyleSheet.flatten([
            s.dockButton,
            pressed ? s.dockButtonPressed : undefined,
          ])
        }
        accessibilityRole="button"
        accessibilityLabel={isOpen ? 'Close AI assistant' : 'Open AI assistant'}
        hitSlop={8}
      >
        {isOpen ? (
          <X size={22} color="#FFFFFF" strokeWidth={2.5} />
        ) : (
          <Sparkles size={22} color="#FFFFFF" strokeWidth={2.5} />
        )}
      </Pressable>
    );
  }

  // Floating mobile button - hide on desktop since it is docked beside the nav bar
  if (isDesktop) return null;

  const handleMobilePress = () => {
    if (isOpen) {
      toggle();
      return;
    }
    if (!isExpanded) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsExpanded(true);
    } else {
      toggle();
    }
  };

  const handleCollapse = (e: any) => {
    e?.stopPropagation?.();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(false);
  };

  const mobileBottom = Math.max(insets.bottom, 10) + 72;

  // If chat modal is open, show standard close button
  if (isOpen) {
    return (
      <Pressable
        onPress={toggle}
        style={StyleSheet.flatten([
          s.mobileCloseBtn,
          {
            position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
            bottom: mobileBottom,
          },
        ])}
        accessibilityRole="button"
        accessibilityLabel="Close AI assistant"
        hitSlop={8}
      >
        <X size={22} color="#FFFFFF" strokeWidth={2.5} />
      </Pressable>
    );
  }

  // Expanded pill state
  if (isExpanded) {
    return (
      <View
        style={StyleSheet.flatten([
          s.mobileExpandedWrap,
          {
            position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
            bottom: mobileBottom,
          },
        ])}
      >
        <Pressable
          onPress={toggle}
          style={s.mobileExpandedBtn}
          accessibilityRole="button"
          accessibilityLabel="Ask AI assistant"
        >
          <Sparkles size={17} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={s.mobileExpandedText}>Ask AI</Text>
        </Pressable>
        <Pressable
          onPress={handleCollapse}
          style={s.mobileCollapseBtn}
          accessibilityRole="button"
          accessibilityLabel="Minimize AI button"
          hitSlop={6}
        >
          <ChevronRight size={15} color="#FFFFFF" strokeWidth={2.5} />
        </Pressable>
      </View>
    );
  }

  // Collapsed edge tab (docked flush against the right edge of the screen)
  return (
    <Pressable
      onPress={handleMobilePress}
      style={StyleSheet.flatten([
        s.mobileEdgeTab,
        {
          position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
          bottom: mobileBottom,
        },
      ])}
      accessibilityRole="button"
      accessibilityLabel="Expand AI assistant"
      hitSlop={6}
    >
      <Sparkles size={17} color="#FFFFFF" strokeWidth={2.3} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  // Desktop dock button
  dockButton: {
    width: 50,
    height: 50,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8ECF4',
    ...Shadow.md,
  },
  dockButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },

  // Mobile expandable edge tab (docked at right edge)
  mobileEdgeTab: {
    right: 0,
    width: 36,
    height: 42,
    borderTopLeftRadius: 21,
    borderBottomLeftRadius: 21,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: '#E8ECF4',
    zIndex: 50,
    ...Shadow.md,
  },
  mobileExpandedWrap: {
    right: 12,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    paddingLeft: 12,
    paddingRight: 6,
    gap: 8,
    zIndex: 50,
    ...Shadow.lg,
  },
  mobileExpandedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mobileExpandedText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    includeFontPadding: false,
    letterSpacing: 0.2,
  },
  mobileCollapseBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileCloseBtn: {
    right: 16,
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8ECF4',
    zIndex: 50,
    ...Shadow.lg,
  },
});

