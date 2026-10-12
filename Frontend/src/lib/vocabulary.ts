/** Vocabulario: tipos y utilidades compartidas por el Inbox, Nueva palabra y la Biblioteca. */
export type VocabularyType = 'word' | 'phrasal_verb' | 'idiom_slang';
export type VocabularyStatus = 'pending_curation' | 'learning' | 'reviewing' | 'mastered';

export interface VocabularyItem {
  id: string;
  word: string;
  context_sentence: string | null;
  translation: string | null;
  definition: string | null;
  type: VocabularyType;
  status: VocabularyStatus;
  source: 'extension' | 'manual';
  source_url: string | null;
  is_active_srs: boolean;
  due_at: string | null;
  retention_state: string;
  created_at: string;
  updated_at: string;
}

export interface Page<T> {
  items: T[];
  total: number;
}

export const TYPE_OPTIONS: Array<{ value: VocabularyType; label: string; example: string }> = [
  { value: 'word', label: 'Palabra', example: 'serendipity' },
  { value: 'phrasal_verb', label: 'Phrasal verb', example: 'give up' },
  { value: 'idiom_slang', label: 'Idiom / slang', example: 'bite the bullet' },
];

export const typeLabel = (type: VocabularyType) => TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;

/** Sugerencia de tipo (igual que el Backend para las capturas): un término es palabra; varios, idiom. */
export const suggestType = (word: string): VocabularyType => (/\s/.test(word.trim()) ? 'idiom_slang' : 'word');

/** Dominio legible de una URL ("www.bbc.com" → "bbc.com"), o null si no es válida. */
export function domainOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
