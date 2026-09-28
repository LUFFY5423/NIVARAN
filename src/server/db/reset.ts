import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function main() {
  const url = process.env.DATABASE_URL || "file:./dev.db";
  const file = url.replace(/^file:/, "");
  const dbPath = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  for (const suffix of ["", "-wal", "-shm"]) {
    const p = dbPath + suffix;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  console.log("🗑️  Removed existing database file(s)");
  execSync("npx tsx src/server/db/migrate.ts", { stdio: "inherit" });
  execSync("npx tsx src/server/db/seed.ts", { stdio: "inherit" });
}

main();
