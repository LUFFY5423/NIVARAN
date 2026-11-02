import { redirect } from "next/navigation";
import { getSession } from "@/server/auth";
import type { Role } from "@/lib/types";

const HOME: Record<Role, string> = { ADMIN: "/admin", TECHNICIAN: "/technician", STUDENT: "/student" };

/** Server-side role guard for area layouts (defense in depth alongside middleware). */
export async function requireRoleOrRedirect(role: Role) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== role) redirect(HOME[session.role]);
  return session;
}
