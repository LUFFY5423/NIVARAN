import Link from "next/link";
import { getSession } from "@/server/auth";
import { listNotifications } from "@/server/repo/notifications";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/server/actions/notifications";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState } from "@/components/ui/primitives";
import { timeAgo } from "@/lib/utils";

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) return null;
  const items = listNotifications(session.id);
  const hasUnread = items.some((n) => !n.isRead);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        description="Updates on your complaints and assignments."
        action={
          hasUnread ? (
            <form action={markAllNotificationsReadAction}>
              <Button variant="outline" size="sm" type="submit">
                Mark all as read
              </Button>
            </form>
          ) : undefined
        }
      />
      {items.length === 0 ? (
        <EmptyState title="You're all caught up" description="New notifications will appear here." />
      ) : (
        <Card>
          <CardContent className="divide-y divide-slate-100 py-0">
            {items.map((n) => (
              <div key={n.id} className="flex items-start justify-between gap-3 py-3">
                <div className="flex gap-3">
                  <span
                    aria-label={n.isRead ? "Read" : "Unread"}
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? "bg-slate-200" : "bg-brand-500"}`}
                  />
                  <div>
                    <p className={`text-sm ${n.isRead ? "text-slate-500" : "font-medium text-slate-800"}`}>
                      {n.complaintId ? (
                        <Link href={`/complaints/${n.complaintId}`} className="hover:underline">
                          {n.message}
                        </Link>
                      ) : (
                        n.message
                      )}
                    </p>
                    <p className="text-xs text-slate-400">{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
                {!n.isRead && (
                  <form action={markNotificationReadAction.bind(null, n.id)}>
                    <button className="focus-ring rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">
                      Mark read
                    </button>
                  </form>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
