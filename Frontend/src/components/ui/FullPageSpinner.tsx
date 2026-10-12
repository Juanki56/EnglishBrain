import { LoaderCircle } from 'lucide-react';

export function FullPageSpinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center gap-3 text-neutral-500" role="status">
      <LoaderCircle className="animate-spin text-brand-600" size={22} aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}
