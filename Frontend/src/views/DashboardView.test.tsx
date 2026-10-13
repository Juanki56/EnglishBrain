import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Effort, Overview, Streak, TodayHabits } from '../components/dashboard/types';
import { fakeSession, resetAuthMock } from '../test/authMock';
import { mockApi, renderApp } from '../test/renderApp';
import { applyTodayActivity } from './DashboardView';

vi.mock('../lib/supabase', async () => (await import('../test/authMock')).supabaseModule);

const TODAY = '2026-10-12';
const days = (counts: number[]): Streak['heatmap'] =>
  counts.map((count, i) => {
    const d = new Date(Date.UTC(2026, 9, 12 - (counts.length - 1 - i)));
    return { date: d.toISOString().slice(0, 10), count };
  });

const OVERVIEW: Overview = {
  vocabulary: { total: 20, learning: 10, reviewing: 5, mastered: 5, pending_curation: 4 },
  critical_errors: 4,
  due_count: 14,
};
const STREAK: Streak = {
  streak: 7, today_active: false, today: TODAY, timezone: 'America/Bogota',
  heatmap: days([...Array(22).fill(0), 1, 2, 3, 4, 5, 6, 7, 0]),
};
const EFFORT: Effort = {
  since: '2026-09-13',
  top: 'vocabulary_reading',
  skills: [
    { skill: 'vocabulary_reading', label: 'Vocabulario / Reading', count: 40, share: 0.667 },
    { skill: 'listening', label: 'Listening', count: 5, share: 0.083 },
    { skill: 'speaking', label: 'Speaking', count: 5, share: 0.083 },
    { skill: 'writing', label: 'Writing', count: 10, share: 0.167 },
  ],
};
const HABITS: TodayHabits = { date: TODAY, timezone: 'America/Bogota', habits: { reading_listening: false, speaking: false, writing: false } };
const word = (id: string, w: string, translation: string) => ({
  id, word: w, translation, context_sentence: null, definition: null, type: 'word', status: 'learning', source: 'manual',
  source_url: null, is_active_srs: true, due_at: null, retention_state: 'learning', created_at: '2026-10-11T10:00:00Z', updated_at: '2026-10-11T10:00:00Z',
});
const RECENT = [word('w5', 'serendipity', 'casualidad afortunada'), word('w4', 'give up', 'rendirse'), word('w3', 'reckon', 'creer')];

beforeEach(() => {
  resetAuthMock(fakeSession('tok-panel'));
  vi.unstubAllGlobals();
});

function dashboardApi(overrides: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    'GET /api/stats/overview': () => ({ json: OVERVIEW }),
    'GET /api/stats/streak': () => ({ json: STREAK }),
    'GET /api/stats/effort': () => ({ json: EFFORT }),
    'GET /api/habits/today': () => ({ json: HABITS }),
    'GET /api/vocabulary': () => ({ json: { items: RECENT, total: RECENT.length } }),
    'PUT /api/habits/today': (body) => ({ json: { ...HABITS, habits: { ...HABITS.habits, ...(body as object) } } }),
    'GET /api/srs/queue': () => ({ json: { items: [], total: 0 } }),
    ...overrides,
  });
}

const card = (name: string) => screen.findByRole('region', { name });

describe('17.1 · Layout a tres columnas', () => {
  it('el Panel muestra a la vez métricas, la cola del día y la barra lateral', async () => {
    dashboardApi();
    renderApp('/');

    expect(await screen.findByRole('heading', { level: 1, name: 'Panel' })).toBeInTheDocument();
    for (const name of ['Racha', 'Vocabulario', 'Errores críticos', 'Esfuerzo en 30 días', 'Hoy', 'Check-in de hoy', 'Añadidas a mano']) {
      expect(await card(name)).toBeInTheDocument();
    }
  });

  it('si un bloque falla, el resto sigue y ese ofrece reintentar', async () => {
    let fail = true;
    dashboardApi({
      'GET /api/stats/effort': () => (fail ? { status: 500, json: { error: { code: 'internal_error', message: 'Error interno del servidor' } } } : { json: EFFORT }),
    });
    renderApp('/');
    const effort = await card('Esfuerzo en 30 días');

    expect(await within(effort).findByRole('alert')).toHaveTextContent('No se pudo cargar');
    expect(await within(await card('Racha')).findByTestId('streak')).toHaveTextContent('7');
    fail = false;
    await userEvent.click(within(effort).getByRole('button', { name: 'Reintentar' }));
    expect(await within(effort).findByText('Vocabulario / Reading', { selector: 'strong' })).toBeInTheDocument();
  });
});

