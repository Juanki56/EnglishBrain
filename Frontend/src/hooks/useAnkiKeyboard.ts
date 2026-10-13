import { useHotkeys } from './useHotkeys';

export type Grade = 1 | 2 | 3 | 4;

/**
 * Teclado de la sesión Anki (spec srs-review): Espacio voltea la tarjeta,
 * 1–4 califican (solo con la tarjeta volteada) y Esc sale.
 */
export function useAnkiKeyboard({
  flipped,
  onFlip,
  onGrade,
  onExit,
  enabled = true,
}: {
  flipped: boolean;
  onFlip: () => void;
  onGrade: (grade: Grade) => void;
  onExit: () => void;
  enabled?: boolean;
}): void {
  const grade = (value: Grade) => () => {
    if (flipped) onGrade(value);
  };
  useHotkeys(
    {
      Space: () => {
        if (!flipped) onFlip();
      },
      '1': grade(1),
      '2': grade(2),
      '3': grade(3),
      '4': grade(4),
      Escape: onExit,
    },
    { enabled },
  );
}
