import { Pool, types, type QueryResultRow } from "pg";

// node-postgres returns TIMESTAMPTZ/TIMESTAMP columns as JS Date objects by default.
// The rest of this codebase treats every timestamp as an ISO-8601 string (for
// formatDate/new Date(...)/JSON serialization in server actions), so we normalize
// at the driver level, once, rather than touching every call site.
const TIMESTAMPTZ_OID = 1184;
const TIMESTAMP_OID = 1114;
for (const oid of [TIMESTAMPTZ_OID, TIMESTAMP_OID]) {
  const defaultParser = types.getTypeParser(oid as never, "text") as (val: string) => unknown;
  types.setTypeParser(oid as never, (val: string) => {
    const parsed = defaultParser(val);
    return parsed instanceof Date ? parsed.toISOString() : val;
  });
}

// A single pooled connection shared across the process (Next.js dev/server reuses
// modules, so we stash the pool on `global` to survive hot-reload in dev).
declare global {
  // eslint-disable-next-line no-var
  var __nivaranPool: Pool | undefined;
}

function resolveConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and point it at your PostgreSQL instance.");
  }
  return url;
}

export function getPool(): Pool {
  if (global.__nivaranPool) return global.__nivaranPool;
  const pool = new Pool({
    connectionString: resolveConnectionString(),
    // Serverless hosts spin up many instances; keep each to one connection (use Neon's pooled URL).
    max: process.env.VERCEL ? 1 : 10,
  });
  global.__nivaranPool = pool;
  return pool;
}

/** Runs a parameterized query and returns all rows. Use $1, $2, ... placeholders. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await getPool().query<T>(text, params);
  return res.rows;
}

/** Runs a parameterized query and returns the first row, or undefined. */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}

/** Runs a parameterized statement and returns the number of rows affected. */
export async function execute(text: string, params: unknown[] = []): Promise<number> {
  const res = await getPool().query(text, params);
  return res.rowCount ?? 0;
}

/** Runs `fn` inside a single client/transaction (BEGIN/COMMIT, ROLLBACK on throw). */
export async function withTransaction<T>(fn: (tx: typeof query) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const txQuery = async <R extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) => {
      const res = await client.query<R>(text, params);
      return res.rows;
    };
    const result = await fn(txQuery as typeof query);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export function genId(prefix = ""): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `${prefix}${Date.now().toString(36)}${rand()}${rand()}`.slice(0, 30);
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Closes the pool. Used by scripts/tests that need to exit cleanly. */
export async function closePool(): Promise<void> {
  if (global.__nivaranPool) {
    await global.__nivaranPool.end();
    global.__nivaranPool = undefined;
  }
}
