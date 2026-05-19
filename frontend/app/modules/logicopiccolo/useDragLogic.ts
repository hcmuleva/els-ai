import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, PanResponderInstance } from 'react-native';

type Point = {
  x: number;
  y: number;
};

export type DragButton = {
  id: string;
  label: string;
  color: string;
  svgXml?: string;
};

export type SlotState = {
  id: number;
  center: Point;
  occupiedBy: string | null;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type UseDragLogicParams = {
  buttons: DragButton[];
  slotCount: number;
  buttonSize: number;
  slotRect: Rect | null;
  trayRect: Rect | null;
  dragBounds?: Rect | null;
};

type DragMapping = Record<number, string | null>;

export function useDragLogic({
  buttons,
  slotCount,
  buttonSize,
  slotRect,
  trayRect,
  dragBounds,
}: UseDragLogicParams) {
  const [slots, setSlots] = useState<SlotState[]>([]);
  const [hoveredSlotId, setHoveredSlotId] = useState<number | null>(null);
  const [mapping, setMapping] = useState<DragMapping>({});

  const pans = useRef<Record<string, Animated.ValueXY>>({});
  const currentPositions = useRef<Record<string, Point>>({});
  const homePositions = useRef<Record<string, Point>>({});
  const buttonToSlot = useRef<Record<string, number | null>>({});
  const dragStart = useRef<Record<string, Point>>({});
  const slotsRef = useRef<SlotState[]>([]);

  const responders = useRef<Record<string, PanResponderInstance>>({});

  useEffect(() => {
    for (const button of buttons) {
      if (!pans.current[button.id]) {
        pans.current[button.id] = new Animated.ValueXY({ x: 0, y: 0 });
      }
      if (buttonToSlot.current[button.id] === undefined) {
        buttonToSlot.current[button.id] = null;
      }
    }
  }, [buttons]);

  useEffect(() => {
    if (!slotRect || !trayRect || slotRect.height <= 0 || trayRect.width <= 0) {
      return;
    }

    const rowHeight = slotRect.height / slotCount;
    const nextSlots: SlotState[] = Array.from({ length: slotCount }, (_, index) => ({
      id: index,
      center: {
        x: slotRect.x + slotRect.width / 2,
        y: slotRect.y + rowHeight * (index + 0.5),
      },
      occupiedBy: null,
    }));

    slotsRef.current = nextSlots;
    setSlots(nextSlots);

    const totalButtons = buttons.length;
    const availableWidth = Math.max(trayRect.width - totalButtons * buttonSize, totalButtons * 4);
    const gap = availableWidth / (totalButtons + 1);
    const y = trayRect.y + (trayRect.height - buttonSize) / 2;

    const nextMapping: DragMapping = {};
    nextSlots.forEach((slot) => {
      nextMapping[slot.id] = null;
    });

    buttons.forEach((button, index) => {
      const x = trayRect.x + gap * (index + 1) + buttonSize * index;
      const point = { x, y };
      homePositions.current[button.id] = point;
      currentPositions.current[button.id] = point;
      buttonToSlot.current[button.id] = null;
      pans.current[button.id].setValue(point);
    });

    setMapping(nextMapping);
    setHoveredSlotId(null);
  }, [buttonSize, buttons, slotCount, slotRect, trayRect]);

  const animateButtonTo = (buttonId: string, point: Point) => {
    Animated.spring(pans.current[buttonId], {
      toValue: point,
      bounciness: 7,
      speed: 18,
      useNativeDriver: false,
    }).start(() => {
      currentPositions.current[buttonId] = point;
    });
  };

  const resetButton = (buttonId: string) => {
    const home = homePositions.current[buttonId];
    if (!home) {
      return;
    }
    animateButtonTo(buttonId, home);
  };

  const updateSlotMapping = (nextSlots: SlotState[]) => {
    slotsRef.current = nextSlots;
    setSlots(nextSlots);

    const nextMap: DragMapping = {};
    nextSlots.forEach((slot) => {
      nextMap[slot.id] = slot.occupiedBy;
    });
    setMapping(nextMap);
  };

  const findNearestSlot = (point: Point): SlotState | null => {
    if (slotsRef.current.length === 0) {
      return null;
    }

    const buttonCenter = {
      x: point.x + buttonSize / 2,
      y: point.y + buttonSize / 2,
    };

    let nearest: SlotState | null = null;
    let nearestDistance = Number.MAX_SAFE_INTEGER;

    for (const slot of slotsRef.current) {
      const dx = buttonCenter.x - slot.center.x;
      const dy = buttonCenter.y - slot.center.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = slot;
      }
    }

    const snapThreshold = Math.max(42, buttonSize * 1.35);
    return nearestDistance <= snapThreshold ? nearest : null;
  };

  const clampPointToBounds = (point: Point): Point => {
    if (!dragBounds) {
      return point;
    }

    const minX = dragBounds.x;
    const minY = dragBounds.y;
    const maxX = dragBounds.x + dragBounds.width - buttonSize;
    const maxY = dragBounds.y + dragBounds.height - buttonSize;

    return {
      x: Math.min(Math.max(point.x, minX), maxX),
      y: Math.min(Math.max(point.y, minY), maxY),
    };
  };

  const handleRelease = (buttonId: string, point: Point) => {
    const nearest = findNearestSlot(point);
    const previousSlotId = buttonToSlot.current[buttonId];

    if (!nearest) {
      if (previousSlotId !== null) {
        const nextSlots = slotsRef.current.map((slot) =>
          slot.id === previousSlotId ? { ...slot, occupiedBy: null } : slot,
        );
        updateSlotMapping(nextSlots);
        buttonToSlot.current[buttonId] = null;
      }
      resetButton(buttonId);
      return;
    }

    const nextSlots = slotsRef.current.map((slot) => ({ ...slot }));
    const target = nextSlots.find((slot) => slot.id === nearest.id);
    if (!target) {
      resetButton(buttonId);
      return;
    }

    if (target.occupiedBy && target.occupiedBy !== buttonId) {
      const displacedButtonId = target.occupiedBy;
      buttonToSlot.current[displacedButtonId] = null;
      resetButton(displacedButtonId);
    }

    if (previousSlotId !== null && previousSlotId !== target.id) {
      const prev = nextSlots.find((slot) => slot.id === previousSlotId);
      if (prev) {
        prev.occupiedBy = null;
      }
    }

    target.occupiedBy = buttonId;
    buttonToSlot.current[buttonId] = target.id;

    const snappedPoint = {
      x: target.center.x - buttonSize / 2,
      y: target.center.y - buttonSize / 2,
    };

    animateButtonTo(buttonId, snappedPoint);
    updateSlotMapping(nextSlots);
  };

  const getResponder = useMemo(() => {
    return (buttonId: string) => {
      if (responders.current[buttonId]) {
        return responders.current[buttonId];
      }

      responders.current[buttonId] = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          const start = currentPositions.current[buttonId] ?? { x: 0, y: 0 };
          dragStart.current[buttonId] = start;
          pans.current[buttonId].setOffset(start);
          pans.current[buttonId].setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: (_event, gestureState) => {
          const start = dragStart.current[buttonId] ?? { x: 0, y: 0 };
          const rawPoint = {
            x: start.x + gestureState.dx,
            y: start.y + gestureState.dy,
          };
          const nextPoint = clampPointToBounds(rawPoint);
          pans.current[buttonId].setValue({
            x: nextPoint.x - start.x,
            y: nextPoint.y - start.y,
          });

          const nearest = findNearestSlot(nextPoint);
          setHoveredSlotId(nearest?.id ?? null);
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: () => {
          pans.current[buttonId].flattenOffset();
          pans.current[buttonId].stopAnimation((value) => {
            setHoveredSlotId(null);
            handleRelease(buttonId, clampPointToBounds(value));
          });
        },
        onPanResponderTerminate: () => {
          pans.current[buttonId].flattenOffset();
          setHoveredSlotId(null);
          resetButton(buttonId);
        },
      });

      return responders.current[buttonId];
    };
  }, [dragBounds]);

  return {
    slots,
    hoveredSlotId,
    mapping,
    pans: pans.current,
    getResponder,
  };
}
