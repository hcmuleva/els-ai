import React, { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, PanResponder, Animated } from 'react-native';
import { Check, RotateCcw } from 'lucide-react-native';
import { AudioManager } from '../../utils/audio';
import { resolveMediaUrl } from './QuizRenderer';
import type { QuestionTheme } from './QuizRenderer';

type DragItem = {
  id: string;
  image: string;
  label?: string;
  sound?: string;
};

type DropTarget = {
  id: string;
  label: string;
};

type MatchRule = {
  drag_item_id: string;
  drop_target_id: string;
};

type Props = {
  questionData: {
    drag_items: DragItem[];
    drop_targets: DropTarget[];
    match_rules: MatchRule[];
  };
  onComplete: (isCorrect: boolean, responseData: any) => void;
  theme?: QuestionTheme;
};

export default function DragDropRenderer({ questionData, onComplete, theme }: Props) {
  const { drag_items, drop_targets, match_rules } = questionData;
  const [matches, setMatches] = useState<Record<string, string>>({}); // target_id -> item_id
  const [placedItems, setPlacedItems] = useState<Set<string>>(new Set()); // set of item_ids placed
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const containerRef = useRef<View>(null);
  const targetRefs = useRef<Record<string, View>>({});
  const [containerPageOffset, setContainerPageOffset] = useState<{ x: number; y: number } | null>(null);
  const [targetLayouts, setTargetLayouts] = useState<Record<string, { x: number; y: number; width: number; height: number }>>({});

  // Animated coordinates for the active dragging item
  const pan = useRef(new Animated.ValueXY()).current;

  // Measure container and targets positions
  const onContainerLayout = () => {
    if (containerRef.current) {
      containerRef.current.measure((x, y, width, height, pageX, pageY) => {
        setContainerPageOffset({ x: pageX, y: pageY });
      });
      // Delay target measurement slightly to ensure rendering completes
      setTimeout(measureTargets, 150);
    }
  };

  const measureTargets = () => {
    drop_targets.forEach((target) => {
      const ref = targetRefs.current[target.id];
      if (ref && containerRef.current) {
        ref.measureLayout(
          containerRef.current,
          (x, y, width, height) => {
            setTargetLayouts((prev) => ({
              ...prev,
              [target.id]: { x, y, width, height },
            }));
          },
          () => {
            console.warn('Failed to measure target layout');
          }
        );
      }
    });
  };

  const handleDrop = (itemId: string, x: number, y: number) => {
    let foundTargetId: string | null = null;

    // Find if drop coordinate lies inside any target slot boundary
    Object.keys(targetLayouts).forEach((targetId) => {
      const layout = targetLayouts[targetId];
      if (
        x >= layout.x &&
        x <= layout.x + layout.width &&
        y >= layout.y &&
        y <= layout.y + layout.height
      ) {
        foundTargetId = targetId;
      }
    });

    if (foundTargetId) {
      setMatches((prev) => {
        const next = { ...prev };
        // Remove item from any other slot it was previously in
        Object.keys(next).forEach((key) => {
          if (next[key] === itemId) {
            delete next[key];
          }
        });
        next[foundTargetId!] = itemId;
        return next;
      });

      setPlacedItems((prev) => {
        const next = new Set(prev);
        next.add(itemId);
        return next;
      });
    }
  };

  const handleTargetPress = (targetId: string) => {
    const filledItemId = matches[targetId];
    if (filledItemId) {
      // Release item back to the list
      setMatches((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      setPlacedItems((prev) => {
        const next = new Set(prev);
        next.delete(filledItemId);
        return next;
      });
    }
  };

  const handleReset = () => {
    setMatches({});
    setPlacedItems(new Set());
    setActiveDragId(null);
  };

  const handleSubmit = () => {
    // Validate matching rules
    let allCorrect = true;
    const studentMatches: any[] = [];

    // Ensure all targets are filled
    if (Object.keys(matches).length < drop_targets.length) {
      const warnSound = resolveMediaUrl('/media/sound-effects/incorrect.mp3');
      if (warnSound) AudioManager.playSound(warnSound);
      return;
    }

    match_rules.forEach((rule) => {
      const placedItemId = matches[rule.drop_target_id];
      const isCorrect = placedItemId === rule.drag_item_id;
      if (!isCorrect) {
        allCorrect = false;
      }
      studentMatches.push({
        target: rule.drop_target_id,
        item: placedItemId,
        is_correct: isCorrect,
      });
    });

    const resultSoundPath = allCorrect
      ? '/media/sound-effects/correct.mp3'
      : '/media/sound-effects/incorrect.mp3';
    const resolvedResultSound = resolveMediaUrl(resultSoundPath);
    if (resolvedResultSound) {
      AudioManager.playSound(resolvedResultSound);
    }

    onComplete(allCorrect, { matches: studentMatches });
  };

  // Create a PanResponder helper for a specific drag item
  const createItemPanResponder = (item: DragItem) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setActiveDragId(item.id);

        // Play animal sound when selected
        if (item.sound) {
          const resolvedSound = resolveMediaUrl(item.sound);
          if (resolvedSound) AudioManager.playSound(resolvedSound);
        }

        // Set floating drag card initial position centered on the touch point
        if (containerPageOffset) {
          const startX = evt.nativeEvent.pageX - containerPageOffset.x - 45;
          const startY = evt.nativeEvent.pageY - containerPageOffset.y - 45;
          pan.setValue({ x: startX, y: startY });
        }
      },
      onPanResponderMove: (evt) => {
        if (containerPageOffset) {
          const dragX = evt.nativeEvent.pageX - containerPageOffset.x - 45;
          const dragY = evt.nativeEvent.pageY - containerPageOffset.y - 45;
          pan.setValue({ x: dragX, y: dragY });
        }
      },
      onPanResponderRelease: (evt) => {
        if (containerPageOffset) {
          const localX = evt.nativeEvent.pageX - containerPageOffset.x;
          const localY = evt.nativeEvent.pageY - containerPageOffset.y;
          handleDrop(item.id, localX, localY);
        }
        setActiveDragId(null);
      },
    });
  };

  const activeDraggedItem = drag_items.find((i) => i.id === activeDragId);

  return (
    <View ref={containerRef} onLayout={onContainerLayout} style={styles.container}>
      <View style={styles.gameBoard}>
        {/* Left Column: Draggable Items */}
        <View style={styles.column}>
          <Text style={styles.columnHeader}>Drag These</Text>
          <View style={styles.list}>
            {drag_items.map((item) => {
              const isPlaced = placedItems.has(item.id);
              const isCurrentlyDragging = activeDragId === item.id;

              return (
                <View
                  key={item.id}
                  {...(isPlaced ? {} : createItemPanResponder(item).panHandlers)}
                  style={[
                    styles.itemCard,
                    isPlaced && styles.itemCardPlaced,
                    isCurrentlyDragging && styles.itemCardDragging,
                  ]}
                >
                  {isCurrentlyDragging ? (
                    <View style={styles.placeholderBox} />
                  ) : (
                    <>
                      <Image source={{ uri: resolveMediaUrl(item.image) }} style={styles.itemImage} />
                      {item.label ? <Text style={styles.itemLabel}>{item.label}</Text> : null}
                      {isPlaced && (
                        <View style={styles.placedBadge}>
                          <Check size={12} color="#ffffff" />
                        </View>
                      )}
                    </>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Right Column: Drop Targets */}
        <View style={styles.column}>
          <Text style={styles.columnHeader}>Drop Here</Text>
          <View style={styles.list}>
            {drop_targets.map((target) => {
              const filledItemId = matches[target.id];
              const filledItem = drag_items.find((i) => i.id === filledItemId);

              return (
                <Pressable
                  key={target.id}
                  ref={(el) => {
                    if (el) targetRefs.current[target.id] = el;
                  }}
                  onPress={() => handleTargetPress(target.id)}
                  style={[
                    styles.targetSlot,
                    filledItem && styles.targetSlotFilled,
                    !filledItem && activeDragId && styles.targetSlotHighlight,
                  ]}
                >
                  {filledItem ? (
                    <View style={styles.filledContent}>
                      <Image source={{ uri: resolveMediaUrl(filledItem.image) }} style={styles.slotImage} />
                      <Text style={styles.slotLabel}>{target.label}</Text>
                      <Text style={styles.slotSubLabel}>Tap to release</Text>
                    </View>
                  ) : (
                    <Text style={styles.emptySlotLabel}>{target.label}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* Floating Card while dragging */}
      {activeDragId && activeDraggedItem && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.floatingDragCard,
            {
              transform: [
                { translateX: pan.x },
                { translateY: pan.y },
              ],
            },
          ]}
        >
          <Image source={{ uri: resolveMediaUrl(activeDraggedItem.image) }} style={styles.itemImage} />
          {activeDraggedItem.label ? (
            <Text style={styles.itemLabel}>{activeDraggedItem.label}</Text>
          ) : null}
        </Animated.View>
      )}

      <View style={styles.footer}>
        <Pressable onPress={handleReset} style={styles.resetButton}>
          <RotateCcw size={16} color="#78350f" />
          <Text style={styles.resetButtonText}>Reset</Text>
        </Pressable>
        <Pressable
          onPress={handleSubmit}
          style={[styles.submitButton, { backgroundColor: '#FF7043' }]}
        >
          <Text style={styles.submitButtonText}>Check Answers ✓</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
    gap: 10,
    position: 'relative',
  },
  gameBoard: {
    flexDirection: 'row',
    gap: 10,
  },
  column: {
    flex: 1,
    gap: 6,
  },
  columnHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4A90E2',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  list: {
    gap: 6,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#B5D4FF',
    borderRadius: 14,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
    height: 70,
  },
  itemCardDragging: {
    opacity: 0.7,
    borderColor: '#4A90E2',
    borderStyle: 'dashed',
  },
  itemCardPlaced: {
    opacity: 0.38,
    backgroundColor: '#EBF4FF',
    borderColor: '#B5D4FF',
  },
  placeholderBox: {
    width: '100%',
    height: '100%',
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  itemImage: {
    width: 38,
    height: 38,
    resizeMode: 'contain',
  },
  itemLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginTop: 4,
  },
  placedBadge: {
    position: 'absolute',
    right: -4,
    top: -4,
    backgroundColor: '#10b981',
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetSlot: {
    height: 70,
    backgroundColor: '#EBF4FF',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#B5D4FF',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  targetSlotHighlight: {
    borderColor: '#4A90E2',
    backgroundColor: '#D6EAFF',
  },
  targetSlotFilled: {
    borderStyle: 'solid',
    borderColor: '#22c55e',
    backgroundColor: '#f0fdf4',
  },
  emptySlotLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4A90E2',
    textAlign: 'center',
  },
  filledContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  slotImage: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
  },
  slotLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065f46',
    textAlign: 'center',
  },
  slotSubLabel: {
    fontSize: 9,
    color: '#047857',
    fontStyle: 'italic',
    marginTop: 1,
  },
  floatingDragCard: {
    position: 'absolute',
    width: 70,
    height: 70,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#4A90E2',
    borderRadius: 14,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 9999,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 6,
  },
  resetButton: {
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999,
    backgroundColor: '#EBF4FF', alignItems: 'center',
    justifyContent: 'center', flexDirection: 'row', gap: 6,
    borderWidth: 1.5, borderColor: '#B5D4FF',
  },
  resetButtonText: { fontSize: 13, fontWeight: '800', color: '#2C6BC9' },
  submitButton: {
    flex: 1, paddingVertical: 14, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF7043', shadowOpacity: 0.35, shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10, elevation: 4,
  },
  submitButtonText: { fontSize: 15, fontWeight: '900', color: '#ffffff' },
});