describe('17.2 · Widget superior', () => {
  it('racha y mapa de calor de 30 días con intensidad por actividad', async () => {
    dashboardApi();
    renderApp('/');
    const streak = await card('Racha');

    expect(await within(streak).findByTestId('streak')).toHaveTextContent('7');
    const cells = within(within(streak).getByRole('list', { name: 'Actividad de los últimos 30 días' })).getAllByRole('listitem');
    expect(cells).toHaveLength(30);
    expect(cells[29]).toHaveAccessibleName('12 oct (hoy): 0 actividades');
    expect(cells[28]).toHaveAccessibleName('11 oct: 7 actividades');
    expect(cells[0]!.className).toContain('bg-neutral-100');
    expect(cells[28]!.className).toContain('bg-brand-600');
  });

  it('vocabulario: 20 curados (sin los 4 pendientes) y segmentos de 50 %, 25 % y 25 %', async () => {
    dashboardApi();
    renderApp('/');
    const vocab = await card('Vocabulario');

    expect(await within(vocab).findByTestId('vocabulary-total')).toHaveTextContent('20');
    expect(within(vocab).getByRole('img')).toHaveAccessibleName('Learning 50 %, Reviewing 25 %, Mastered 25 %');
    const widths = ['learning', 'reviewing', 'mastered'].map((s) => (vocab.querySelector(`[data-segment="${s}"]`) as HTMLElement).style.width);
    expect(widths).toEqual(['50%', '25%', '25%']);
    expect(within(vocab).getByRole('link', { name: '4 palabras por curar en el Inbox' })).toHaveAttribute('href', '/inbox');
  });

  it('errores críticos: muestra los no superados', async () => {
    dashboardApi();
    renderApp('/');
    expect(await within(await card('Errores críticos')).findByTestId('critical-errors')).toHaveTextContent('4');
  });

  it('esfuerzo: destaca la habilidad principal y muestra las cuatro proporciones', async () => {
    dashboardApi();
    renderApp('/');
    const effort = await card('Esfuerzo en 30 días');

    expect(await within(effort).findByText('Vocabulario / Reading', { selector: 'strong' })).toBeInTheDocument();
    expect(within(effort).getAllByRole('listitem').map((li) => li.getAttribute('aria-label'))).toEqual([
      'Vocabulario / Reading: 67 %', 'Listening: 8 %', 'Speaking: 8 %', 'Writing: 17 %',
    ]);
  });

  it('sin actividad, el esfuerzo lo explica en vez de mostrar barras vacías', async () => {
    dashboardApi({ 'GET /api/stats/effort': () => ({ json: { ...EFFORT, top: null, skills: EFFORT.skills.map((s) => ({ ...s, count: 0, share: 0 })) } }) });
    renderApp('/');
    expect(await within(await card('Esfuerzo en 30 días')).findByText(/Aún no hay actividad/)).toBeInTheDocument();
  });
});

describe('17.3 · Cola del día', () => {
  it('"Tienes 14 términos vencidos para hoy" y el botón abre la sesión Anki directamente', async () => {
    dashboardApi({
      'GET /api/srs/queue': () => ({
        json: { items: [{ item_type: 'fossilized_error', item_id: 'e1', due_at: TODAY, retention_state: 'learning', front: { incorrect_phrase: 'I have a doubt' }, back: { correct_phrase: 'I have a question' } }], total: 14 },
      }),
    });
    renderApp('/');
    const today = await card('Hoy');

    expect(await within(today).findByText('Tienes 14 términos vencidos para hoy')).toBeInTheDocument();
    await userEvent.click(within(today).getByRole('button', { name: 'Empezar repaso' }));
    expect(await screen.findByRole('article', { name: 'Tarjeta' })).toHaveTextContent('I have a doubt');
  });

  it('sin vencidos, el botón está deshabilitado y felicita', async () => {
    dashboardApi({ 'GET /api/stats/overview': () => ({ json: { ...OVERVIEW, due_count: 0 } }) });
    renderApp('/');
    const today = await card('Hoy');

    expect(await within(today).findByText('Tienes 0 términos vencidos para hoy')).toBeInTheDocument();
    expect(within(today).getByText(/¡Felicidades, estás al día!/)).toBeInTheDocument();
    expect(within(today).getByRole('button', { name: 'Empezar repaso' })).toBeDisabled();
  });
});

