// src/components/frame/Frame.tsx

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Text,
  Image,
} from 'react-native';
import { useGameStore } from '../../store/gameStore';
import { ColorButton } from './ColorButton';
import { Slot, SLOT_COL_WIDTH } from './Slot';
import { AlignedCardView } from './AlignedCardView';
import { ButtonIdentity } from '../../types';
import { buttonsEqual, isButtonOccupied, uniqueButtonsFromQuestions } from '../../utils/buttonUtils';
import { LOGICO_BUTTON_SET } from '../../utils/colors';
import { LOGICO_CARD_WIDTH, LOGICO_CARD_HEIGHT } from '../../constants/logicoLayout';

const { width } = Dimensions.get('window');
const isMobile = width < 600;

const PARKING_BTN = isMobile ? 26 : 34;
const DEFAULT_CARD_ASPECT = LOGICO_CARD_WIDTH / LOGICO_CARD_HEIGHT;

function getCardImageSource(card: { imageSource?: number; imageUrl?: string }) {
  if (card.imageSource != null) {
    return card.imageSource;
  }
  if (card.imageUrl) {
    return { uri: card.imageUrl };
  }
  return null;
}

export const Frame: React.FC = () => {
  const { currentCard, placements, placeButton, removeButton, showAnswer } =
    useGameStore();
  const [selectedButton, setSelectedButton] = useState<ButtonIdentity | null>(null);
  const expectedPlacements = new Map<number, ButtonIdentity>(
    (currentCard?.questions ?? []).map((q) => [
      q.targetSlot,
      { color: q.color, variant: q.variant ?? 'solid' as const },
    ])
  );

  const parkingButtons = currentCard
    ? uniqueButtonsFromQuestions(currentCard.questions)
    : LOGICO_BUTTON_SET;

  const imageSource = currentCard ? getCardImageSource(currentCard) : null;
  const frameConfig = currentCard?.frameConfig;
  const cardAspectRatio = frameConfig?.cardAspectRatio ?? DEFAULT_CARD_ASPECT;
  const slotPositions = frameConfig?.slotPositions ?? [];
  const useAlignedLayout =
    frameConfig?.useAlignedLayout !== false &&
    slotPositions.length > 0 &&
    (currentCard?.optionSlots?.length ?? 0) > 0;

  const handleParkingPress = (button: ButtonIdentity) => {
    if (selectedButton && buttonsEqual(selectedButton, button)) {
      setSelectedButton(null);
    } else {
      setSelectedButton(button);
    }
  };

  const handleSlotPress = (slotId: number) => {
    const existing = placements.get(slotId);

    if (existing) {
      removeButton(slotId);
      setSelectedButton(null);
    } else if (selectedButton) {
      placeButton(slotId, selectedButton);
      setSelectedButton(null);
    }
  };

  const renderLegacyLayout = () => (
    <>
      <View style={styles.cardArea}>
        {imageSource ? (
          <Image
            source={imageSource}
            style={[styles.cardImage, { aspectRatio: cardAspectRatio }]}
            resizeMode="stretch"
          />
        ) : (
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderText}>
              {currentCard?.title || 'No Card Selected'}
            </Text>
            <Text style={styles.placeholderSubtext}>
              {currentCard?.description}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.slotColumnLegacy}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((slotId) => (
          <Slot
            key={slotId}
            slotId={slotId}
            placedButton={placements.get(slotId) ?? null}
            onPress={() => handleSlotPress(slotId)}
          />
        ))}
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <View style={styles.outerFrame} pointerEvents="box-none">
        <View
          style={[
            styles.mainContent,
            !useAlignedLayout && styles.mainContentRow,
          ]}
        >
          {useAlignedLayout ? (
            <AlignedCardView
              imageSource={imageSource ?? undefined}
              cardAspectRatio={cardAspectRatio}
              layoutSplit={frameConfig?.layoutSplit}
              optionSlots={currentCard!.optionSlots}
              questions={currentCard!.questions}
              title={currentCard?.title}
              placements={placements}
              expectedPlacements={expectedPlacements}
              showAnswer={showAnswer}
              onSlotPress={handleSlotPress}
            />
          ) : (
            renderLegacyLayout()
          )}
        </View>

        <View style={styles.bottomArea}>
          <View style={styles.parkingTray}>
            {parkingButtons.map((button) => {
              const occupied = isButtonOccupied(button, placements);
              const isSelected =
                selectedButton !== null && buttonsEqual(selectedButton, button);

              return (
                <View
                  key={`${button.color}-${button.variant}`}
                  style={styles.parkingSlot}
                >
                  {!occupied ? (
                    <ColorButton
                      color={button.color}
                      variant={button.variant}
                      size="parking"
                      onPress={() => handleParkingPress(button)}
                      style={isSelected ? styles.selectedButton : undefined}
                    />
                  ) : (
                    <View
                      style={[
                        styles.emptyParkingHole,
                        {
                          width: PARKING_BTN,
                          height: PARKING_BTN,
                          borderRadius: PARKING_BTN / 2,
                        },
                      ]}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#333',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  outerFrame: {
    flex: 1,
    width: '100%',
    backgroundColor: '#1E4D2B',
    borderRadius: 12,
    borderWidth: isMobile ? 4 : 8,
    borderColor: '#14361E',
    padding: isMobile ? 4 : 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    minHeight: 0,
  },
  mainContent: {
    flex: 1,
    marginBottom: 6,
    minHeight: 0,
  },
  mainContentRow: {
    flexDirection: 'row',
  },
  cardArea: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 10,
    marginRight: 6,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  cardImage: {
    height: '100%',
    maxWidth: '100%',
  },
  placeholderCard: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
  slotColumnLegacy: {
    width: SLOT_COL_WIDTH,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
  },
  bottomArea: {
    height: isMobile ? 52 : 64,
    marginTop: 6,
  },
  parkingTray: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    paddingHorizontal: isMobile ? 4 : 8,
    paddingVertical: 4,
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  parkingSlot: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyParkingHole: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  selectedButton: {
    borderWidth: 3,
    borderColor: 'white',
    transform: [{ scale: 1.08 }],
  },
});
