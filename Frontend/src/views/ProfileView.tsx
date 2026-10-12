import { Copy, KeyRound, Plus, UserRound } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import { FormAlert } from '../components/ui/FormAlert';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { Table } from '../components/ui/Table';
import { useApi } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';
import { fieldErrors, generalMessage } from '../lib/api';

interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  timezone: string;
}

interface CaptureToken {
  id: string;
  label: string;
  last4: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

const dateFormat = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' });
const formatDate = (iso: string | null) => (iso ? dateFormat.format(new Date(iso)) : 'Nunca');

/** Zonas horarias IANA disponibles en el navegador (incluye la actual aunque falte). */
function timeZoneOptions(current: string) {
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  const all = zones.includes(current) ? zones : [current, ...zones];
  return all.map((zone) => ({ value: zone, label: zone.replaceAll('_', ' ') }));
}

/** Perfil (spec user-accounts): nombre, zona horaria y tokens de la extensión. */
export function ProfileView() {
  return (
    <div className="flex flex-col gap-10">
      <header className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand-100 text-brand-900">
          <UserRound size={22} aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
      </header>
      <ProfileForm />
      <CaptureTokens />
    </div>
  );
}

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white px-8 py-7">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-neutral-600">{description}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Datos del perfil
// -----------------------------------------------------------------------------

function ProfileForm() {
  const api = useApi();
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [timezone, setTimezone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zones = useMemo(() => timeZoneOptions(timezone || browserZone), [timezone, browserZone]);

  useEffect(() => {
    api.get<Profile>('/api/me')
      .then((data) => {
        setProfile(data);
        setDisplayName(data.display_name ?? '');
        setTimezone(data.timezone);
      })
      .catch((error) => setFormError(generalMessage(error)));
  }, [api]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setFormError('');
    setSaving(true);
    try {
      const updated = await api.patch<Profile>('/api/me', { display_name: displayName.trim() || null, timezone });
      setProfile(updated);
      toast.show('Perfil guardado');
    } catch (error) {
      setErrors(fieldErrors(error));
      if (!Object.keys(fieldErrors(error)).length) setFormError(generalMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Tus datos" description="La zona horaria decide cuándo empieza cada día para tu racha y tus check-ins.">
      {!profile && !formError ? (
        <p className="text-sm text-neutral-500">Cargando tu perfil…</p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="grid grid-cols-2 gap-6">
          {formError && <div className="col-span-2"><FormAlert>{formError}</FormAlert></div>}
          <Input label="Email" value={profile?.email ?? ''} disabled hint="El email de tu cuenta no se puede cambiar aquí." />
          <Input label="Nombre visible" value={displayName} onChange={(e) => setDisplayName(e.target.value)} error={errors.display_name} hint="Opcional, hasta 60 caracteres." />
          <div className="flex flex-col gap-2">
            <Select label="Zona horaria" value={timezone} onChange={(e) => setTimezone(e.target.value)} options={zones} error={errors.timezone} />
            {timezone !== browserZone && (
              <button type="button" onClick={() => setTimezone(browserZone)} className="self-start text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline">
                Usar la de este navegador ({browserZone.replaceAll('_', ' ')})
              </button>
            )}
          </div>
          <div className="col-span-2 flex justify-end">
            <Button type="submit" loading={saving} disabled={!profile}>Guardar cambios</Button>
          </div>
        </form>
      )}
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Tokens de la extensión
// -----------------------------------------------------------------------------

function CaptureTokens() {
  const api = useApi();
  const toast = useToast();
  const [tokens, setTokens] = useState<CaptureToken[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [label, setLabel] = useState('');
  const [labelError, setLabelError] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [toRevoke, setToRevoke] = useState<CaptureToken | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(() => {
    api.get<CaptureToken[]>('/api/me/capture-tokens').then(setTokens).catch((error) => setLoadError(generalMessage(error)));
  }, [api]);

  useEffect(load, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setLabelError(undefined);
    setCreating(true);
    try {
      const created = await api.post<CaptureToken & { token: string }>('/api/me/capture-tokens', { label });
      setNewToken(created.token);
      setLabel('');
      load();
    } catch (error) {
      setLabelError(fieldErrors(error).label ?? generalMessage(error));
    } finally {
      setCreating(false);
    }
  }

  async function revoke() {
    if (!toRevoke) return;
    setRevoking(true);
    try {
      await api.delete(`/api/me/capture-tokens/${toRevoke.id}`);
      toast.show(`Token "${toRevoke.label}" revocado`);
      load();
    } catch (error) {
      toast.show(generalMessage(error), { variant: 'error' });
    } finally {
      setRevoking(false);
      setToRevoke(null);
    }
  }

  async function copy() {
    if (!newToken) return;
    try {
      await navigator.clipboard.writeText(newToken);
      toast.show('Token copiado');
    } catch {
      toast.show('No se pudo copiar; selecciónalo y cópialo a mano', { variant: 'error' });
    }
  }

  return (
    <Card title="Tokens de la extensión de Chrome" description="La extensión usa un token personal para guardar palabras en tu cuenta. Crea uno por navegador y pégalo en las opciones de la extensión.">
      <form onSubmit={create} noValidate className="flex items-end gap-3">
        <div className="w-80">
          <Input label="Nombre del token" placeholder="Chrome del portátil" value={label} onChange={(e) => setLabel(e.target.value)} error={labelError} />
        </div>
        <Button type="submit" loading={creating} icon={<Plus size={16} aria-hidden />} className={labelError ? 'mb-7' : ''}>Generar token</Button>
      </form>

      <div className="mt-6">
        {loadError ? (
          <FormAlert>{loadError}</FormAlert>
        ) : (
          <Table
            caption="Tokens de la extensión"
            rows={tokens ?? []}
            rowKey={(t) => t.id}
            emptyMessage={tokens ? 'Todavía no has creado ningún token.' : 'Cargando…'}
            columns={[
              { key: 'label', header: 'Nombre', render: (t) => <span className="font-medium">{t.label}</span> },
              { key: 'last4', header: 'Token', render: (t) => <code className="text-neutral-600">ebk_…{t.last4}</code> },
              { key: 'created_at', header: 'Creado', render: (t) => formatDate(t.created_at) },
              { key: 'last_used_at', header: 'Último uso', render: (t) => formatDate(t.last_used_at) },
              {
                key: 'status', header: 'Estado', render: (t) =>
                  t.revoked_at ? <span className="text-neutral-500">Revocado</span> : <span className="font-medium text-brand-700">Activo</span>,
              },
              {
                key: 'actions', header: '', className: 'text-right', render: (t) =>
                  !t.revoked_at && <Button size="sm" variant="ghost" onClick={() => setToRevoke(t)}>Revocar</Button>,
              },
            ]}
          />
        )}
      </div>

      <Modal
        open={newToken !== null}
        onClose={() => setNewToken(null)}
        title="Tu token nuevo"
        footer={<Button onClick={() => setNewToken(null)}>Ya lo he copiado</Button>}
      >
        <div className="flex flex-col gap-4">
          <FormAlert>Cópialo ahora: por seguridad <strong>no se volverá a mostrar</strong>. Si lo pierdes, revócalo y genera otro.</FormAlert>
          <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
            <KeyRound size={16} className="shrink-0 text-neutral-500" aria-hidden />
            <code data-testid="new-token" className="flex-1 break-all text-sm">{newToken}</code>
            <Button size="sm" variant="secondary" onClick={copy} icon={<Copy size={14} aria-hidden />}>Copiar</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={toRevoke !== null}
        onClose={() => setToRevoke(null)}
        title="¿Revocar este token?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToRevoke(null)}>Cancelar</Button>
            <Button variant="danger" onClick={revoke} loading={revoking}>Revocar</Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          La extensión que use <strong>{toRevoke?.label}</strong> dejará de poder guardar palabras hasta que le pongas un token nuevo.
        </p>
      </Modal>
    </Card>
  );
}
