import Link from "next/link";
import {
  ArrowUpRight,
  ClipboardCheck,
  Wrench,
  BarChart3,
  ShieldCheck,
  Clock,
  MessageSquareText,
  ShieldCheck as Logo,
} from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { Button } from "@/components/ui/button";
import { publicStats } from "@/server/repo/analytics";

export const dynamic = "force-dynamic";

const features = [
  {
    icon: ClipboardCheck,
    title: "Report in seconds",
    desc: "Log an issue with category, location, priority and photo evidence — no more chasing wardens.",
  },
  {
    icon: Wrench,
    title: "Clear ownership",
    desc: "Every complaint gets a technician and a deadline, so nothing quietly falls through the cracks.",
  },
  {
    icon: Clock,
    title: "SLA accountability",
    desc: "Priority-based deadlines, automatic escalation and a full timeline for every ticket.",
  },
  {
    icon: MessageSquareText,
    title: "Verified resolution",
    desc: "Students confirm the fix before it closes — or reopen it if the problem persists.",
  },
  {
    icon: BarChart3,
    title: "Real analytics",
    desc: "Resolution rate, overdue tickets, technician workload and satisfaction at a glance.",
  },
  {
    icon: ShieldCheck,
    title: "Built-in trust",
    desc: "Audit log, role-based access and an anonymized public performance page.",
  },
];

const steps = [
  { n: "01", t: "Report", d: "Student files a complaint with photos." },
  { n: "02", t: "Assign", d: "Admin reviews and routes it to a technician." },
  { n: "03", t: "Fix", d: "Technician works it and uploads after-photos." },
  { n: "04", t: "Verify", d: "Student confirms — or reopens." },
];

export default async function LandingPage() {
  let stats: { label: string; value: string }[] = [];
  try {
    const s = (await publicStats()) as unknown as Record<string, number | undefined>;
    stats = [
      { label: "Issues reported", value: String(s.total ?? 0) },
      { label: "Resolution rate", value: `${s.resolutionRate ?? 0}%` },
      { label: "Avg. satisfaction", value: s.satisfaction ? `${s.satisfaction}/5` : "—" },
    ];
  } catch {
    stats = [];
  }

  return (
    <div className="min-h-screen bg-cream">
      <PublicHeader />

      <section className="mx-auto max-w-6xl px-4 pb-20 pt-16 text-center md:px-8 md:pt-24">
        <span className="inline-flex items-center rounded-full bg-brand-100 px-4 py-1.5 text-xs font-semibold text-brand-800">
          Prototype build · fictional demo data
        </span>
        <h1 className="display-xl mx-auto mt-6 max-w-4xl">
          Hostel maintenance, <span className="text-brand-600">resolved</span> and verified.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          Nivaran gives students a real channel to report campus problems, staff a clear queue with deadlines, and
          administrators the evidence that issues actually get fixed.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link href="/register">
            <Button size="lg">
              Report an issue <ArrowUpRight size={18} />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">
              Staff / admin log in
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-xs text-slate-500">Demo accounts are listed on the login page.</p>
      </section>

      {stats.length > 0 && (
        <section aria-label="Live statistics" className="mx-auto max-w-6xl px-4 pb-20 md:px-8">
          <div className="grid gap-4 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-4xl bg-brand-600 p-8 text-white">
                <p className="font-display text-6xl font-semibold">{s.value}</p>
                <p className="mt-2 text-sm font-medium text-brand-100">{s.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <h2 className="mx-auto max-w-2xl text-center font-display text-4xl font-semibold tracking-tight md:text-5xl">
            One platform, three roles, one accountable workflow
          </h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="group rounded-4xl bg-cream p-7 transition-transform hover:-translate-y-1">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-brand-600">
                  <f.icon size={22} />
                </span>
                <h3 className="mt-5 text-xl font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <h2 className="text-center font-display text-4xl font-semibold tracking-tight md:text-5xl">How it works</h2>
          <ol className="mt-12 grid gap-5 md:grid-cols-4">
            {steps.map((s) => (
              <li key={s.n} className="rounded-4xl bg-white p-7 shadow-soft">
                <span className="font-display text-sm font-semibold text-brand-600">{s.n}</span>
                <h3 className="mt-3 text-2xl font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm text-slate-600">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-3 pb-6 md:px-6">
        <div className="mx-auto max-w-6xl rounded-4xl bg-ink px-6 py-16 text-center text-white md:py-20">
          <h2 className="mx-auto max-w-2xl font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Fix it once. <span className="text-brand-300">Prove it was fixed.</span>
          </h2>
          <Link
            href="/register"
            className="group mt-8 inline-flex items-center gap-3 rounded-full bg-white py-2 pl-6 pr-2 font-semibold text-ink"
          >
            Get started
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white transition-transform group-hover:translate-x-0.5">
              <ArrowUpRight size={18} />
            </span>
          </Link>
        </div>
      </section>

      <footer className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
        <Logo size={14} /> Nivaran is a demonstration prototype. All names, emails and records are fictional.
      </footer>
    </div>
  );
}
