// src/store/gameStore.ts

import { useSyncExternalStore } from 'react';
import { Card, Placement, ButtonIdentity } from '../types';
import { buttonsEqual } from '../utils/buttonUtils';

interface GameState {
  currentCard: Card | null;
  placements: Map<number, ButtonIdentity>;
  attempts: Placement[];
  score: number;
  isFlipped: boolean;
  showAnswer: boolean;
  timeRemaining: number;
  isGameActive: boolean;
  
  setCurrentCard: (card: Card) => void;
  placeButton: (slotId: number, button: ButtonIdentity) => void;
  removeButton: (slotId: number) => void;
  resetPlacements: () => void;
  checkAnswer: () => { correct: number; total: number; score: number };
  showAnswerSide: () => void;
  flipCard: () => void;
  /** Toggle expected answers display mode */
  toggleAnswerFlip: () => void;
  updateProgress: (attempt: unknown) => void;
  startGame: () => void;
  endGame: () => void;
}

type StateUpdater = Partial<GameState> | ((state: GameState) => Partial<GameState>);
type StoreListener = () => void;

const listeners = new Set<StoreListener>();

let state: GameState;

const getState = () => state;

const setState = (updater: StateUpdater) => {
  const patch = typeof updater === 'function' ? updater(state) : updater;
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: StoreListener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

state = {
  currentCard: null,
  placements: new Map(),
  attempts: [],
  score: 0,
  isFlipped: false,
  showAnswer: false,
  timeRemaining: 300,
  isGameActive: false,

  setCurrentCard: (card) =>
    setState({
      currentCard: card,
      placements: new Map(),
      score: 0,
      isFlipped: false,
      showAnswer: false,
    }),

  placeButton: (slotId, button) => {
    const { placements } = getState();
    const newPlacements = new Map(placements);
    if (newPlacements.has(slotId)) return;
    newPlacements.set(slotId, button);
    setState({ placements: newPlacements });
  },

  removeButton: (slotId) => {
    const { placements } = getState();
    const newPlacements = new Map(placements);
    newPlacements.delete(slotId);
    setState({ placements: newPlacements });
  },

  resetPlacements: () => setState({ placements: new Map(), showAnswer: false }),

  checkAnswer: () => {
    const { placements, currentCard } = getState();
    if (!currentCard) return { correct: 0, total: 0, score: 0 };

    let correct = 0;
    const attempts: Placement[] = [];

    currentCard.questions.forEach((question) => {
      const placed = placements.get(question.targetSlot);
      const expected: ButtonIdentity = {
        color: question.color,
        variant: question.variant ?? 'solid',
      };
      const isCorrect = placed ? buttonsEqual(placed, expected) : false;
      if (isCorrect) correct++;

      attempts.push({
        slotId: question.targetSlot,
        color: placed?.color ?? 'white',
        variant: placed?.variant,
        isCorrect,
      });
    });

    const total = currentCard.questions.length;
    const score = total > 0 ? (correct / total) * 100 : 0;
    setState({ attempts, score });
    return { correct, total, score };
  },

  showAnswerSide: () => setState({ showAnswer: true, isFlipped: true }),

  flipCard: () => setState((current) => ({ isFlipped: !current.isFlipped })),

  toggleAnswerFlip: () => {
    const { showAnswer, currentCard } = getState();
    if (!currentCard) return;

    if (showAnswer) {
      setState({ showAnswer: false, isFlipped: false });
      return;
    }

    setState({ showAnswer: true, isFlipped: true });
  },

  updateProgress: (attempt) => {
    console.log('Progress updated:', attempt);
  },

  startGame: () => setState({ isGameActive: true, timeRemaining: 300 }),

  endGame: () => setState({ isGameActive: false }),
};

export const useGameStore = () => useSyncExternalStore(subscribe, getState, getState);
