"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/server/auth";
import { markNotificationRead, markAllRead } from "@/server/repo/notifications";

export async function markNotificationReadAction(id: string) {
  const session = await getSession();
  if (!session) return;
  await markNotificationRead(id, session.id);
  revalidatePath("/notifications");
}

export async function markAllNotificationsReadAction() {
  const session = await getSession();
  if (!session) return;
  await markAllRead(session.id);
  revalidatePath("/notifications");
}
