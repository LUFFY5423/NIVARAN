import { redirect } from "next/navigation";
import { getSession } from "@/server/auth";
import { unreadCount } from "@/server/repo/notifications";
import { AppShell } from "@/components/layout/app-shell";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const unread = unreadCount(session.id);

  return (
    <AppShell session={session} unreadCount={unread}>
      {children}
    </AppShell>
  );
}
