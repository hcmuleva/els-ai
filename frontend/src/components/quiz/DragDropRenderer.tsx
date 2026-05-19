import React, { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, PanResponder, Animated } from 'react-native';
import { Check, Info, RotateCcw } from 'lucide-react-native';
import { AudioManager } from '../../utils/audio';
import { resolveMediaUrl } from './QuizRenderer';

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
};

export default function DragDropRenderer({ questionData, onComplete }: Props) {
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
      <View style={styles.helpRow}>
        <Info size={16} color="#6366f1" />
        <Text style={styles.helpText}>Drag an animal to its matching home target!</Text>
      </View>

      <View style={styles.gameBoard}>
        {/* Left Column: Draggable Items */}
        <View style={styles.column}>
          <Text style={styles.columnHeader}>Animals</Text>
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
          <Text style={styles.columnHeader}>Homes</Text>
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
          <RotateCcw size={16} color="#475569" />
          <Text style={styles.resetButtonText}>Reset</Text>
        </Pressable>

        <Pressable onPress={handleSubmit} style={styles.submitButton}>
          <Text style={styles.submitButtonText}>Check Answers</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
    position: 'relative',
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  helpText: {
    fontSize: 12,
    color: '#1e40af',
    fontWeight: '600',
  },
  gameBoard: {
    flexDirection: 'row',
    gap: 16,
    flex: 1,
  },
  column: {
    flex: 1,
    gap: 10,
  },
  columnHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  list: {
    flex: 1,
    gap: 14,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    position: 'relative',
    height: 90,
  },
  itemCardDragging: {
    opacity: 0.8,
    borderColor: '#6366f1',
    borderStyle: 'dashed',
  },
  itemCardPlaced: {
    opacity: 0.4,
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
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
    width: 50,
    height: 50,
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
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  targetSlotHighlight: {
    borderColor: '#6366f1',
    backgroundColor: '#e0e7ff',
  },
  targetSlotFilled: {
    borderStyle: 'solid',
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  emptySlotLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'center',
  },
  filledContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  slotImage: {
    width: 40,
    height: 40,
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
    width: 90,
    height: 90,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#6366f1',
    borderRadius: 16,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 9999,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
  },
  resetButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  resetButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
