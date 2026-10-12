import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../hooks/useToast';
import { fieldErrors, generalMessage } from '../../lib/api';
import type { VocabularyItem, VocabularyType } from '../../lib/vocabulary';
import { Button } from '../ui/Button';
import { FormAlert } from '../ui/FormAlert';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Textarea } from '../ui/Textarea';
import { TypePicker } from '../vocabulary/TypePicker';

/** Edición de una palabra (spec study-library: editar cualquier registro). */
export function EditWordModal({
  item,
  onClose,
  onSaved,
}: {
  item: VocabularyItem;
  onClose: () => void;
  onSaved: (item: VocabularyItem) => void;
}) {
  const api = useApi();
  const toast = useToast();
  const [word, setWord] = useState(item.word);
  const [context, setContext] = useState(item.context_sentence ?? '');
  const [translation, setTranslation] = useState(item.translation ?? '');
  const [definition, setDefinition] = useState(item.definition ?? '');
  const [type, setType] = useState<VocabularyType>(item.type);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (item.status !== 'pending_curation' && !translation.trim()) {
      setErrors({ translation: 'La traducción es obligatoria' });
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const updated = await api.patch<VocabularyItem>(`/api/vocabulary/${item.id}`, {
        word,
        context_sentence: context,
        translation,
        definition,
        type,
      });
      toast.show(`«${updated.word}» actualizada`);
      onSaved(updated);
    } catch (error) {
      const byField = fieldErrors(error);
      setErrors(byField);
      if (!Object.keys(byField).length) setFormError(generalMessage(error));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Editar palabra"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={saving}>Guardar</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {formError && <FormAlert>{formError}</FormAlert>}
        <Input label="Palabra / Frase" required value={word} onChange={(e) => setWord(e.target.value)} error={errors.word} />
        <Input
          label="Traducción al español"
          required={item.status !== 'pending_curation'}
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
          error={errors.translation}
        />
        <Textarea label="Contexto" rows={2} value={context} onChange={(e) => setContext(e.target.value)} error={errors.context_sentence} />
        <Textarea label="Definición" rows={2} value={definition} onChange={(e) => setDefinition(e.target.value)} error={errors.definition} />
        <TypePicker value={type} onChange={setType} error={errors.type} />
      </div>
    </Modal>
  );
}
