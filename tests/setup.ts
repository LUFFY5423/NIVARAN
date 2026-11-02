import fs from "node:fs";
import path from "node:path";
import { beforeAll, beforeEach, afterAll } from "vitest";

// Tests run against a dedicated Postgres database (never the dev DB).
// Override with TEST_DATABASE_URL; default matches the README's local setup.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://nivaran:nivaran@localhost:5432/nivaran_test";
process.env.AUTH_SECRET = "test-secret-test-secret-test-secret";

const TABLES = [
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
];

beforeAll(async () => {
  const { getPool } = await import("@/server/db/client");
  await getPool().query(fs.readFileSync(path.join(process.cwd(), "src/server/db/schema.sql"), "utf-8"));
});

beforeEach(async () => {
  const { getPool } = await import("@/server/db/client");
  await getPool().query(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  const { closePool } = await import("@/server/db/client");
  await closePool();
});
