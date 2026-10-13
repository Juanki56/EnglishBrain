/** Tarjeta de la cola del día tal como la devuelve GET /api/srs/queue. */
export type ItemType = 'vocabulary' | 'fossilized_error' | 'speaking' | 'writing' | 'listening';

export interface QueueCard {
  item_type: ItemType;
  item_id: string;
  due_at: string;
  retention_state: string;
  front: Record<string, unknown>;
  back: Record<string, unknown>;
}

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  vocabulary: 'Vocabulario',
  fossilized_error: 'Error',
  speaking: 'Speaking',
  writing: 'Writing',
  listening: 'Listening',
};

export const GRADES = [
  { grade: 1, label: 'Otra vez', hint: 'La olvidé', bar: 'bg-red-400', className: 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100' },
  { grade: 2, label: 'Difícil', hint: 'Me costó', bar: 'bg-amber-400', className: 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100' },
  { grade: 3, label: 'Bien', hint: 'La recordé', bar: 'bg-brand-600', className: 'border-brand-200 bg-brand-50 text-brand-900 hover:bg-brand-100' },
  { grade: 4, label: 'Fácil', hint: 'Sin esfuerzo', bar: 'bg-sky-400', className: 'border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100' },
] as const;
