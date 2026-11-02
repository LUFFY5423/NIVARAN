import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { getPool, closePool } from "./client";

async function main() {
  const schemaPath = path.join(process.cwd(), "src/server/db/schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf-8");
  const pool = getPool();
  await pool.query(sql);
  console.log("Database migrated at", process.env.DATABASE_URL?.replace(/:[^:@]*@/, ":****@"));
  await closePool();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
