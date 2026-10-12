/** Párrafo de contexto con la palabra o frase resaltada (sin distinguir mayúsculas). */
export function HighlightedContext({ text, term }: { text: string; term: string }) {
  const trimmed = term.trim();
  if (!trimmed) return <>{text}</>;

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <mark key={i} className="rounded bg-brand-100 px-0.5 font-medium text-brand-900">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