describe('17.4 · Barra lateral', () => {
  it('lista los últimos términos añadidos a mano (pide source=manual y limit=5)', async () => {
    const { fetchMock } = dashboardApi();
    renderApp('/');
    const recent = await card('Añadidas a mano');

    const buttons = await within(recent).findAllByRole('button', { name: /^Editar/ });
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['Editar «serendipity»', 'Editar «give up»', 'Editar «reckon»']);
    const url = fetchMock.mock.calls.map(([u]) => new URL(String(u))).find((u) => u.pathname === '/api/vocabulary')!;
    expect(Object.fromEntries(url.searchParams)).toEqual({ source: 'manual', limit: '5' });
  });

  it('un clic abre la edición rápida sin salir del Panel y al guardar la lista se actualiza', async () => {
    const { calls } = dashboardApi({
      'PATCH /api/vocabulary/w4': (body) => ({ json: { ...RECENT[1], ...(body as object) } }),
    });
    renderApp('/');
    await userEvent.click(await within(await card('Añadidas a mano')).findByRole('button', { name: 'Editar «give up»' }));

    const dialog = await screen.findByRole('dialog', { name: 'Editar palabra' });
    const translation = within(dialog).getByLabelText(/Traducción al español/);
    await userEvent.clear(translation);
    await userEvent.type(translation, 'darse por vencido');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(await card('Añadidas a mano')).getByText('darse por vencido')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Panel' })).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PATCH')?.body).toMatchObject({ translation: 'darse por vencido' });
  });

  it('sin palabras manuales, invita a crear una', async () => {
    dashboardApi({ 'GET /api/vocabulary': () => ({ json: { items: [], total: 0 } }) });
    renderApp('/');
    expect(await within(await card('Añadidas a mano')).findByText(/Aún no has añadido palabras a mano/)).toBeInTheDocument();
  });

  it('marcar un check-in lo guarda y enciende la celda de hoy sin recargar', async () => {
    const { calls } = dashboardApi();
    renderApp('/');
    const checkin = await card('Check-in de hoy');
    const speaking = await within(checkin).findByRole('checkbox', { name: 'Hoy practiqué conversación (Speaking)' });
    expect(within(checkin).getAllByRole('checkbox')).toHaveLength(3);

    await userEvent.click(speaking);

    expect(speaking).toBeChecked();
    const streak = await card('Racha');
    expect(within(streak).getByRole('listitem', { name: '12 oct (hoy): 1 actividad' })).toBeInTheDocument();
    expect(within(streak).getByTestId('streak')).toHaveTextContent('8');
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ speaking: true }));
  });

  it('desmarcar lo quita; si el Backend falla, la casilla vuelve y avisa', async () => {
    let fail = false;
    const { calls } = dashboardApi({
      'GET /api/habits/today': () => ({ json: { ...HABITS, habits: { ...HABITS.habits, writing: true } } }),
      'GET /api/stats/streak': () => ({ json: { ...STREAK, streak: 8, today_active: true, heatmap: STREAK.heatmap.map((d) => (d.date === TODAY ? { ...d, count: 1 } : d)) } }),
      'PUT /api/habits/today': (body) =>
        fail ? { status: 500, json: { error: { code: 'internal_error', message: 'Error interno del servidor' } } } : { json: { ...HABITS, habits: { ...HABITS.habits, ...(body as object) } } },
    });
    renderApp('/');
    const writing = await within(await card('Check-in de hoy')).findByRole('checkbox', { name: 'Hoy redacté algo (Writing)' });
    expect(writing).toBeChecked();

    await userEvent.click(writing);
    expect(writing).not.toBeChecked();
    expect(within(await card('Racha')).getByTestId('streak')).toHaveTextContent('7');
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ writing: false }));

    fail = true;
    await userEvent.click(writing);
    expect(await screen.findByText(/No se guardó el check-in/)).toBeInTheDocument();
    expect(writing).not.toBeChecked();
    expect(within(await card('Racha')).getByRole('listitem', { name: '12 oct (hoy): 0 actividades' })).toBeInTheDocument();
  });
});

describe('applyTodayActivity', () => {
  it('encender hoy suma a la racha solo la primera actividad del día', () => {
    const once = applyTodayActivity(STREAK, 1);
    expect(once.streak).toBe(8);
    expect(applyTodayActivity(once, 1).streak).toBe(8);
    expect(applyTodayActivity(once, -1)).toMatchObject({ streak: 7, today_active: false });
  });
});
