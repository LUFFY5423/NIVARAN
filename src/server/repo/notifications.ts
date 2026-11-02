import { query, queryOne, execute, genId, nowIso } from "@/server/db/client";
import type { NotificationType } from "@/lib/types";

export interface NotificationRow {
  id: string;
  userId: string;
  complaintId: string | null;
  type: NotificationType;
  message: string;
  isRead: boolean;
  createdAt: string;
}

/**
 * Notification service abstraction: today this only writes an in-app row.
 * To add email later, add a second sink here (e.g. an email queue) behind
 * the same createNotification() call site so no calling code needs to change.
 */
export async function createNotification(
  userId: string,
  complaintId: string | null,
  type: NotificationType,
  message: string
): Promise<NotificationRow> {
  const id = genId("ntf_");
  await execute(
    `INSERT INTO "Notification" (id, "userId", "complaintId", type, message, "isRead", "createdAt")
     VALUES ($1, $2, $3, $4, $5, false, $6)`,
    [id, userId, complaintId, type, message, nowIso()]
  );
  return (await queryOne<NotificationRow>(`SELECT * FROM "Notification" WHERE id = $1`, [id]))!;
}

export async function listNotifications(userId: string, unreadOnly = false): Promise<NotificationRow[]> {
  if (unreadOnly) {
    return query<NotificationRow>(
      `SELECT * FROM "Notification" WHERE "userId" = $1 AND "isRead" = false ORDER BY "createdAt" DESC`,
      [userId]
    );
  }
  return query<NotificationRow>(
    `SELECT * FROM "Notification" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 100`,
    [userId]
  );
}

export async function unreadCount(userId: string): Promise<number> {
  const row = await queryOne<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM "Notification" WHERE "userId" = $1 AND "isRead" = false`,
    [userId]
  );
  return Number(row?.c ?? 0);
}

export async function markNotificationRead(id: string, userId: string): Promise<void> {
  await execute(`UPDATE "Notification" SET "isRead" = true WHERE id = $1 AND "userId" = $2`, [id, userId]);
}

export async function markAllRead(userId: string): Promise<void> {
  await execute(`UPDATE "Notification" SET "isRead" = true WHERE "userId" = $1`, [userId]);
}
