"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FilePlus2,
  ListChecks,
  Bell,
  UserCog,
  Building2,
  Tags,
  BarChart3,
  ScrollText,
  Wrench,
  ClipboardList,
  Settings,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth";
import type { SessionUser } from "@/lib/types";

const navByRole: Record<SessionUser["role"], { href: string; label: string; icon: React.ElementType }[]> = {
  STUDENT: [
    { href: "/student", label: "Dashboard", icon: LayoutDashboard },
    { href: "/student/submit", label: "Submit Complaint", icon: FilePlus2 },
    { href: "/student/complaints", label: "My Complaints", icon: ListChecks },
    { href: "/notifications", label: "Notifications", icon: Bell },
    { href: "/profile", label: "Profile", icon: Settings },
  ],
  ADMIN: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/complaints", label: "All Complaints", icon: ClipboardList },
    { href: "/admin/users", label: "Users", icon: UserCog },
    { href: "/admin/locations", label: "Hostels & Locations", icon: Building2 },
    { href: "/admin/categories", label: "Categories & SLA", icon: Tags },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
    { href: "/notifications", label: "Notifications", icon: Bell },
    { href: "/profile", label: "Profile", icon: Settings },
  ],
  TECHNICIAN: [
    { href: "/technician", label: "Dashboard", icon: LayoutDashboard },
    { href: "/technician/assigned", label: "Assigned Complaints", icon: Wrench },
    { href: "/notifications", label: "Notifications", icon: Bell },
    { href: "/profile", label: "Profile", icon: Settings },
  ],
};

export function AppShell({
  session,
  unreadCount,
  children,
}: {
  session: SessionUser;
  unreadCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const nav = navByRole[session.role];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <ShieldCheck size={18} />
          </div>
          <div>
            <p className="text-sm font-bold leading-none text-slate-900">Nivaran</p>
            <p className="text-[11px] text-slate-400">Housing Resolution Platform</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/notifications" && item.href !== "/profile" && pathname.startsWith(item.href + "/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <item.icon size={17} />
                {item.label}
                {item.label === "Notifications" && unreadCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-100 p-4">
          <p className="truncate text-sm font-medium text-slate-800">{session.name}</p>
          <p className="truncate text-xs text-slate-400">{session.email}</p>
          <form action={logoutAction}>
            <button className="focus-ring mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700">
              <LogOut size={14} /> Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white">
              <ShieldCheck size={15} />
            </div>
            <span className="text-sm font-bold">Nivaran</span>
          </div>
          <Link href="/notifications" className="relative rounded-lg p-2 hover:bg-slate-100">
            <Bell size={18} />
            {unreadCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}
          </Link>
        </header>
        <MobileNav nav={nav} pathname={pathname} />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}

function MobileNav({
  nav,
  pathname,
}: {
  nav: { href: string; label: string; icon: React.ElementType }[];
  pathname: string;
}) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 md:hidden">
      {nav.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
              isActive ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
            )}
          >
            <item.icon size={13} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
