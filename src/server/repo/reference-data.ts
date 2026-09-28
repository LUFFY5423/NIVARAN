import { getDb, genId, nowIso } from "@/server/db/client";
import type { UserRow, Priority } from "@/lib/types";

// ---------- Users ----------

export function findUserByEmail(email: string): UserRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM User WHERE email = ? COLLATE NOCASE").get(email) as UserRow | undefined;
}

export function findUserById(id: string): UserRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM User WHERE id = ?").get(id) as UserRow | undefined;
}

export function listUsers(role?: string): UserRow[] {
  const db = getDb();
  if (role) {
    return db.prepare("SELECT * FROM User WHERE role = ? ORDER BY name").all(role) as UserRow[];
  }
  return db.prepare("SELECT * FROM User ORDER BY role, name").all() as UserRow[];
}

export function createUser(input: {
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  phone?: string | null;
  roomId?: string | null;
  departmentId?: string | null;
  specialties?: string | null;
}): UserRow {
  const db = getDb();
  const id = genId("usr_");
  const ts = nowIso();
  db.prepare(
    `INSERT INTO User (id, name, email, passwordHash, role, phone, isActive, roomId, departmentId, available, specialties, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 1, ?, ?, ?)`
  ).run(
    id,
    input.name,
    input.email.toLowerCase(),
    input.passwordHash,
    input.role,
    input.phone ?? null,
    input.roomId ?? null,
    input.departmentId ?? null,
    input.specialties ?? null,
    ts,
    ts
  );
  return findUserById(id)!;
}

export function updateUser(
  id: string,
  fields: Partial<Pick<UserRow, "name" | "phone" | "isActive" | "available" | "roomId" | "departmentId">>
) {
  const db = getDb();
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const setClause = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => (fields as Record<string, unknown>)[k]);
  db.prepare(`UPDATE User SET ${setClause}, updatedAt = ? WHERE id = ?`).run(...values, nowIso(), id);
}

// ---------- Hostels / Blocks / Rooms ----------

export interface HostelRow {
  id: string;
  name: string;
  address: string | null;
  createdAt: string;
}
export interface BlockRow {
  id: string;
  name: string;
  hostelId: string;
}
export interface RoomRow {
  id: string;
  number: string;
  floor: number;
  blockId: string;
}

export function listHostels(): HostelRow[] {
  return getDb().prepare("SELECT * FROM Hostel ORDER BY name").all() as HostelRow[];
}
export function listBlocks(hostelId?: string): BlockRow[] {
  const db = getDb();
  if (hostelId) return db.prepare("SELECT * FROM Block WHERE hostelId = ? ORDER BY name").all(hostelId) as BlockRow[];
  return db.prepare("SELECT * FROM Block ORDER BY name").all() as BlockRow[];
}
export function listRooms(blockId?: string): RoomRow[] {
  const db = getDb();
  if (blockId) return db.prepare("SELECT * FROM Room WHERE blockId = ? ORDER BY number").all(blockId) as RoomRow[];
  return db.prepare("SELECT * FROM Room ORDER BY number").all() as RoomRow[];
}
export function createHostel(name: string, address?: string): HostelRow {
  const db = getDb();
  const id = genId("hst_");
  db.prepare("INSERT INTO Hostel (id, name, address, createdAt) VALUES (?, ?, ?, ?)").run(
    id,
    name,
    address ?? null,
    nowIso()
  );
  return db.prepare("SELECT * FROM Hostel WHERE id = ?").get(id) as HostelRow;
}
export function createBlock(hostelId: string, name: string): BlockRow {
  const db = getDb();
  const id = genId("blk_");
  db.prepare("INSERT INTO Block (id, name, hostelId) VALUES (?, ?, ?)").run(id, name, hostelId);
  return db.prepare("SELECT * FROM Block WHERE id = ?").get(id) as BlockRow;
}
export function createRoom(blockId: string, number: string, floor: number): RoomRow {
  const db = getDb();
  const id = genId("rm_");
  db.prepare("INSERT INTO Room (id, number, floor, blockId) VALUES (?, ?, ?, ?)").run(id, number, floor, blockId);
  return db.prepare("SELECT * FROM Room WHERE id = ?").get(id) as RoomRow;
}

// ---------- Departments ----------

export interface DepartmentRow {
  id: string;
  name: string;
  description: string | null;
}
export function listDepartments(): DepartmentRow[] {
  return getDb().prepare("SELECT * FROM Department ORDER BY name").all() as DepartmentRow[];
}
export function createDepartment(name: string, description?: string): DepartmentRow {
  const db = getDb();
  const id = genId("dept_");
  db.prepare("INSERT INTO Department (id, name, description, createdAt) VALUES (?, ?, ?, ?)").run(
    id,
    name,
    description ?? null,
    nowIso()
  );
  return db.prepare("SELECT * FROM Department WHERE id = ?").get(id) as DepartmentRow;
}

// ---------- Categories & SLA config ----------

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}
export interface SLAConfigRow {
  id: string;
  categoryId: string;
  priority: Priority;
  hoursToSolve: number;
}

export function listCategories(): CategoryRow[] {
  return getDb().prepare("SELECT * FROM Category ORDER BY name").all() as CategoryRow[];
}
export function createCategory(name: string, slug: string, description?: string): CategoryRow {
  const db = getDb();
  const id = genId("cat_");
  db.prepare("INSERT INTO Category (id, name, slug, description, createdAt) VALUES (?, ?, ?, ?, ?)").run(
    id,
    name,
    slug,
    description ?? null,
    nowIso()
  );
  return db.prepare("SELECT * FROM Category WHERE id = ?").get(id) as CategoryRow;
}

export function listSLAConfigs(): SLAConfigRow[] {
  return getDb().prepare("SELECT * FROM SLAConfig").all() as SLAConfigRow[];
}

export function upsertSLAConfig(categoryId: string, priority: Priority, hoursToSolve: number) {
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM SLAConfig WHERE categoryId = ? AND priority = ?")
    .get(categoryId, priority) as SLAConfigRow | undefined;
  const ts = nowIso();
  if (existing) {
    db.prepare("UPDATE SLAConfig SET hoursToSolve = ?, updatedAt = ? WHERE id = ?").run(hoursToSolve, ts, existing.id);
  } else {
    db.prepare(
      "INSERT INTO SLAConfig (id, categoryId, priority, hoursToSolve, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(genId("sla_"), categoryId, priority, hoursToSolve, ts, ts);
  }
}

export function getSLAHours(categoryId: string, priority: Priority): number {
  const db = getDb();
  const row = db
    .prepare("SELECT hoursToSolve FROM SLAConfig WHERE categoryId = ? AND priority = ?")
    .get(categoryId, priority) as { hoursToSolve: number } | undefined;
  if (row) return row.hoursToSolve;
  // sensible fallback defaults if an admin hasn't configured this pair yet
  const fallback: Record<Priority, number> = {
    EMERGENCY: 4,
    HIGH: 24,
    MEDIUM: 72,
    LOW: 168,
  };
  return fallback[priority];
}
