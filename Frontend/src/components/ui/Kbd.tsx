/** Tecla de un atajo, p. ej. <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd>. */
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-current/30 bg-white/15 px-1.5 py-px font-sans text-[0.7rem] font-semibold leading-none">
      {children}
    </kbd>
  );
}
