import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type HotkeyMap, type HotkeyOptions, normalizeCombo, useHotkeys } from './useHotkeys';

function Harness({ bindings, options }: { bindings: HotkeyMap; options?: HotkeyOptions }) {
  useHotkeys(bindings, options);
  return (
    <>
      <input aria-label="campo" />
      <textarea aria-label="texto" />
      <button type="button">botón</button>
    </>
  );
}

describe('normalizeCombo', () => {
  it('normaliza mayúsculas, Space y el modificador mod', () => {
    expect(normalizeCombo('Ctrl+Enter')).toBe('ctrl+Enter');
    expect(normalizeCombo('space')).toBe('Space');
    expect(normalizeCombo('mod+S', false)).toBe('ctrl+s');
    expect(normalizeCombo('mod+S', true)).toBe('meta+s');
    expect(normalizeCombo('shift+?')).toBe('?');
  });
});

describe('useHotkeys', () => {
  it('ejecuta el atajo de teclas sueltas (Espacio, números, Escape)', async () => {
    const space = vi.fn();
    const three = vi.fn();
    const escape = vi.fn();
    render(<Harness bindings={{ Space: space, '3': three, Escape: escape }} />);

    await userEvent.keyboard(' 3{Escape}');
    expect(space).toHaveBeenCalledOnce();
    expect(three).toHaveBeenCalledOnce();
    expect(escape).toHaveBeenCalledOnce();
  });

  it('ignora los atajos mientras se escribe en un campo', async () => {
    const three = vi.fn();
    render(<Harness bindings={{ '3': three, Space: three }} />);

    await userEvent.type(screen.getByLabelText('campo'), '3 ');
    await userEvent.type(screen.getByLabelText('texto'), '3');
    expect(three).not.toHaveBeenCalled();
    expect(screen.getByLabelText('campo')).toHaveValue('3 ');
  });

  it('permite las combinaciones indicadas también dentro de un campo (Ctrl+Enter)', async () => {
    const save = vi.fn();
    render(<Harness bindings={{ 'ctrl+Enter': save }} options={{ allowInInputs: ['ctrl+Enter'] }} />);

    await userEvent.type(screen.getByLabelText('texto'), 'afrontar{Control>}{Enter}{/Control}');
    expect(save).toHaveBeenCalledOnce();
  });

  it('Enter sin Ctrl no dispara el atajo de Ctrl+Enter', async () => {
    const save = vi.fn();
    render(<Harness bindings={{ 'ctrl+Enter': save }} options={{ allowInInputs: ['ctrl+Enter'] }} />);

    await userEvent.type(screen.getByLabelText('campo'), 'x{Enter}');
    expect(save).not.toHaveBeenCalled();
  });

  it('enabled: false desactiva todos los atajos', async () => {
    const space = vi.fn();
    render(<Harness bindings={{ Space: space }} options={{ enabled: false }} />);

    await userEvent.keyboard(' ');
    expect(space).not.toHaveBeenCalled();
  });

  it('usa siempre la versión más reciente de la función', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Harness bindings={{ Space: first }} />);
    rerender(<Harness bindings={{ Space: second }} />);

    await userEvent.keyboard(' ');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });
});
