import "dotenv/config";
import { execSync } from "node:child_process";
import { getPool, closePool } from "./client";

const DROP_SQL = `
DROP TABLE IF EXISTS "AuditLog", "Rating", "Notification", "ActivityLog", "Attachment",
  "Comment", "Assignment", "Complaint", "SLAConfig", "Category", "User", "Department",
  "Room", "Block", "Hostel" CASCADE;
DROP TYPE IF EXISTS role_t, priority_t, complaint_status_t, notification_type_t,
  attachment_kind_t, assignment_status_t CASCADE;
`;

async function main() {
  const pool = getPool();
  await pool.query(DROP_SQL);
  console.log("Dropped existing Nivaran tables and types");
  await closePool();
  execSync("npx tsx src/server/db/migrate.ts", { stdio: "inherit" });
  execSync("npx tsx src/server/db/seed.ts", { stdio: "inherit" });
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
