// src/types/index.ts

export type ColorType =
  | 'red' | 'blue' | 'green' | 'yellow'
  | 'orange' | 'purple' | 'pink' | 'brown'
  | 'black' | 'white';

export type ButtonVariant = 'solid' | 'ring';

export interface ButtonIdentity {
  color: ColorType;
  variant: ButtonVariant;
}

/** Right column: fixed option shown in each box (set when creating the card) */
export interface CardOptionSlot {
  id: number;
  value: string;
  /** Optional inline SVG XML to render as image instead of text */
  visualXml?: string;
}

/** Left column: problem + which colored button belongs in which option slot */
export interface Question {
  id: number;
  question: string;
  answer: string;
  color: ColorType;
  variant?: ButtonVariant;
  targetSlot: number;
  visualSvg?: string;
  visualXml?: string;
}

export interface CardLayoutSplit {
  /** Where the options column starts (0–1 of card width) */
  optionsColumnStartX: number;
  /** Width of the options column (0–1 of card width) */
  optionsColumnWidth: number;
  /** Green header height (0–1 of card height) */
  headerHeight?: number;
  /** Optional vertical row offset for right slot rail (e.g. -1 moves rail up by one row) */
  railOffsetRows?: number;
}

export interface Card {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  /** Left side: problems with colored markers */
  questions: Question[];
  /** Right side: option box labels (e.g. 4, 10, 18…) */
  optionSlots: CardOptionSlot[];
  frameConfig: FrameConfig;
  imageUrl?: string;
  imageSource?: number;
  createdAt: Date;
  plays: number;
  successRate: number;
}

export interface FrameConfig {
  totalSlots: number;
  allowedColors: ColorType[];
  cardAspectRatio?: number;
  /** Y positions for option boxes (0–1 of card height) */
  slotPositions?: SlotPosition[];
  useAlignedLayout?: boolean;
  layoutTemplate?: 'logico-10-right' | 'even';
  layoutSplit?: CardLayoutSplit;
}

export interface SlotPosition {
  id: number;
  /** Y center relative to full card height */
  y: number;
  /** Optional normalized box height */
  height?: number;
}

export interface UserAttempt {
  cardId: string;
  timestamp: Date;
  placements: Placement[];
  score: number;
  completed: boolean;
  timeSpent: number;
}

export interface Placement {
  slotId: number;
  color: ColorType;
  variant?: ButtonVariant;
  isCorrect: boolean;
}

export interface UserProgress {
  totalAttempts: number;
  correctPlacements: number;
  totalPlacements: number;
  cardsCompleted: number;
  averageScore: number;
  categoryProgress: Record<string, number>;
  difficultyProgress: Record<string, number>;
}
