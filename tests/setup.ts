import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { beforeEach } from "vitest";

// Each test file gets its own throwaway database so tests never touch dev.db
const dbFile = path.join(os.tmpdir(), `nivaran-test-${process.pid}-${Math.random().toString(36).slice(2)}.db`);
process.env.DATABASE_URL = `file:${dbFile}`;
process.env.AUTH_SECRET = "test-secret-test-secret-test-secret";

beforeEach(async () => {
  const { getDb } = await import("@/server/db/client");
  const db = getDb();
  db.exec(fs.readFileSync(path.join(process.cwd(), "src/server/db/schema.sql"), "utf-8"));
  for (const t of [
    "AuditLog",
    "Rating",
    "Notification",
    "ActivityLog",
    "Attachment",
    "Comment",
    "Assignment",
    "Complaint",
    "SLAConfig",
    "Category",
    "User",
    "Department",
    "Room",
    "Block",
    "Hostel",
  ]) {
    db.exec(`DELETE FROM ${t};`);
  }
});
