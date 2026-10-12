import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase simulado en memoria para las pruebas. Implementa solo la parte del
 * query builder que usa el Backend (select con count, insert, update, delete,
 * eq, is, or con ilike, order, range, single, maybeSingle), algunas reglas
 * CHECK de la base de datos real y auth.getUser con sesiones predefinidas.
 */

type Row = Record<string, unknown>;
interface FakeError {
  code: string;
  message: string;
}
interface Result {
  data: unknown;
  error: FakeError | null;
  count?: number | null;
}

const now = () => new Date().toISOString();

/** Valores por defecto y triggers relevantes de cada tabla (ver 001_schema.sql). */
const DEFAULTS: Record<string, () => Row> = {
  profiles: () => ({ display_name: null, timezone: 'UTC', created_at: now(), updated_at: now() }),
  capture_tokens: () => ({ id: randomUUID(), created_at: now(), last_used_at: null, revoked_at: null }),
  vocabulary: () => ({
    id: randomUUID(),
    context_sentence: null,
    translation: null,
    definition: null,
    status: 'pending_curation',
    source: 'manual',
    source_url: null,
    ...srsDefaults(),
  }),
  fossilized_errors: () => ({
    id: randomUUID(), notes: null, is_resolved: false, resolved_at: null, ...srsDefaults(),
  }),
  writing_logs: () => ({ id: randomUUID(), ...srsDefaults() }),
  writing_versions: () => ({ id: randomUUID(), created_at: now() }),
  speaking_logs: () => ({ id: randomUUID(), size_bytes: null, recording_limit_minutes: null, ...srsDefaults() }),
  review_events: () => ({ id: randomUUID(), interval_before: null, interval_after: null, reviewed_at: now() }),
  habit_checkins: () => ({ id: randomUUID(), created_at: now() }),
  listening_logs: () => ({ id: randomUUID(), start_seconds: null, ...srsDefaults() }),
};

function srsDefaults(): Row {
  return {
    is_active_srs: true, due_at: null, interval_days: 0, ease: 2.5, repetitions: 0, lapses: 0,
    retention_state: 'learning', last_reviewed_at: null, created_at: now(), updated_at: now(),
  };
}

/** Tablas que forman la vista srs_queue y su item_type. */
const QUEUE_SOURCES: Array<[table: string, itemType: string]> = [
  ['vocabulary', 'vocabulary'],
  ['fossilized_errors', 'fossilized_error'],
  ['speaking_logs', 'speaking'],
  ['writing_logs', 'writing'],
  ['listening_logs', 'listening'],
];

const SRS_TABLES = new Set(['vocabulary', 'fossilized_errors', 'speaking_logs', 'writing_logs', 'listening_logs']);

/** Equivalente al trigger srs_defaults. */
function applyTriggers(table: string, row: Row): void {
  if (SRS_TABLES.has(table) && row.is_active_srs && !row.due_at) row.due_at = now();
}

/** Borrados en cascada (ON DELETE CASCADE) entre tablas. */
const CASCADES: Record<string, { table: string; column: string }> = {
  writing_logs: { table: 'writing_versions', column: 'writing_id' },
};

/** Restricciones CHECK de la base real que importan en las pruebas. */
const CHECKS: Record<string, (row: Row) => string | null> = {
  vocabulary: (row) => {
    if (!['word', 'phrasal_verb', 'idiom_slang'].includes(String(row.type))) return 'vocabulary_type_check';
    const curated = row.status !== 'pending_curation';
    if (curated && !(typeof row.translation === 'string' && row.translation.trim())) {
      return 'vocabulary_curated_requires_translation';
    }
    if (curated && row.status !== row.retention_state) return 'vocabulary_status_matches_retention';
    return null;
  },
  speaking_logs: (row) => {
    const duration = Number(row.duration_seconds);
    if (!(duration >= 1 && duration <= 600)) return 'speaking_logs_duration_seconds_check';
    if (row.storage_path !== `${row.user_id}/${row.id}.mp3`) return 'speaking_logs_storage_path_format';
    return null;
  },
};

export class FakeDb {
  tables: Record<string, Row[]> = {};
  /** Archivos de Storage por bucket: ruta → contenido. */
  files: Record<string, Map<string, { bytes: Buffer; contentType?: string }>> = {};
  /** Fuerza fallos de Storage para probar la recuperación. */
  storageFailures: { upload?: boolean; remove?: boolean; signedUrl?: boolean } = {};
  /** Fuerza un fallo genérico al insertar en una tabla. */
  insertFailures = new Set<string>();

  rows(table: string): Row[] {
    if (table === 'srs_queue') return this.queueRows();
    if (table === 'daily_activity') return this.activityRows();
    return (this.tables[table] ??= []);
  }

