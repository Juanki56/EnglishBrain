import { type ReactNode, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Botones de acción al pie. */
  footer?: ReactNode;
}

/** Ventana modal: se cierra con Esc, con la X o haciendo clic fuera. */
export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    // Foco en el primer control del modal para poder usarlo con teclado.
    panelRef.current?.querySelector<HTMLElement>('input, textarea, select, button:not([data-close])')?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previousFocus?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-8" onMouseDown={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            data-close
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
          >
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className="px-6 py-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-neutral-200 px-6 py-4">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
