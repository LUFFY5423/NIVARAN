import Link from "next/link";
import { ClipboardCheck, Wrench, BarChart3, ShieldCheck, Clock, MessageSquareText } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/primitives";

const features = [
  {
    icon: ClipboardCheck,
    title: "Report in seconds",
    desc: "Students log a hostel issue with category, location, priority, and photo evidence — no more chasing wardens in person.",
  },
  {
    icon: Wrench,
    title: "Clear ownership",
    desc: "Every complaint is assigned to a technician or department with a deadline, so nothing quietly falls through the cracks.",
  },
  {
    icon: Clock,
    title: "SLA accountability",
    desc: "Category and priority-based SLA deadlines, automatic overdue escalation, and a full activity timeline for every ticket.",
  },
  {
    icon: MessageSquareText,
    title: "Verified resolution",
    desc: "Students confirm a fix before it's closed — or reopen it if the problem persists. No complaint disappears silently.",
  },
  {
    icon: BarChart3,
    title: "Real analytics",
    desc: "Admins see resolution rate, overdue tickets, workload by technician, and satisfaction scores at a glance.",
  },
  {
    icon: ShieldCheck,
    title: "Built for accountability",
    desc: "Full audit log, role-based access control, and an anonymized public performance page build campus-wide trust.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />

      <section className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            Prototype build · fictional demo data
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Hostel maintenance, resolved and verified — <span className="text-brand-600">not just filed.</span>
          </h1>
          <p className="mt-5 text-lg text-slate-600">
            Nivaran gives students a real channel to report campus problems, gives staff a clear queue with deadlines,
            and gives administrators the data to prove issues actually get fixed.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/register">
              <Button size="lg">Report an issue as a student</Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Staff / Admin log in
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Demo accounts available on the login page — no signup required to explore.
          </p>
        </div>
      </section>

      <section className="border-t border-slate-100 bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <h2 className="text-center text-2xl font-bold text-slate-900">
            One platform, three roles, one accountable workflow
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title}>
                <CardContent className="pt-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <f.icon size={20} />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-600">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 text-center md:px-8">
          <h2 className="text-2xl font-bold text-slate-900">The complaint lifecycle</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600">
            Every complaint moves through a transparent, auditable sequence of statuses — with students able to reopen
            anything marked resolved that wasn&apos;t actually fixed.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-xs font-medium">
            {[
              "Submitted",
              "Under Review",
              "Assigned",
              "Accepted",
              "In Progress",
              "Ready for Verification",
              "Resolved",
              "Closed",
            ].map((s, i, arr) => (
              <span key={s} className="flex items-center gap-2">
                <span className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-slate-700">{s}</span>
                {i < arr.length - 1 && <span className="text-slate-300">→</span>}
              </span>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-xs text-slate-400">
        Nivaran is a demonstration prototype. All names, emails, and complaint records shown are fictional.
      </footer>
    </div>
  );
}
