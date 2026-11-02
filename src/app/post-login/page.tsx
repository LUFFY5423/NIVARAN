import { redirect } from "next/navigation";
import { getSession } from "@/server/auth";

export default async function PostLoginPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "ADMIN") redirect("/admin");
  if (session.role === "TECHNICIAN") redirect("/technician");
  redirect("/student");
}
