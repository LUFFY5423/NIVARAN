import { getDb, genId, nowIso } from "@/server/db/client";
import type { NotificationType } from "@/lib/types";

export interface NotificationRow {
  id: string;
  userId: string;
  complaintId: string | null;
  type: NotificationType;
  message: string;
  isRead: number;
  createdAt: string;
}

/**
 * Notification service abstraction: today this only writes an in-app row.
 * To add email later, add a second sink here (e.g. an email queue) behind
 * the same createNotification() call site so no calling code needs to change.
 */
export function createNotification(
  userId: string,
  complaintId: string | null,
  type: NotificationType,
  message: string
): NotificationRow {
  const db = getDb();
  const id = genId("ntf_");
  db.prepare(
    `INSERT INTO Notification (id, userId, complaintId, type, message, isRead, createdAt)
     VALUES (?, ?, ?, ?, ?, 0, ?)`
  ).run(id, userId, complaintId, type, message, nowIso());
  return db.prepare("SELECT * FROM Notification WHERE id = ?").get(id) as NotificationRow;
}

export function listNotifications(userId: string, unreadOnly = false): NotificationRow[] {
  const db = getDb();
  if (unreadOnly) {
    return db
      .prepare("SELECT * FROM Notification WHERE userId = ? AND isRead = 0 ORDER BY createdAt DESC")
      .all(userId) as NotificationRow[];
  }
  return db
    .prepare("SELECT * FROM Notification WHERE userId = ? ORDER BY createdAt DESC LIMIT 100")
    .all(userId) as NotificationRow[];
}

export function unreadCount(userId: string): number {
  const row = getDb().prepare("SELECT COUNT(*) as c FROM Notification WHERE userId = ? AND isRead = 0").get(userId) as {
    c: number;
  };
  return row.c;
}

export function markNotificationRead(id: string, userId: string) {
  getDb().prepare("UPDATE Notification SET isRead = 1 WHERE id = ? AND userId = ?").run(id, userId);
}

export function markAllRead(userId: string) {
  getDb().prepare("UPDATE Notification SET isRead = 1 WHERE userId = ?").run(userId);
}
