import { query, execute, genId, nowIso } from "@/server/db/client";

export interface AuditLogRow {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: string | null;
  createdAt: string;
}

export async function writeAudit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  await execute(
    `INSERT INTO "AuditLog" (id, "actorId", action, "entityType", "entityId", metadata, "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [genId("adt_"), actorId, action, entityType, entityId, metadata ? JSON.stringify(metadata) : null, nowIso()]
  );
}

export async function listAuditLog(limit = 200): Promise<AuditLogRow[]> {
  return query<AuditLogRow>(`SELECT * FROM "AuditLog" ORDER BY "createdAt" DESC LIMIT $1`, [limit]);
}
