import { useId } from 'react';

export interface SrsToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Texto del interruptor; por defecto el del spec study-library. */
  label?: string;
  /** Versión compacta sin explicación, para filas de tabla. */
  compact?: boolean;
}

/**
 * Interruptor del Modo Archivo (is_active_srs). Encendido: entra en los
 * repasos diarios. Apagado: se guarda solo como archivo de consulta.
 */
export function SrsToggle({
  checked,
  onChange,
  disabled,
  label = '¿Añadir a la cola de repasos diarios (Anki)?',
  compact = false,
}: SrsToggleProps) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={compact ? undefined : descriptionId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-brand-600' : 'bg-neutral-300',
        ].join(' ')}
      >
        <span
          aria-hidden
          className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5.5' : 'translate-x-0.5'}`}
        />
      </button>
      <div className={compact ? 'sr-only' : ''}>
        <p id={labelId} className="text-sm font-medium text-neutral-800">{label}</p>
        {!compact && (
          <p id={descriptionId} className="text-sm text-neutral-500">
            {checked ? 'Aparecerá en tus repasos diarios.' : 'Se guardará como archivo de consulta, sin repasos.'}
          </p>
        )}
      </div>
    </div>
  );
}
