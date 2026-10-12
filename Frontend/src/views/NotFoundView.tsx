import { Link } from 'react-router';

export function NotFoundView() {
  return (
    <section className="py-20 text-center">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Esta página no existe</h1>
      <Link to="/" className="mt-6 inline-block text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline">
        Volver al panel
      </Link>
    </section>
  );
}