  /** Equivalente a la vista daily_activity de 003_daily_activity.sql. */
  private activityRows(): Row[] {
    const timezones = new Map(this.rows('profiles').map((p) => [p.id, String(p.timezone ?? 'UTC')]));
    const localDay = (userId: unknown, iso: unknown) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: timezones.get(userId) ?? 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' })
        .format(new Date(String(iso)));
    const events = [
      ...this.rows('vocabulary').filter((r) => timezones.has(r.user_id)).map((r) => ({ user_id: r.user_id, day: localDay(r.user_id, r.created_at), kind: 'vocabulary' })),
      ...this.rows('review_events').filter((r) => timezones.has(r.user_id)).map((r) => ({ user_id: r.user_id, day: localDay(r.user_id, r.reviewed_at), kind: 'review' })),
      ...this.rows('habit_checkins').map((r) => ({ user_id: r.user_id, day: String(r.date), kind: 'checkin' })),
    ];
    const groups = new Map<string, Row>();
    for (const event of events) {
      const key = `${event.user_id}|${event.day}`;
      const group = groups.get(key) ?? { user_id: event.user_id, day: event.day, vocabulary_count: 0, review_count: 0, checkin_count: 0, total: 0 };
      group[`${event.kind}_count`] = Number(group[`${event.kind}_count`]) + 1;
      group.total = Number(group.total) + 1;
      groups.set(key, group);
    }
    return [...groups.values()];
  }

  /** Equivalente a la vista srs_queue de 002_rls_queue_storage.sql. */
  private queueRows(): Row[] {
    const nowIso = now();
    return QUEUE_SOURCES.flatMap(([table, itemType]) =>
      this.rows(table)
        .filter((row) => row.is_active_srs && row.due_at && String(row.due_at) <= nowIso)
        .filter((row) => table !== 'vocabulary' || row.status !== 'pending_curation')
        .map((row) => ({ user_id: row.user_id, item_type: itemType, item_id: row.id, due_at: row.due_at })),
    );
  }

  bucket(name: string) {
    return (this.files[name] ??= new Map());
  }
}

/** Storage simulado: upload, remove y createSignedUrl. */
function fakeStorage(db: FakeDb) {
  const fail = (message: string) => ({ data: null, error: { name: 'StorageApiError', message } });
  return {
    from(bucket: string) {
      const files = db.bucket(bucket);
      return {
        async upload(path: string, body: Buffer, options: { contentType?: string; upsert?: boolean } = {}) {
          if (db.storageFailures.upload) return fail('upload failed');
          if (files.has(path) && !options.upsert) return fail('The resource already exists');
          files.set(path, { bytes: Buffer.from(body), contentType: options.contentType });
          return { data: { path }, error: null };
        },
        async remove(paths: string[]) {
          if (db.storageFailures.remove) return fail('remove failed');
          for (const path of paths) files.delete(path);
          return { data: paths.map((name) => ({ name })), error: null };
        },
        async createSignedUrl(path: string, expiresIn: number) {
          if (db.storageFailures.signedUrl) return fail('signed url failed');
          if (!files.has(path)) return fail('Object not found');
          return { data: { signedUrl: `https://fake.storage/${bucket}/${path}?expires=${expiresIn}` }, error: null };
        },
      };
    },
  };
}

class FakeQuery implements PromiseLike<Result> {
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private filters: Array<(row: Row) => boolean> = [];
  private payload: Row | Row[] = [];
  private columns: string | null = null;
  private returning = false;
  private countRows = false;
  private mode: 'many' | 'single' | 'maybe' = 'many';
  private ordering: { column: string; ascending: boolean } | null = null;
  private window: { from: number; to: number } | null = null;

  constructor(
    private readonly db: FakeDb,
    private readonly table: string,
  ) {}

  select(columns = '*', options: { count?: 'exact' } = {}) {
    this.columns = columns;
    this.countRows = options.count === 'exact';
    if (this.op !== 'select') this.returning = true;
    return this;
  }

  insert(values: Row | Row[]) {
    this.op = 'insert';
    this.payload = Array.isArray(values) ? values : [values];
    return this;
  }

