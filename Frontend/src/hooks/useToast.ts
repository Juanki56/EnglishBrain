import { use } from 'react';
import { type ToastApi, ToastContext } from '../components/ui/Toast';

/** Muestra avisos breves: `const toast = useToast(); toast.show('Guardado')`. */
export function useToast(): ToastApi {
  const api = use(ToastContext);
  if (!api) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return api;
}
