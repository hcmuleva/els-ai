import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  PanResponder,
  Animated,
  Platform,
} from 'react-native';
import { Check, RotateCcw, Hand, ArrowRight } from 'lucide-react-native';
import { AudioManager } from '../../utils/audio';
import { resolveMediaUrl } from './QuizRenderer';
import type { QuestionTheme } from './QuizRenderer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type DragItem = {
  id: string;
  image?: string | null;
  label?: string;
  sound?: string;
};

export type DropTarget = {
  id: string;
  label: string;
};

export type MatchRule = {
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

/**
 * Checks if a valid, real image is provided (excludes null, empty strings, and dummy placeholders).
 */
export function hasValidImage(img?: string | null): boolean {
  if (!img || typeof img !== 'string') return false;
  const trimmed = img.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false;
  if (trimmed.includes('placehold.co') && trimmed.includes('text=')) return false;
  return true;
}

export default function DragDropRenderer({ questionData, onComplete, theme }: Props) {
  const insets = useSafeAreaInsets();
  const { drag_items = [], drop_targets = [], match_rules = [] } = questionData;

  // Shuffle the draggable items so they don't visually align 1:1 with targets
  const displayItems = useMemo(() => {
    const arr = [...drag_items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    if (arr.length > 1 && arr.every((it, idx) => it.id === drag_items[idx]?.id)) {
      arr.push(arr.shift()!);
    }
    return arr;
  }, [drag_items]);

  const [matches, setMatches] = useState<Record<string, string>>({}); // target_id -> item_id
  const [placedItems, setPlacedItems] = useState<Set<string>>(new Set());
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null); // Tap-to-match selection
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);

  const containerRef = useRef<View>(null);
  const targetRefs = useRef<Record<string, View>>({});
  const targetLayoutsRef = useRef<Record<string, { x: number; y: number; width: number; height: number }>>({});
  const containerOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragTouchOffsetRef = useRef<{ x: number; y: number }>({ x: 40, y: 30 });

  // Animated coordinates for the active floating card
  const pan = useRef(new Animated.ValueXY()).current;

  useEffect(() => {
    setPlacedItems(new Set(Object.values(matches)));
    if (selectedItemId && Object.values(matches).includes(selectedItemId)) {
      setSelectedItemId(null);
    }
  }, [matches, selectedItemId]);

  const updateTargetMeasurements = () => {
    if (containerRef.current && containerRef.current.measureInWindow) {
      containerRef.current.measureInWindow((cx, cy) => {
        containerOffsetRef.current = { x: cx, y: cy };
      });
    }

    drop_targets.forEach((target) => {
      const ref = targetRefs.current[target.id];
      if (ref && ref.measureInWindow) {
        ref.measureInWindow((x, y, width, height) => {
          if (width > 0 && height > 0) {
            targetLayoutsRef.current[target.id] = { x, y, width, height };
          }
        });
      }
    });
  };

  const onContainerLayout = () => {
    updateTargetMeasurements();
    setTimeout(updateTargetMeasurements, 150);
  };

  const placeItemInTarget = (itemId: string, targetId: string) => {
    setMatches((prev) => {
      const next = { ...prev };
      // Remove item from any existing slot
      Object.keys(next).forEach((k) => {
        if (next[k] === itemId) delete next[k];
      });
      next[targetId] = itemId;
      return next;
    });
    setSelectedItemId(null);
    setHoveredTargetId(null);
  };

  const handleDropCoord = (itemId: string, pageX: number, pageY: number) => {
    const HIT_SLOP = 25; // Generous drop threshold for both PC and touch screens
    let matchedTargetId: string | null = null;

    for (const target of drop_targets) {
      const box = targetLayoutsRef.current[target.id];
      if (box) {
        if (
          pageX >= box.x - HIT_SLOP &&
          pageX <= box.x + box.width + HIT_SLOP &&
          pageY >= box.y - HIT_SLOP &&
          pageY <= box.y + box.height + HIT_SLOP
        ) {
          matchedTargetId = target.id;
          break;
        }
      }
    }

    if (matchedTargetId) {
      placeItemInTarget(itemId, matchedTargetId);
      const snapSound = resolveMediaUrl('/media/sound-effects/snap.mp3');
      if (snapSound) AudioManager.playSound(snapSound);
    }
  };

  const handleItemPress = (itemId: string) => {
    if (placedItems.has(itemId)) return;
    if (selectedItemId === itemId) {
      setSelectedItemId(null);
    } else {
      setSelectedItemId(itemId);
      const item = drag_items.find((i) => i.id === itemId);
      if (item?.sound) {
        const sound = resolveMediaUrl(item.sound);
        if (sound) AudioManager.playSound(sound);
      }
    }
  };

  const handleTargetPress = (targetId: string) => {
    // If an item is selected via tap, place it in this target
    if (selectedItemId) {
      placeItemInTarget(selectedItemId, targetId);
      return;
    }

    // Otherwise, if already filled, tap to release
    const filledItemId = matches[targetId];
    if (filledItemId) {
      setMatches((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
    }
  };

  const handleReset = () => {
    setMatches({});
    setActiveDragId(null);
    setSelectedItemId(null);
    setHoveredTargetId(null);
  };

  const handleSubmit = () => {
    if (Object.keys(matches).length < drop_targets.length) {
      const warnSound = resolveMediaUrl('/media/sound-effects/incorrect.mp3');
      if (warnSound) AudioManager.playSound(warnSound);
      return;
    }

    let allCorrect = true;
    const studentMatches: any[] = [];

    match_rules.forEach((rule) => {
      const placedItemId = matches[rule.drop_target_id];
      const isCorrect = placedItemId === rule.drag_item_id;
      if (!isCorrect) allCorrect = false;
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

  // Robust cross-platform PanResponder for each draggable item
  const createItemPanResponder = (item: DragItem) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5;
      },
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        return Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        updateTargetMeasurements();
        setActiveDragId(item.id);
        setSelectedItemId(item.id);

        if (item.sound) {
          const sound = resolveMediaUrl(item.sound);
          if (sound) AudioManager.playSound(sound);
        }

        const locX = Number.isFinite(evt.nativeEvent.locationX) ? evt.nativeEvent.locationX : 40;
        const locY = Number.isFinite(evt.nativeEvent.locationY) ? evt.nativeEvent.locationY : 30;
        dragTouchOffsetRef.current = { x: locX, y: locY };

        const startX = evt.nativeEvent.pageX - containerOffsetRef.current.x - locX;
        const startY = evt.nativeEvent.pageY - containerOffsetRef.current.y - locY;
        pan.setValue({ x: startX, y: startY });
      },
      onPanResponderMove: (evt) => {
        const curPageX = evt.nativeEvent.pageX;
        const curPageY = evt.nativeEvent.pageY;

        const dragX = curPageX - containerOffsetRef.current.x - dragTouchOffsetRef.current.x;
        const dragY = curPageY - containerOffsetRef.current.y - dragTouchOffsetRef.current.y;
        pan.setValue({ x: dragX, y: dragY });

        // Target hover detection
        let foundHover: string | null = null;
        for (const target of drop_targets) {
          const box = targetLayoutsRef.current[target.id];
          if (
            box &&
            curPageX >= box.x &&
            curPageX <= box.x + box.width &&
            curPageY >= box.y &&
            curPageY <= box.y + box.height
          ) {
            foundHover = target.id;
            break;
          }
        }
        setHoveredTargetId(foundHover);
      },
      onPanResponderRelease: (evt) => {
        handleDropCoord(item.id, evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        setActiveDragId(null);
        setHoveredTargetId(null);
      },
      onPanResponderTerminate: () => {
        setActiveDragId(null);
        setHoveredTargetId(null);
      },
    });
  };

  const activeDraggedItem = drag_items.find((i) => i.id === activeDragId);
  const activeHasImage = activeDraggedItem ? hasValidImage(activeDraggedItem.image) : false;

  return (
    <View ref={containerRef} onLayout={onContainerLayout} style={styles.container}>
      {/* Helper instruction badge */}
      <View style={styles.instructionRow}>
        <Hand size={13} color="#2563EB" />
        <Text style={styles.instructionText}>
          {selectedItemId
            ? 'Item selected — tap any target slot to pair it, or drag it.'
            : 'Drag items to their targets, or tap an item then tap a target.'}
        </Text>
      </View>

      <View style={styles.gameBoard}>
        {/* Left Column: Draggable Items */}
        <View style={styles.column}>
          <Text style={styles.columnHeader}>Items</Text>
          <View style={styles.list}>
            {displayItems.map((item) => {
              const isPlaced = placedItems.has(item.id);
              const isDragging = activeDragId === item.id;
              const isSelected = selectedItemId === item.id;
              const itemHasImg = hasValidImage(item.image);

              return (
                <View
                  key={item.id}
                  {...(isPlaced ? {} : createItemPanResponder(item).panHandlers)}
                  style={[
                    styles.itemCard,
                    !itemHasImg && styles.itemCardTextOnly,
                    isPlaced && styles.itemCardPlaced,
                    isSelected && !isPlaced && styles.itemCardSelected,
                    isDragging && styles.itemCardDragging,
                    Platform.OS === 'web' && ({
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      cursor: isPlaced ? 'default' : isDragging ? 'grabbing' : 'grab',
                    } as any),
                  ]}
                >
                  <Pressable
                    disabled={isPlaced}
                    onPress={() => handleItemPress(item.id)}
                    style={styles.cardInnerPressable}
                  >
                    {itemHasImg ? (
                      <Image
                        // @ts-ignore
                        draggable={false}
                        source={{ uri: resolveMediaUrl(item.image!) }}
                        style={styles.itemImage}
                      />
                    ) : null}

                    {item.label ? (
                      <Text
                        style={[
                          styles.itemLabel,
                          !itemHasImg && styles.itemLabelTextOnly,
                          isSelected && styles.itemLabelSelected,
                        ]}
                        numberOfLines={2}
                      >
                        {item.label}
                      </Text>
                    ) : null}

                    {isPlaced && (
                      <View style={styles.placedBadge}>
                        <Check size={11} color="#ffffff" strokeWidth={2.6} />
                      </View>
                    )}

                    {isSelected && !isPlaced && (
                      <View style={styles.selectedIndicator}>
                        <ArrowRight size={12} color="#2563EB" strokeWidth={2.5} />
                      </View>
                    )}
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>

        {/* Right Column: Drop Targets */}
        <View style={styles.column}>
          <Text style={styles.columnHeader}>Matching Targets</Text>
          <View style={styles.list}>
            {drop_targets.map((target) => {
              const filledItemId = matches[target.id];
              const filledItem = drag_items.find((i) => i.id === filledItemId);
              const filledHasImg = filledItem ? hasValidImage(filledItem.image) : false;
              const isHovered = hoveredTargetId === target.id;
              const isAwaitingTapPlacement = Boolean(selectedItemId && !filledItem);

              return (
                <Pressable
                  key={target.id}
                  ref={(el) => {
                    if (el) targetRefs.current[target.id] = el;
                  }}
                  onPress={() => handleTargetPress(target.id)}
                  style={[
                    styles.targetSlot,
                    !filledHasImg && styles.targetSlotTextOnly,
                    filledItem && styles.targetSlotFilled,
                    isHovered && styles.targetSlotHovered,
                    isAwaitingTapPlacement && styles.targetSlotAwaiting,
                    Platform.OS === 'web' && ({ cursor: 'pointer', userSelect: 'none' } as any),
                  ]}
                >
                  {filledItem ? (
                    <View style={styles.filledContent}>
                      {filledHasImg ? (
                        <Image
                          // @ts-ignore
                          draggable={false}
                          source={{ uri: resolveMediaUrl(filledItem.image!) }}
                          style={styles.slotImage}
                        />
                      ) : null}
                      <Text style={[styles.slotLabel, !filledHasImg && styles.slotLabelTextOnly]}>
                        {target.label}
                      </Text>
                      {filledItem.label && filledItem.label !== target.label ? (
                        <Text style={styles.matchedPairPill} numberOfLines={1}>
                          {filledItem.label}
                        </Text>
                      ) : null}
                      <Text style={styles.slotSubLabel}>Tap to release</Text>
                    </View>
                  ) : (
                    <View style={styles.emptySlotContent}>
                      <Text style={styles.emptySlotLabel}>{target.label}</Text>
                      {isAwaitingTapPlacement ? (
                        <Text style={styles.tapToPlaceText}>Tap to pair here</Text>
                      ) : null}
                    </View>
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
            !activeHasImage && styles.floatingDragCardTextOnly,
            {
              transform: [{ translateX: pan.x }, { translateY: pan.y }],
            },
          ]}
        >
          {activeHasImage ? (
            <Image
              // @ts-ignore
              draggable={false}
              source={{ uri: resolveMediaUrl(activeDraggedItem.image!) }}
              style={styles.itemImage}
            />
          ) : null}
          {activeDraggedItem.label ? (
            <Text
              style={[styles.itemLabel, !activeHasImage && styles.itemLabelTextOnly]}
              numberOfLines={2}
            >
              {activeDraggedItem.label}
            </Text>
          ) : null}
        </Animated.View>
      )}

      {/* Action Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable onPress={handleReset} style={styles.resetButton}>
          <RotateCcw size={15} color="#475569" />
          <Text style={styles.resetButtonText}>Reset</Text>
        </Pressable>
        <Pressable
          onPress={handleSubmit}
          style={[styles.submitButton, { backgroundColor: theme?.accent || '#2563EB' }]}
        >
          <Text style={styles.submitButtonText}>Check Answers ✓</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    gap: 12,
    position: 'relative',
    width: '100%',
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'center',
  },
  instructionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  gameBoard: {
    flexDirection: 'row',
    gap: 12,
  },
  column: {
    flex: 1,
    gap: 8,
  },
  columnHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  list: {
    gap: 10,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    minHeight: 68,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  itemCardTextOnly: {
    minHeight: 52,
  },
  cardInnerPressable: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  itemCardDragging: {
    opacity: 0.35,
    borderColor: '#94A3B8',
    borderStyle: 'dashed',
  },
  itemCardSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
    shadowColor: '#2563EB',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  itemCardPlaced: {
    opacity: 0.45,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  itemImage: {
    width: 36,
    height: 36,
    resizeMode: 'contain',
  },
  itemLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'center',
    marginTop: 4,
  },
  itemLabelTextOnly: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 0,
    lineHeight: 18,
  },
  itemLabelSelected: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  placedBadge: {
    position: 'absolute',
    right: 6,
    top: 6,
    backgroundColor: '#10B981',
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedIndicator: {
    position: 'absolute',
    right: 6,
    top: 6,
    backgroundColor: '#DBEAFE',
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetSlot: {
    minHeight: 68,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  targetSlotTextOnly: {
    minHeight: 52,
  },
  targetSlotHovered: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
    borderStyle: 'solid',
  },
  targetSlotAwaiting: {
    borderColor: '#3B82F6',
    backgroundColor: '#F0F7FF',
  },
  targetSlotFilled: {
    borderStyle: 'solid',
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  emptySlotContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  emptySlotLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },
  tapToPlaceText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2563EB',
  },
  filledContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    width: '100%',
  },
  slotImage: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  slotLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
    textAlign: 'center',
  },
  slotLabelTextOnly: {
    fontSize: 12,
    color: '#047857',
  },
  matchedPairPill: {
    fontSize: 10,
    fontWeight: '600',
    color: '#15803D',
    backgroundColor: '#DCFCE7',
    paddingVertical: 1,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 2,
  },
  slotSubLabel: {
    fontSize: 9,
    color: '#059669',
    fontStyle: 'italic',
    marginTop: 1,
  },
  floatingDragCard: {
    position: 'absolute',
    minWidth: 100,
    minHeight: 68,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#2563EB',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 9999,
  },
  floatingDragCardTextOnly: {
    minHeight: 52,
    minWidth: 90,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  resetButton: {
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  resetButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
