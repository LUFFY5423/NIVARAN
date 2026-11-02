import { query, queryOne, execute, genId, nowIso } from "@/server/db/client";
import type { UserRow, Priority } from "@/lib/types";

// ---------- Users ----------

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  return queryOne<UserRow>(`SELECT * FROM "User" WHERE email = $1`, [email]);
}

export async function findUserById(id: string): Promise<UserRow | undefined> {
  return queryOne<UserRow>(`SELECT * FROM "User" WHERE id = $1`, [id]);
}

export async function listUsers(role?: string): Promise<UserRow[]> {
  if (role) return query<UserRow>(`SELECT * FROM "User" WHERE role = $1 ORDER BY name`, [role]);
  return query<UserRow>(`SELECT * FROM "User" ORDER BY role, name`);
}

export async function createUser(input: {
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  phone?: string | null;
  roomId?: string | null;
  departmentId?: string | null;
  specialties?: string | null;
}): Promise<UserRow> {
  const id = genId("usr_");
  const ts = nowIso();
  await execute(
    `INSERT INTO "User"
      (id, name, email, "passwordHash", role, phone, "isActive", "roomId", "departmentId", available, specialties, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, true, $9, $10, $10)`,
    [
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
    ]
  );
  return (await findUserById(id))!;
}

export async function updateUser(
  id: string,
  fields: Partial<Pick<UserRow, "name" | "phone" | "isActive" | "available" | "roomId" | "departmentId">>
): Promise<void> {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
  const values = keys.map((k) => (fields as Record<string, unknown>)[k]);
  await execute(`UPDATE "User" SET ${setClause}, "updatedAt" = $${keys.length + 1} WHERE id = $${keys.length + 2}`, [
    ...values,
    nowIso(),
    id,
  ]);
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

export async function listHostels(): Promise<HostelRow[]> {
  return query<HostelRow>(`SELECT * FROM "Hostel" ORDER BY name`);
}
export async function listBlocks(hostelId?: string): Promise<BlockRow[]> {
  if (hostelId) return query<BlockRow>(`SELECT * FROM "Block" WHERE "hostelId" = $1 ORDER BY name`, [hostelId]);
  return query<BlockRow>(`SELECT * FROM "Block" ORDER BY name`);
}
export async function listRooms(blockId?: string): Promise<RoomRow[]> {
  if (blockId) return query<RoomRow>(`SELECT * FROM "Room" WHERE "blockId" = $1 ORDER BY number`, [blockId]);
  return query<RoomRow>(`SELECT * FROM "Room" ORDER BY number`);
}
export async function createHostel(name: string, address?: string): Promise<HostelRow> {
  const id = genId("hst_");
  await execute(`INSERT INTO "Hostel" (id, name, address, "createdAt") VALUES ($1, $2, $3, $4)`, [
    id,
    name,
    address ?? null,
    nowIso(),
  ]);
  return (await queryOne<HostelRow>(`SELECT * FROM "Hostel" WHERE id = $1`, [id]))!;
}
export async function createBlock(hostelId: string, name: string): Promise<BlockRow> {
  const id = genId("blk_");
  await execute(`INSERT INTO "Block" (id, name, "hostelId") VALUES ($1, $2, $3)`, [id, name, hostelId]);
  return (await queryOne<BlockRow>(`SELECT * FROM "Block" WHERE id = $1`, [id]))!;
}
export async function createRoom(blockId: string, number: string, floor: number): Promise<RoomRow> {
  const id = genId("rm_");
  await execute(`INSERT INTO "Room" (id, number, floor, "blockId") VALUES ($1, $2, $3, $4)`, [
    id,
    number,
    floor,
    blockId,
  ]);
  return (await queryOne<RoomRow>(`SELECT * FROM "Room" WHERE id = $1`, [id]))!;
}

// ---------- Departments ----------

export interface DepartmentRow {
  id: string;
  name: string;
  description: string | null;
}
export async function listDepartments(): Promise<DepartmentRow[]> {
  return query<DepartmentRow>(`SELECT * FROM "Department" ORDER BY name`);
}
export async function createDepartment(name: string, description?: string): Promise<DepartmentRow> {
  const id = genId("dept_");
  await execute(`INSERT INTO "Department" (id, name, description, "createdAt") VALUES ($1, $2, $3, $4)`, [
    id,
    name,
    description ?? null,
    nowIso(),
  ]);
  return (await queryOne<DepartmentRow>(`SELECT * FROM "Department" WHERE id = $1`, [id]))!;
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

export async function listCategories(): Promise<CategoryRow[]> {
  return query<CategoryRow>(`SELECT * FROM "Category" ORDER BY name`);
}
export async function createCategory(name: string, slug: string, description?: string): Promise<CategoryRow> {
  const id = genId("cat_");
  await execute(`INSERT INTO "Category" (id, name, slug, description, "createdAt") VALUES ($1, $2, $3, $4, $5)`, [
    id,
    name,
    slug,
    description ?? null,
    nowIso(),
  ]);
  return (await queryOne<CategoryRow>(`SELECT * FROM "Category" WHERE id = $1`, [id]))!;
}

export async function listSLAConfigs(): Promise<SLAConfigRow[]> {
  return query<SLAConfigRow>(`SELECT * FROM "SLAConfig"`);
}

export async function upsertSLAConfig(categoryId: string, priority: Priority, hoursToSolve: number): Promise<void> {
  const ts = nowIso();
  await execute(
    `INSERT INTO "SLAConfig" (id, "categoryId", priority, "hoursToSolve", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $5)
     ON CONFLICT ("categoryId", priority) DO UPDATE SET "hoursToSolve" = EXCLUDED."hoursToSolve", "updatedAt" = $5`,
    [genId("sla_"), categoryId, priority, hoursToSolve, ts]
  );
}

export async function getSLAHours(categoryId: string, priority: Priority): Promise<number> {
  const row = await queryOne<{ hoursToSolve: number }>(
    `SELECT "hoursToSolve" FROM "SLAConfig" WHERE "categoryId" = $1 AND priority = $2`,
    [categoryId, priority]
  );
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
