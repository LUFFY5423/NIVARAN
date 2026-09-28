import { getDb, genId, nowIso } from "@/server/db/client";

export interface AuditLogRow {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: string | null;
  createdAt: string;
}

export function writeAudit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata?: Record<string, unknown>
) {
  const db = getDb();
  db.prepare(
    `INSERT INTO AuditLog (id, actorId, action, entityType, entityId, metadata, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(genId("adt_"), actorId, action, entityType, entityId, metadata ? JSON.stringify(metadata) : null, nowIso());
}

export function listAuditLog(limit = 200): AuditLogRow[] {
  return getDb().prepare("SELECT * FROM AuditLog ORDER BY createdAt DESC LIMIT ?").all(limit) as AuditLogRow[];
}
