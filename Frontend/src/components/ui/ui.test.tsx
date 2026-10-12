import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { useToast } from '../../hooks/useToast';
import { ArchiveBadge } from './ArchiveBadge';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';
import { SrsToggle } from './SrsToggle';
import { Table } from './Table';
import { Textarea } from './Textarea';
import { ToastProvider } from './Toast';

describe('SrsToggle', () => {
  function ControlledToggle({ initial = true }: { initial?: boolean }) {
    const [checked, setChecked] = useState(initial);
    return <SrsToggle checked={checked} onChange={setChecked} />;
  }

  it('se muestra como interruptor con el texto del spec y activado', () => {
    render(<ControlledToggle />);
    const toggle = screen.getByRole('switch', { name: '¿Añadir a la cola de repasos diarios (Anki)?' });

    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Aparecerá en tus repasos diarios.')).toBeInTheDocument();
  });

  it('al pulsarlo cambia a archivo y explica qué significa', async () => {
    render(<ControlledToggle />);
    await userEvent.click(screen.getByRole('switch'));

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Se guardará como archivo de consulta, sin repasos.')).toBeInTheDocument();
  });

  it('funciona con el teclado (Espacio)', async () => {
    render(<ControlledToggle initial={false} />);
    screen.getByRole('switch').focus();
    await userEvent.keyboard(' ');

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('la versión compacta conserva el nombre accesible', () => {
    render(<SrsToggle checked onChange={() => {}} compact />);

    expect(screen.getByRole('switch', { name: '¿Añadir a la cola de repasos diarios (Anki)?' })).toBeInTheDocument();
    expect(screen.queryByText('Aparecerá en tus repasos diarios.')).not.toBeInTheDocument();
  });
});

describe('ArchiveBadge', () => {
  it('muestra "🔴 Archivo / Solo Almacenamiento"', () => {
    render(<ArchiveBadge />);

    expect(screen.getByText(/Archivo \/ Solo Almacenamiento/)).toHaveTextContent('🔴 Archivo / Solo Almacenamiento');
  });
});

describe('Button', () => {
  it('ejecuta onClick y es type="button" por defecto', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Guardar</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('en carga se desactiva y no responde', async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Guardar</Button>);
    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Input y Textarea', () => {
  it('la etiqueta identifica el campo y marca los obligatorios', () => {
    render(<Input label="Palabra / Frase" required />);
    const input = screen.getByRole('textbox', { name: /Palabra \/ Frase/ });

    expect(input).toBeRequired();
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByText('(obligatorio)')).toHaveClass('sr-only');
  });

  it('muestra el error bajo el campo y lo conecta para lectores de pantalla', () => {
    render(<Input label="Traducción" error="La traducción es obligatoria" hint="En español" />);
    const input = screen.getByRole('textbox', { name: 'Traducción' });

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('La traducción es obligatoria');
    expect(screen.queryByText('En español')).not.toBeInTheDocument();
  });

  it('sin error muestra la ayuda', () => {
    render(<Textarea label="Contexto" hint="La frase donde la viste" />);

    expect(screen.getByRole('textbox', { name: 'Contexto' })).toHaveAccessibleDescription('La frase donde la viste');
  });
});

describe('Table', () => {
  const rows = [{ id: '1', word: 'bite the bullet', translation: 'afrontar' }];
  const columns = [
    { key: 'word', header: 'Palabra' },
    { key: 'translation', header: 'Traducción', render: (r: (typeof rows)[number]) => <strong>{r.translation}</strong> },
  ];

  it('pinta cabeceras y filas', () => {
    render(<Table columns={columns} rows={rows} rowKey={(r) => r.id} />);

    expect(screen.getByRole('columnheader', { name: 'Palabra' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'bite the bullet' })).toBeInTheDocument();
    expect(screen.getByText('afrontar').tagName).toBe('STRONG');
  });

  it('sin filas muestra el mensaje vacío', () => {
    render(<Table columns={columns} rows={[]} rowKey={(r) => r.id} emptyMessage="Tu Inbox está vacío" />);

    expect(screen.getByText('Tu Inbox está vacío')).toBeInTheDocument();
  });

  it('las filas clicables también se activan con Enter', async () => {
    const onRowClick = vi.fn();
    render(<Table columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={onRowClick} />);
    screen.getByRole('cell', { name: 'bite the bullet' }).closest('tr')!.focus();
    await userEvent.keyboard('{Enter}');

    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });
});

describe('Modal', () => {
  function Demo() {
    const [open, setOpen] = useState(true);
    return (
      <Modal open={open} onClose={() => setOpen(false)} title="Editar palabra">
        <Input label="Traducción" />
      </Modal>
    );
  }

  it('se abre como diálogo con título y pone el foco en el primer campo', () => {
    render(<Demo />);

    expect(screen.getByRole('dialog', { name: 'Editar palabra' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Traducción' })).toHaveFocus();
  });

  it('se cierra con Esc', async () => {
    render(<Demo />);
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('se cierra con el botón Cerrar', async () => {
    render(<Demo />);
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Toast', () => {
  function Trigger() {
    const toast = useToast();
    return (
      <>
        <button type="button" onClick={() => toast.show('Palabra guardada')}>ok</button>
        <button type="button" onClick={() => toast.show('No se pudo guardar', { variant: 'error' })}>fallo</button>
      </>
    );
  }

  it('muestra avisos de éxito (status) y de error (alert)', async () => {
    render(<ToastProvider><Trigger /></ToastProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'ok' }));
    await userEvent.click(screen.getByRole('button', { name: 'fallo' }));

    expect(screen.getByRole('status')).toHaveTextContent('Palabra guardada');
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar');
  });

  it('desaparece solo a los 4 segundos', () => {
    vi.useFakeTimers();
    render(<ToastProvider><Trigger /></ToastProvider>);
    act(() => screen.getByRole('button', { name: 'ok' }).click());
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('useToast fuera del proveedor avisa con un error claro', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Trigger />)).toThrow('useToast debe usarse dentro de <ToastProvider>');
    vi.restoreAllMocks();
  });
});
