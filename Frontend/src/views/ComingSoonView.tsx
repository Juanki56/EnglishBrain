import { Hammer } from 'lucide-react';
import type { Section } from '../navigation';

/** Pantalla provisional de una sección que se construye en un grupo posterior. */
export function ComingSoonView({ section }: { section: Section }) {
  const Icon = section.icon;
  return (
    <section>
      <header className="mb-8 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand-100 text-brand-900">
          <Icon size={22} aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">{section.label}</h1>
      </header>

      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-8 py-12 text-center">
        <Hammer className="mx-auto mb-3 text-neutral-400" size={28} aria-hidden />
        <p className="text-base text-neutral-700">{section.description}</p>
        <p className="mt-2 text-sm text-neutral-500">Esta pantalla se construye en el grupo {section.group} del plan.</p>
      </div>
    </section>
  );
}
