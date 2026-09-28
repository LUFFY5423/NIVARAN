import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "./client";

function main() {
  const db = getDb();
  const schemaPath = path.join(process.cwd(), "src/server/db/schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf-8");
  db.exec(sql);
  console.log("✅ Database migrated at", process.env.DATABASE_URL);
}

main();
