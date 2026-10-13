import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { type Grade, useAnkiKeyboard } from './useAnkiKeyboard';

function Harness({ onGrade, onExit }: { onGrade: (g: Grade) => void; onExit: () => void }) {
  const [flipped, setFlipped] = useState(false);
  useAnkiKeyboard({ flipped, onFlip: () => setFlipped(true), onGrade: (g) => { onGrade(g); setFlipped(false); }, onExit });
  return <p data-testid="state">{flipped ? 'reverso' : 'anverso'}</p>;
}

describe('16.1 · useAnkiKeyboard', () => {
  it('Espacio voltea la tarjeta y luego 3 la califica', async () => {
    const onGrade = vi.fn();
    const { getByTestId } = render(<Harness onGrade={onGrade} onExit={vi.fn()} />);

    await userEvent.keyboard(' ');
    expect(getByTestId('state')).toHaveTextContent('reverso');
    await userEvent.keyboard('3');
    expect(onGrade).toHaveBeenCalledWith(3);
    expect(getByTestId('state')).toHaveTextContent('anverso');
  });

  it('calificar sin voltear no hace nada', async () => {
    const onGrade = vi.fn();
    const { getByTestId } = render(<Harness onGrade={onGrade} onExit={vi.fn()} />);

    await userEvent.keyboard('1234');
    expect(onGrade).not.toHaveBeenCalled();
    expect(getByTestId('state')).toHaveTextContent('anverso');
  });

  it('Espacio con la tarjeta ya volteada no la vuelve a voltear', async () => {
    const onGrade = vi.fn();
    const { getByTestId } = render(<Harness onGrade={onGrade} onExit={vi.fn()} />);

    await userEvent.keyboard('  ');
    expect(getByTestId('state')).toHaveTextContent('reverso');
  });

  it('acepta las cuatro calificaciones', async () => {
    const onGrade = vi.fn();
    render(<Harness onGrade={onGrade} onExit={vi.fn()} />);

    await userEvent.keyboard(' 1 2 3 4');
    expect(onGrade.mock.calls.map((c) => c[0])).toEqual([1, 2, 3, 4]);
  });

  it('Esc sale de la sesión', async () => {
    const onExit = vi.fn();
    render(<Harness onGrade={vi.fn()} onExit={onExit} />);

    await userEvent.keyboard('{Escape}');
    expect(onExit).toHaveBeenCalledOnce();
  });
});
