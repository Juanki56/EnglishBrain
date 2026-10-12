import { PlusCircle } from 'lucide-react';
import { type FormEvent, useRef, useState } from 'react';
import { Button } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { Input } from '../components/ui/Input';
import { Kbd } from '../components/ui/Kbd';
import { SrsToggle } from '../components/ui/SrsToggle';
import { Textarea } from '../components/ui/Textarea';
import { TypePicker } from '../components/vocabulary/TypePicker';
import { useApi } from '../hooks/useApi';
import { useHotkeys } from '../hooks/useHotkeys';
import { useToast } from '../hooks/useToast';
import { fieldErrors, generalMessage } from '../lib/api';
import { suggestType, type VocabularyType } from '../lib/vocabulary';

/**
 * Nueva palabra (spec vocabulary-curation): formulario manual para cuando no
 * estás navegando. "Guardar y crear otra" limpia todo y vuelve a la palabra.
 */
export function NewWordView() {
  const api = useApi();
  const toast = useToast();
  const wordRef = useRef<HTMLInputElement>(null);
  const [word, setWord] = useState('');
  const [context, setContext] = useState('');
  const [translation, setTranslation] = useState('');
  const [definition, setDefinition] = useState('');
  // Mientras el usuario no elija un tipo, se sugiere según la palabra.
  const [chosenType, setChosenType] = useState<VocabularyType | null>(null);
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const type: VocabularyType | '' = chosenType ?? (word.trim() ? suggestType(word) : '');

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (saving) return;
    const nextErrors: Record<string, string> = {};
    if (!word.trim()) nextErrors.word = 'La palabra es obligatoria';
    if (!translation.trim()) nextErrors.translation = 'La traducción es obligatoria';
    if (!type) nextErrors.type = 'Elige un tipo';
    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      await api.post('/api/vocabulary', {
        word: word.trim(),
        translation: translation.trim(),
        type,
        context_sentence: context.trim() || null,
        definition: definition.trim() || null,
        is_active_srs: active,
      });
      toast.show(active ? `«${word.trim()}» guardada y lista para tus repasos` : `«${word.trim()}» guardada como archivo`);
      setWord('');
      setContext('');
      setTranslation('');
      setDefinition('');
      setChosenType(null);
      setSavedCount((n) => n + 1);
      wordRef.current?.focus();
    } catch (error) {
      const byField = fieldErrors(error);
      setErrors(byField);
      if (!Object.keys(byField).length) setFormError(generalMessage(error));
    } finally {
      setSaving(false);
    }
  }

  useHotkeys(
    { 'ctrl+Enter': () => void save(), 'meta+Enter': () => void save() },
    { allowInInputs: ['ctrl+Enter', 'meta+Enter'] },
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand-100 text-brand-900">
          <PlusCircle size={22} aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nueva palabra</h1>
          <p className="text-sm text-neutral-600">
            Para lo que oyes en una serie o lees en un libro.{savedCount > 0 && ` Llevas ${savedCount} en esta sesión.`}
          </p>
        </div>
      </header>

      <form onSubmit={save} noValidate className="flex flex-col gap-6 rounded-2xl border border-neutral-200 bg-white px-8 py-8">
        {formError && <FormAlert>{formError}</FormAlert>}
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col gap-6">
            <Input
              ref={wordRef}
              label="Palabra / Frase"
              required
              autoFocus
              value={word}
              onChange={(e) => setWord(e.target.value)}
              error={errors.word}
              placeholder="bite the bullet"
            />
            <Textarea
              label="Contexto"
              rows={4}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              error={errors.context_sentence}
              hint="Opcional. La frase donde la viste o la oíste."
            />
          </div>
          <div className="flex flex-col gap-6">
            <Input
              label="Traducción al español"
              required
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              error={errors.translation}
            />
            <Textarea
              label="Definición en inglés"
              rows={4}
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              error={errors.definition}
              hint="Opcional."
            />
          </div>
        </div>

        <TypePicker value={type} onChange={setChosenType} error={errors.type} />
        <SrsToggle checked={active} onChange={setActive} />

        <div className="flex justify-end border-t border-neutral-100 pt-5">
          <Button type="submit" loading={saving} aria-keyshortcuts="Control+Enter">
            Guardar y crear otra
            <span className="ml-1 flex items-center gap-0.5 opacity-90" aria-hidden><Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd></span>
          </Button>
        </div>
      </form>
    </div>
  );
}
