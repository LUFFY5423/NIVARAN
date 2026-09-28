"use server";

import { redirect } from "next/navigation";
import { registerSchema, loginSchema } from "@/lib/validation";
import { findUserByEmail, createUser } from "@/server/repo/reference-data";
import { hashPassword, verifyPassword, setSessionCookie, clearSessionCookie } from "@/server/auth";
import { writeAudit } from "@/server/repo/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function registerStudentAction(formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    roomId: formData.get("roomId") || undefined,
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, email, password, roomId, phone } = parsed.data;

  const existing = findUserByEmail(email);
  if (existing) {
    return { ok: false, error: "An account with this email already exists" };
  }

  const passwordHash = await hashPassword(password);
  const user = createUser({
    name,
    email,
    passwordHash,
    role: "STUDENT",
    roomId: roomId || null,
    phone: phone || null,
  });

  writeAudit(user.id, "USER_REGISTERED", "User", user.id);
  await setSessionCookie({ id: user.id, name: user.name, email: user.email, role: "STUDENT" });
  return { ok: true };
}

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { email, password } = parsed.data;

  // Deliberately generic error message - never reveal whether the email exists.
  const genericError = "Incorrect email or password";

  const user = findUserByEmail(email);
  if (!user || !user.isActive) return { ok: false, error: genericError };

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return { ok: false, error: genericError };

  await setSessionCookie({ id: user.id, name: user.name, email: user.email, role: user.role });
  writeAudit(user.id, "USER_LOGIN", "User", user.id);
  return { ok: true };
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
