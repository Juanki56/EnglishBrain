/** Etiqueta de un registro con is_active_srs = false (spec study-library). */
export function ArchiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200 ring-inset">
      <span aria-hidden>🔴</span> Archivo / Solo Almacenamiento
    </span>
  );
}
