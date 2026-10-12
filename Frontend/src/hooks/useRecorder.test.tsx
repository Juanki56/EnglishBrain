import { act, renderHook } from '@testing-library/react';
import { installMediaMock, uninstallMediaMock } from '../test/mediaMock';
import { formatSeconds, useRecorder } from './useRecorder';

afterEach(() => {
  uninstallMediaMock();
  vi.useRealTimers();
});

describe('13.1 · useRecorder', () => {
  it('pide el micrófono, graba y al detener entrega el audio con su duración', async () => {
    vi.useFakeTimers();
    const media = installMediaMock();
    const { result } = renderHook(() => useRecorder({ limitSeconds: 300 }));
    expect(result.current.status).toBe('idle');

    await act(() => result.current.start());
    expect(media.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(result.current.status).toBe('recording');

    act(() => vi.advanceTimersByTime(133_000)); // 2:13
    expect(Math.floor(result.current.elapsed)).toBe(133);
    act(() => result.current.stop());

    expect(result.current.status).toBe('stopped');
    expect(result.current.recording?.durationSeconds).toBe(133);
    expect(result.current.recording?.blob.type).toBe('audio/webm');
    expect(media.track.stop).toHaveBeenCalled(); // suelta el micrófono
  });

  it('se detiene sola al llegar al límite elegido', async () => {
    vi.useFakeTimers();
    installMediaMock();
    const { result } = renderHook(() => useRecorder({ limitSeconds: 300 }));
    await act(() => result.current.start());

    act(() => vi.advanceTimersByTime(300_200));
    expect(result.current.status).toBe('stopped');
    expect(result.current.recording?.durationSeconds).toBe(300);
  });

  it('si el navegador deniega el micrófono queda en "denied" sin grabar', async () => {
    const media = installMediaMock({ deny: true });
    const { result } = renderHook(() => useRecorder({ limitSeconds: 180 }));
    await act(() => result.current.start());

    expect(result.current.status).toBe('denied');
    expect(media.recorders).toHaveLength(0);
  });

  it('sin MediaRecorder (navegador antiguo) avisa de que no es compatible', () => {
    const { result } = renderHook(() => useRecorder({ limitSeconds: 180 }));

    expect(result.current.status).toBe('unsupported');
  });

  it('reset olvida la grabación', async () => {
    installMediaMock();
    const { result } = renderHook(() => useRecorder({ limitSeconds: 180 }));
    await act(() => result.current.start());
    act(() => result.current.stop());
    act(() => result.current.reset());

    expect(result.current.status).toBe('idle');
    expect(result.current.recording).toBeNull();
  });

  it('al salir de la pantalla suelta el micrófono aunque esté grabando', async () => {
    const media = installMediaMock();
    const { result, unmount } = renderHook(() => useRecorder({ limitSeconds: 180 }));
    await act(() => result.current.start());
    unmount();

    expect(media.track.stop).toHaveBeenCalled();
  });
});

describe('formatSeconds', () => {
  it('muestra minutos y segundos', () => {
    expect([0, 9, 65, 133, 600].map(formatSeconds)).toEqual(['0:00', '0:09', '1:05', '2:13', '10:00']);
  });
});
