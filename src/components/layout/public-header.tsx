import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-20 px-3 pt-3 md:px-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between rounded-full bg-white/90 py-2.5 pl-5 pr-2.5 shadow-soft backdrop-blur">
        <Link href="/" className="focus-ring flex items-center gap-2 rounded-full">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white">
            <ShieldCheck size={18} />
          </span>
          <span className="font-display text-xl font-semibold text-ink">Nivaran</span>
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 text-sm font-semibold text-slate-600 md:flex">
          <Link href="/about" className="rounded-full px-4 py-2 hover:bg-cream">
            About
          </Link>
          <Link href="/public-stats" className="rounded-full px-4 py-2 hover:bg-cream">
            Public stats
          </Link>
        </nav>
        <div className="flex items-center gap-1">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Log in
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
