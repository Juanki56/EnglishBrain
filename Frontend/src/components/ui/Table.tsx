import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  /** Contenido de la celda; por defecto, `row[key]`. */
  render?: (row: T) => ReactNode;
  className?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Texto cuando no hay filas. */
  emptyMessage?: string;
  /** Hace las filas clicables (y activables con Enter). */
  onRowClick?: (row: T) => void;
  caption?: string;
}

export function Table<T>({ columns, rows, rowKey, emptyMessage = 'No hay nada que mostrar todavía.', onRowClick, caption }: TableProps<T>) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <table className="w-full text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-600">
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={`px-4 py-3 ${column.className ?? ''}`}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-neutral-500">{emptyMessage}</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (event) => event.key === 'Enter' && onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={onRowClick ? 'cursor-pointer hover:bg-brand-50 focus-visible:bg-brand-50 focus-visible:outline-none' : ''}
              >
                {columns.map((column) => (
                  <td key={column.key} className={`px-4 py-3 text-neutral-800 ${column.className ?? ''}`}>
                    {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
