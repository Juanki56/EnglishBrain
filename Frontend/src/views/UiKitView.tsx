import { Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ArchiveBadge, Button, Input, Modal, SrsToggle, Table, Textarea } from '../components/ui';
import { useToast } from '../hooks/useToast';

/**
 * Catálogo de componentes base (solo en desarrollo, ruta /dev/ui).
 * Sirve para revisar de un vistazo cómo se ven y comportan.
 */
export function UiKitView() {
  const toast = useToast();
  const [active, setActive] = useState(true);
  const [modal, setModal] = useState(false);

  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-2xl font-semibold tracking-tight">Componentes base</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Botones</h2>
        <div className="flex items-center gap-3">
          <Button icon={<Save size={16} aria-hidden />} onClick={() => toast.show('Palabra guardada')}>Guardar</Button>
          <Button variant="secondary" onClick={() => setModal(true)}>Abrir modal</Button>
          <Button variant="ghost">Cancelar</Button>
          <Button variant="danger" icon={<Trash2 size={16} aria-hidden />} onClick={() => toast.show('No se pudo borrar', { variant: 'error' })}>Borrar</Button>
          <Button loading>Guardando</Button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-6">
        <Input label="Palabra / Frase" required placeholder="bite the bullet" />
        <Input label="Traducción" required error="La traducción es obligatoria" />
        <Textarea label="Contexto" hint="La frase donde la viste" rows={3} />
        <div className="flex flex-col gap-4">
          <SrsToggle checked={active} onChange={setActive} />
          <div><ArchiveBadge /></div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Tabla</h2>
        <Table
          rows={[
            { id: '1', word: 'bite the bullet', type: 'idiom_slang', srs: true },
            { id: '2', word: 'serendipity', type: 'word', srs: false },
          ]}
          rowKey={(r) => r.id}
          columns={[
            { key: 'word', header: 'Palabra' },
            { key: 'type', header: 'Tipo' },
            { key: 'srs', header: 'Repasos', render: (r) => (r.srs ? <SrsToggle checked compact onChange={() => {}} /> : <ArchiveBadge />) },
          ]}
        />
      </section>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Editar palabra"
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={() => setModal(false)}>Guardar</Button></>}
      >
        <Input label="Traducción" defaultValue="afrontar algo difícil" />
      </Modal>
    </div>
  );
}
