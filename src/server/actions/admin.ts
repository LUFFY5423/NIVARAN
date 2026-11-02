"use server";

import { revalidatePath } from "next/cache";
import { getSession, hashPassword } from "@/server/auth";
import {
  createHostel,
  createBlock,
  createRoom,
  createDepartment,
  createCategory,
  upsertSLAConfig,
  createUser,
  findUserByEmail,
  updateUser,
} from "@/server/repo/reference-data";
import { slaConfigSchema } from "@/lib/validation";
import { writeAudit } from "@/server/repo/audit";
import type { ActionResult } from "@/server/actions/auth";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") throw new Error("FORBIDDEN");
  return session;
}

export async function createHostelAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  if (!name) return { ok: false, error: "Name is required" };
  const hostel = await createHostel(name, String(formData.get("address") || "") || undefined);
  await writeAudit(admin.id, "HOSTEL_CREATED", "Hostel", hostel.id);
  revalidatePath("/admin/locations");
  return { ok: true };
}

export async function createBlockAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const hostelId = String(formData.get("hostelId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!hostelId || !name) return { ok: false, error: "Hostel and block name are required" };
  const block = await createBlock(hostelId, name);
  await writeAudit(admin.id, "BLOCK_CREATED", "Block", block.id);
  revalidatePath("/admin/locations");
  return { ok: true };
}

export async function createRoomAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const blockId = String(formData.get("blockId") || "");
  const number = String(formData.get("number") || "").trim();
  const floor = Number(formData.get("floor") || 0);
  if (!blockId || !number) return { ok: false, error: "Block and room number are required" };
  const room = await createRoom(blockId, number, floor);
  await writeAudit(admin.id, "ROOM_CREATED", "Room", room.id);
  revalidatePath("/admin/locations");
  return { ok: true };
}

export async function createDepartmentAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  if (!name) return { ok: false, error: "Name is required" };
  const dept = await createDepartment(name, String(formData.get("description") || "") || undefined);
  await writeAudit(admin.id, "DEPARTMENT_CREATED", "Department", dept.id);
  revalidatePath("/admin/locations");
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function createCategoryAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  if (!name) return { ok: false, error: "Name is required" };
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const category = await createCategory(name, slug, String(formData.get("description") || "") || undefined);
  await writeAudit(admin.id, "CATEGORY_CREATED", "Category", category.id);
  revalidatePath("/admin/categories");
  return { ok: true };
}

export async function upsertSLAConfigAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = slaConfigSchema.safeParse({
    categoryId: formData.get("categoryId"),
    priority: formData.get("priority"),
    hoursToSolve: formData.get("hoursToSolve"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await upsertSLAConfig(parsed.data.categoryId, parsed.data.priority, parsed.data.hoursToSolve);
  await writeAudit(admin.id, "SLA_CONFIG_UPDATED", "SLAConfig", parsed.data.categoryId, parsed.data);
  revalidatePath("/admin/categories");
  return { ok: true };
}

export async function createStaffUserAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const role = String(formData.get("role") || "");
  const departmentId = String(formData.get("departmentId") || "") || null;
  const password = String(formData.get("password") || "");

  if (!name || !email || !password || password.length < 8) {
    return { ok: false, error: "Name, email and an 8+ character password are required" };
  }
  if (!["ADMIN", "TECHNICIAN"].includes(role)) {
    return { ok: false, error: "Role must be Admin or Technician" };
  }
  if (await findUserByEmail(email)) {
    return { ok: false, error: "A user with this email already exists" };
  }

  const passwordHash = await hashPassword(password);
  const user = await createUser({ name, email, passwordHash, role, departmentId });
  await writeAudit(admin.id, "STAFF_USER_CREATED", "User", user.id, { role });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function toggleUserActiveAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") || "");
  const isActive = formData.get("isActive") === "true";
  await updateUser(userId, { isActive });
  await writeAudit(admin.id, isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED", "User", userId);
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function toggleTechnicianAvailabilityAction(available: boolean): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.role !== "TECHNICIAN") return { ok: false, error: "Not authorized" };
  await updateUser(session.id, { available });
  revalidatePath("/technician");
  return { ok: true };
}
