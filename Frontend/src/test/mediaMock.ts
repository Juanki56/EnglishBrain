import { vi } from 'vitest';

/**
 * Micrófono y MediaRecorder simulados (jsdom no los tiene). Uso:
 *   const media = installMediaMock();           // micrófono permitido
 *   installMediaMock({ deny: true });            // permiso denegado
 */
export class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(readonly stream: MediaStream) {
    FakeMediaRecorder.instances.push(this);
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['grabación simulada'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

export function installMediaMock({ deny = false }: { deny?: boolean } = {}) {
  FakeMediaRecorder.instances = [];
  const track = { stop: vi.fn() };
  const getUserMedia = vi.fn(async () => {
    if (deny) throw new DOMException('Permission denied', 'NotAllowedError');
    return { getTracks: () => [track] } as unknown as MediaStream;
  });
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  return { getUserMedia, track, recorders: FakeMediaRecorder.instances };
}

export function uninstallMediaMock() {
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
}