  update(values: Row) {
    this.op = 'update';
    this.payload = values;
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  gte(column: string, value: string) {
    this.filters.push((row) => row[column] != null && String(row[column]) >= value);
    return this;
  }

  limit(count: number) {
    this.window = { from: 0, to: count - 1 };
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  is(column: string, value: null) {
    this.filters.push((row) => (row[column] ?? null) === value);
    return this;
  }

  /** Solo soporta la forma "col.ilike.%texto%,col2.ilike.%texto%". */
  or(expression: string) {
    const conditions = expression.split(',').map((part) => {
      const [column, operator, ...rest] = part.split('.');
      if (operator !== 'ilike') throw new Error(`fakeSupabase: operador no soportado en or(): ${operator}`);
      const needle = rest.join('.').replace(/^%|%$/g, '').toLowerCase();
      return (row: Row) => String(row[column!] ?? '').toLowerCase().includes(needle);
    });
    this.filters.push((row) => conditions.some((condition) => condition(row)));
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.ordering = { column, ascending: options.ascending ?? true };
    return this;
  }

  range(from: number, to: number) {
    this.window = { from, to };
    return this;
  }

  single() {
    this.mode = 'single';
    return this;
  }

  maybeSingle() {
    this.mode = 'maybe';
    return this;
  }

  then<A = Result, B = never>(
    onFulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve()
      .then(() => this.run())
      .then(onFulfilled, onRejected);
  }

  private matches(row: Row): boolean {
    return this.filters.every((filter) => filter(row));
  }

  private project(row: Row): Row {
    if (!this.columns || this.columns.trim() === '*') return { ...row };
    return Object.fromEntries(
      this.columns.split(',').map((c) => c.trim()).map((c) => [c, row[c] ?? null]),
    );
  }

  private violation(row: Row): Result | null {
    const failed = CHECKS[this.table]?.(row);
    return failed ? { data: null, error: { code: '23514', message: `violates check constraint "${failed}"` } } : null;
  }

  private run(): Result {
    const table = this.db.rows(this.table);
    let affected: Row[];

    switch (this.op) {
      case 'insert': {
        if (this.db.insertFailures.has(this.table)) {
          return { data: null, error: { code: 'XX000', message: 'simulated insert failure' } };
        }
        const rows = (this.payload as Row[]).map((values) => {
          const defaults = DEFAULTS[this.table]?.() ?? { id: randomUUID(), created_at: now() };
          const row = { ...defaults, ...values };
          applyTriggers(this.table, row);
          if (this.table === 'writing_versions') {
            // Trigger assign_writing_version_number.
            const numbers = table.filter((r) => r.writing_id === row.writing_id).map((r) => Number(r.version_number));
            row.version_number = Math.max(0, ...numbers) + 1;
          }
          return row;
        });
        for (const row of rows) {
          const failed = this.violation(row);
          if (failed) return failed;
          // UNIQUE (user_id, date, habit) de habit_checkins.
          if (this.table === 'habit_checkins' && table.some((r) => r.user_id === row.user_id && r.date === row.date && r.habit === row.habit)) {
            return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
          }
        }
        table.push(...rows);
        affected = rows;
        break;
      }
      case 'update': {
        affected = table.filter((row) => this.matches(row));
        for (const row of affected) {
          const failed = this.violation({ ...row, ...(this.payload as Row) });
          if (failed) return failed;
        }
        for (const row of affected) {
          Object.assign(row, this.payload);
          applyTriggers(this.table, row);
        }
        break;
      }
      case 'delete': {
        affected = table.filter((row) => this.matches(row));
        this.db.tables[this.table] = table.filter((row) => !this.matches(row));
        const cascade = CASCADES[this.table];
        if (cascade) {
          const ids = new Set(affected.map((row) => row.id));
          this.db.tables[cascade.table] = this.db.rows(cascade.table).filter((row) => !ids.has(row[cascade.column]));
        }
        break;
      }
      default:
        affected = table.filter((row) => this.matches(row));
    }

    if (this.op !== 'select' && !this.returning) return { data: null, error: null };

    let rows = affected.map((row) => this.project(row));
    if (this.ordering) {
      const { column, ascending } = this.ordering;
      rows.sort((a, b) => String(a[column]).localeCompare(String(b[column])) * (ascending ? 1 : -1));
    }
    const count = this.countRows ? rows.length : null;
    if (this.window) rows = rows.slice(this.window.from, this.window.to + 1);

    if (this.mode === 'single') {
      return rows.length === 1
        ? { data: rows[0], error: null }
        : { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } };
    }
    if (this.mode === 'maybe') {
      return rows.length > 1
        ? { data: null, error: { code: 'PGRST116', message: 'multiple rows returned' } }
        : { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null, count };
  }
}

export interface FakeUser {
  id: string;
  email: string;
}

/** Tokens de sesión especiales que simulan fallos de Supabase Auth. */
export const EXPIRED_SESSION = 'expired-session';
export const AUTH_DOWN = 'auth-down';

export function createFakeSupabase(sessions: Record<string, FakeUser> = {}) {
  const db = new FakeDb();
  const client = {
    from: (table: string) => new FakeQuery(db, table),
    storage: fakeStorage(db),
    auth: {
      async getUser(jwt: string) {
        if (jwt === EXPIRED_SESSION) {
          return { data: { user: null }, error: { name: 'AuthApiError', status: 401, message: 'JWT expired' } };
        }
        if (jwt === AUTH_DOWN) {
          return { data: { user: null }, error: { name: 'AuthRetryableFetchError', status: 0, message: 'fetch failed' } };
        }
        const user = sessions[jwt];
        return user
          ? { data: { user }, error: null }
          : { data: { user: null }, error: { name: 'AuthApiError', status: 403, message: 'invalid JWT' } };
      },
    },
  };
  return { db, supabase: client as unknown as SupabaseClient };
}

/** Dos usuarios con sus sesiones, para pruebas de aislamiento. */
export const USER_A: FakeUser = { id: '0a000000-0000-4000-8000-00000000000a', email: 'a@example.com' };
export const USER_B: FakeUser = { id: '0b000000-0000-4000-8000-00000000000b', email: 'b@example.com' };
export const SESSION_A = 'session-a';
export const SESSION_B = 'session-b';

export function createTwoUserSupabase() {
  return createFakeSupabase({ [SESSION_A]: USER_A, [SESSION_B]: USER_B });
}
