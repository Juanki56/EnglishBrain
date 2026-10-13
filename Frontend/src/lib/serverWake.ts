/**
 * Peticiones lentas en curso (design D3 de deploy-render-vercel). El Backend
 * gratuito se duerme tras 15 min sin uso y tarda ~50 s en despertar: mientras
 * haya alguna petición lenta, la app muestra «Despertando el servidor…».
 */
type Listener = () => void;

let slowRequests = 0;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((listener) => listener());

export const serverWake = {
  start() {
    slowRequests++;
    notify();
  },
  end() {
    slowRequests = Math.max(0, slowRequests - 1);
    notify();
  },
  /** ¿Hay alguna petición lenta en curso? */
  isWaking: () => slowRequests > 0,
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Solo para pruebas. */
  reset() {
    slowRequests = 0;
    notify();
  },
};
