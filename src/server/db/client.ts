import path from "node:path";
import fs from "node:fs";

// NOTE ON ARCHITECTURE: the project ships prisma/schema.prisma as the
// intended, portable data model (documented for a future Postgres +
// Prisma migration). In THIS sandboxed prototype environment, Prisma's
// query-engine binary could not be downloaded (its CDN, binaries.prisma.sh,
// is not reachable), so runtime persistence instead uses Node 22's built-in
// `node:sqlite` module with a small hand-written repository layer
// (see src/server/repo/*.ts) that mirrors the same tables/relations.
// See README.md "Known limitations" for details.

/* Loosely-typed facade over node:sqlite so repository code can cast rows to
   its own interfaces (node:sqlite types rows as generic records). */
export interface Stmt {
  run(...params: any[]): unknown;
  get(...params: any[]): any;
  all(...params: any[]): any[];
}
export interface Db {
  exec(sql: string): void;
  prepare(sql: string): Stmt;
}

declare global {
  // eslint-disable-next-line no-var
  var __nivaranDb: Db | undefined;
}

// Loaded through process.getBuiltinModule so bundlers (Next/webpack, Vite) never try to resolve it.
type DatabaseSyncCtor = new (path: string) => { exec(sql: string): void };
const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as unknown as { DatabaseSync: DatabaseSyncCtor };

function resolveDbPath() {
  const url = process.env.DATABASE_URL || "file:./dev.db";
  const file = url.replace(/^file:/, "");
  return path.isAbsolute(file) ? file : path.join(process.cwd(), file);
}

/** node:sqlite returns null-prototype rows, which Next.js refuses to pass to Client Components.
    Copy every row into a plain object. */
function wrap(raw: Db): Db {
  const plain = (r: any) => (r && typeof r === "object" ? { ...r } : r);
  return {
    exec: (sql) => raw.exec(sql),
    prepare(sql) {
      const st = raw.prepare(sql);
      return {
        run: (...p) => st.run(...p),
        get: (...p) => plain(st.get(...p)),
        all: (...p) => st.all(...p).map(plain),
      };
    },
  };
}

export function getDb(): Db {
  if (global.__nivaranDb) return global.__nivaranDb;

  const dbPath = resolveDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA journal_mode = WAL;");
  global.__nivaranDb = wrap(db as unknown as Db);
  return global.__nivaranDb;
}

export function genId(prefix = ""): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `${prefix}${Date.now().toString(36)}${rand()}${rand()}`.slice(0, 30);
}

export function nowIso(): string {
  return new Date().toISOString();
}
