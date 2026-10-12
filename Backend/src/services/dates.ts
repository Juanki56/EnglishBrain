/**
 * Fechas de calendario ("YYYY-MM-DD") en la zona horaria del usuario.
 * La racha y el check-in se cuentan por día LOCAL, nunca por la hora del servidor.
 */

/** Fecha local de `instant` en la zona IANA `timeZone`. */
export function localDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}

/** Suma (o resta) días a una fecha "YYYY-MM-DD". */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
