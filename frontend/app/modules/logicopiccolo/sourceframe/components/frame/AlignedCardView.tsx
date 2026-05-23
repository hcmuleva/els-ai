import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Image,
  ImageSourcePropType,
  LayoutChangeEvent,
} from 'react-native';
import { CardLayoutSplit, CardOptionSlot, Question } from '../../types';
import { OptionsColumn } from './OptionsColumn';
import { FrameSlotRail } from './FrameSlotRail';
import { QuestionColumn } from './QuestionColumn';
import { SLOT_COL_WIDTH } from './Slot';
import { ButtonIdentity } from '../../types';
import { computeAlignedRowLayout } from '../../utils/cardLayout';
import { LOGICO_LAYOUT_SPLIT } from '../../constants/logicoLayout';

interface AlignedCardViewProps {
  imageSource?: ImageSourcePropType;
  cardAspectRatio: number;
  layoutSplit?: CardLayoutSplit;
  optionSlots: CardOptionSlot[];
  questions: Question[];
  title?: string;
  placements: Map<number, ButtonIdentity>;
  expectedPlacements: Map<number, ButtonIdentity>;
  showAnswer: boolean;
  onSlotPress: (slotId: number) => void;
}

/**
 * Split card: left = problems, right = 10 equal option boxes.
 * Frame rail uses the same 10-row grid beside the options column.
 */
export const AlignedCardView: React.FC<AlignedCardViewProps> = ({
  imageSource,
  cardAspectRatio,
  layoutSplit,
  optionSlots,
  questions,
  title,
  placements,
  expectedPlacements,
  showAnswer,
  onSlotPress,
}) => {
  const DEBUG_LAYOUT = __DEV__;
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const split = layoutSplit ?? LOGICO_LAYOUT_SPLIT;
  const slotCount = optionSlots.length;

  const onStageLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setStage({ width, height });
  };

  const layout = useMemo(() => {
    if (stage.width <= 0 || stage.height <= 0) {
      return null;
    }
    return computeAlignedRowLayout(
      stage.width,
      stage.height,
      cardAspectRatio,
      split.optionsColumnWidth,
      SLOT_COL_WIDTH,
      8
    );
  }, [stage, cardAspectRatio, split.optionsColumnWidth]);

  if (!layout) {
    return <View style={styles.stage} onLayout={onStageLayout} />;
  }

  const { cardWidth, cardHeight, leftWidth, optionsWidth, gap } = layout;
  const headerHeight = split.headerHeight ?? 0.145;
  const slotRowHeight =
    slotCount > 0 ? (cardHeight * (1 - headerHeight)) / slotCount : 0;
  const railOffsetY = (split.railOffsetRows ?? 0) * slotRowHeight;

  return (
    <View style={styles.stage} onLayout={onStageLayout}>
      <View style={styles.row}>
        <View style={[styles.cardRow, { width: cardWidth, height: cardHeight }]}>
          {imageSource && (
            <Image
              source={imageSource}
              style={styles.fullCardImage}
              resizeMode="stretch"
            />
          )}

          <View style={[styles.leftPanel, { width: leftWidth, height: cardHeight }]}>
            {!imageSource && (
              <QuestionColumn
                width={leftWidth}
                height={cardHeight}
                questions={questions}
                headerHeight={headerHeight}
                headerTitle={title}
                debug={DEBUG_LAYOUT}
              />
            )}
          </View>

          <OptionsColumn
            width={optionsWidth}
            height={cardHeight}
            optionSlots={optionSlots}
            expectedPlacements={expectedPlacements}
            showAnswer={showAnswer}
            overlayOnly={Boolean(imageSource)}
            headerHeight={headerHeight}
            expectedOffsetY={railOffsetY}
            debug={DEBUG_LAYOUT}
          />
        </View>

        <View style={{ width: gap }} />

        <FrameSlotRail
          height={cardHeight}
          slotCount={slotCount}
          headerHeight={headerHeight}
          offsetY={railOffsetY}
          placements={placements}
          onSlotPress={onSlotPress}
          debug={DEBUG_LAYOUT}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-start',
    alignItems: 'center',
    minHeight: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    maxHeight: '100%',
  },
  cardRow: {
    position: 'relative',
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#222',
  },
  leftPanel: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  fullCardImage: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
  },
  leftPlaceholder: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});
