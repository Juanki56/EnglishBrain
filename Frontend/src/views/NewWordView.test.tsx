import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeSession, resetAuthMock } from '../test/authMock';
import { mockApi, renderApp } from '../test/renderApp';

vi.mock('../lib/supabase', async () => (await import('../test/authMock')).supabaseModule);

beforeEach(() => {
  resetAuthMock(fakeSession('tok-new'));
  vi.unstubAllGlobals();
});

const created = () => mockApi({ 'POST /api/vocabulary': (body) => ({ status: 201, json: { id: 'n1', ...(body as object) } }) });
const field = (name: RegExp) => screen.findByRole('textbox', { name });

describe('11.4 · Nueva palabra', () => {
  it('abre con el foco en Palabra / Frase', async () => {
    created();
    renderApp('/words/new');

    expect(await field(/Palabra \/ Frase/)).toHaveFocus();
  });

  it('sin palabra ni traducción no guarda y señala los campos obligatorios', async () => {
    const { calls } = created();
    renderApp('/words/new');
    await userEvent.click(await screen.findByRole('button', { name: /Guardar y crear otra/ }));

    expect(screen.getByText('La palabra es obligatoria')).toBeInTheDocument();
    expect(screen.getByText('La traducción es obligatoria')).toBeInTheDocument();
    expect(screen.getByText('Elige un tipo')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('sugiere el tipo según la palabra hasta que el usuario elige uno', async () => {
    created();
    renderApp('/words/new');
    await userEvent.type(await field(/Palabra \/ Frase/), 'serendipity');
    expect(screen.getByRole('radio', { name: /^Palabra/ })).toBeChecked();

    await userEvent.type(await field(/Palabra \/ Frase/), ' wins');
    expect(screen.getByRole('radio', { name: /Idiom \/ slang/ })).toBeChecked();

    await userEvent.click(screen.getByRole('radio', { name: /Phrasal verb/ }));
    await userEvent.type(await field(/Palabra \/ Frase/), 'x');
    expect(screen.getByRole('radio', { name: /Phrasal verb/ })).toBeChecked();
  });

  it('"Guardar y crear otra" guarda, limpia todo y vuelve a la palabra', async () => {
    const { calls } = created();
    renderApp('/words/new');
    await userEvent.type(await field(/Palabra \/ Frase/), 'give up');
    await userEvent.click(screen.getByRole('radio', { name: /Phrasal verb/ }));
    await userEvent.type(await field(/^Contexto/), 'Never give up on your dreams.');
    await userEvent.type(await field(/Traducción al español/), 'rendirse');
    await userEvent.click(screen.getByRole('button', { name: /Guardar y crear otra/ }));

    expect(await screen.findByText('«give up» guardada y lista para tus repasos')).toBeInTheDocument();
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/api/vocabulary',
      auth: 'Bearer tok-new',
      body: { word: 'give up', translation: 'rendirse', type: 'phrasal_verb', context_sentence: 'Never give up on your dreams.', definition: null, is_active_srs: true },
    });
    expect(await field(/Palabra \/ Frase/)).toHaveValue('');
    expect(await field(/Traducción al español/)).toHaveValue('');
    expect(await field(/^Contexto/)).toHaveValue('');
    expect(await field(/Palabra \/ Frase/)).toHaveFocus();
    expect(screen.getByText(/Llevas 1 en esta sesión/)).toBeInTheDocument();
  });

  it('Ctrl+Enter también guarda, aunque el foco esté en un campo', async () => {
    const { calls } = created();
    renderApp('/words/new');
    await userEvent.type(await field(/Palabra \/ Frase/), 'awkward');
    await userEvent.type(await field(/Traducción al español/), 'incómodo{Control>}{Enter}{/Control}');

    expect(await screen.findByText('«awkward» guardada y lista para tus repasos')).toBeInTheDocument();
    expect(calls[0]?.body).toMatchObject({ word: 'awkward', type: 'word' });
  });

  it('con el interruptor apagado se guarda como archivo y el interruptor se mantiene para la siguiente', async () => {
    const { calls } = created();
    renderApp('/words/new');
    await userEvent.click(await screen.findByRole('switch'));
    await userEvent.type(await field(/Palabra \/ Frase/), 'awkward');
    await userEvent.type(await field(/Traducción al español/), 'incómodo');
    await userEvent.click(screen.getByRole('button', { name: /Guardar y crear otra/ }));

    expect(await screen.findByText('«awkward» guardada como archivo')).toBeInTheDocument();
    expect(calls[0]?.body).toMatchObject({ is_active_srs: false });
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('un error del Backend se muestra bajo su campo y no borra lo escrito', async () => {
    mockApi({
      'POST /api/vocabulary': () => ({
        status: 400,
        json: { error: { code: 'validation_error', message: 'x', details: [{ field: 'word', message: 'La palabra admite como máximo 200 caracteres' }] } },
      }),
    });
    renderApp('/words/new');
    await userEvent.type(await field(/Palabra \/ Frase/), 'algo largo');
    await userEvent.type(await field(/Traducción al español/), 'x');
    await userEvent.click(screen.getByRole('button', { name: /Guardar y crear otra/ }));

    expect(await screen.findByText('La palabra admite como máximo 200 caracteres')).toBeInTheDocument();
    expect(await field(/Palabra \/ Frase/)).toHaveValue('algo largo');
  });
});
