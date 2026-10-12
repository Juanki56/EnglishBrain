import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { createContext, type ReactNode, useCallback, useMemo, useRef, useState } from 'react';

export type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

export interface ToastApi {
  show: (message: string, options?: { variant?: ToastVariant; durationMs?: number }) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

const STYLES: Record<ToastVariant, { box: string; icon: ReactNode }> = {
  success: { box: 'border-brand-200 bg-brand-50 text-brand-900', icon: <CheckCircle2 size={18} aria-hidden /> },
  error: { box: 'border-red-200 bg-red-50 text-red-800', icon: <XCircle size={18} aria-hidden /> },
  info: { box: 'border-neutral-200 bg-white text-neutral-800', icon: <Info size={18} aria-hidden /> },
};

/** Avisos breves en la esquina inferior derecha. Usar con el hook useToast(). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((toast) => toast.id !== id)), []);

  const show = useCallback<ToastApi['show']>(
    (message, { variant = 'success', durationMs = 4000 } = {}) => {
      const id = nextId.current++;
      setToasts((list) => [...list, { id, message, variant }]);
      setTimeout(() => dismiss(id), durationMs);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext value={api}>
      {children}
      <div className="pointer-events-none fixed right-6 bottom-6 z-50 flex w-96 flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.variant === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${STYLES[toast.variant].box}`}
          >
            <span className="mt-0.5 shrink-0">{STYLES[toast.variant].icon}</span>
            <p className="flex-1">{toast.message}</p>
            <button type="button" onClick={() => dismiss(toast.id)} aria-label="Cerrar aviso" className="shrink-0 opacity-60 hover:opacity-100">
              <X size={16} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  );
}
