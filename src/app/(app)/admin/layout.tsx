import { requireRoleOrRedirect } from "@/server/guard";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireRoleOrRedirect("ADMIN");
  return <>{children}</>;
}
