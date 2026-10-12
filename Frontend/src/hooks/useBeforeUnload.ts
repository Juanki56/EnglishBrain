import { useEffect } from 'react';

/** Mientras `when` sea true, el navegador pide confirmación antes de cerrar o recargar la pestaña. */
export function useBeforeUnload(when: boolean): void {
  useEffect(() => {
    if (!when) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Requerido por algunos navegadores para mostrar el aviso.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [when]);
}
