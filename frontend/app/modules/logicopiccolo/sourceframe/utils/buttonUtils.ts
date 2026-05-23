import { ButtonIdentity, ButtonVariant, ColorType } from '../types';

export function buttonKey(button: ButtonIdentity): string {
  return `${button.color}:${button.variant}`;
}

export function buttonsEqual(a: ButtonIdentity, b: ButtonIdentity): boolean {
  return a.color === b.color && a.variant === b.variant;
}

export function isButtonOccupied(
  button: ButtonIdentity,
  placements: Map<number, ButtonIdentity>
): boolean {
  for (const placed of placements.values()) {
    if (buttonsEqual(placed, button)) return true;
  }
  return false;
}

export function uniqueButtonsFromQuestions(
  questions: { color: ColorType; variant?: ButtonVariant }[]
): ButtonIdentity[] {
  const seen = new Set<string>();
  const result: ButtonIdentity[] = [];
  for (const q of questions) {
    const btn: ButtonIdentity = {
      color: q.color,
      variant: q.variant ?? 'solid',
    };
    const key = buttonKey(btn);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(btn);
    }
  }
  return result;
}
