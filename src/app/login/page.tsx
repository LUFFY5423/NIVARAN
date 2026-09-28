import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/server/auth";
import { PublicHeader } from "@/components/layout/public-header";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent } from "@/components/ui/primitives";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await getSession();
  if (session) redirect(roleHome(session.role));
  const { next } = await searchParams;

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicHeader />
      <div className="mx-auto flex max-w-md flex-col px-4 py-16">
        <h1 className="text-center text-2xl font-bold text-slate-900">Welcome back</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Log in to your Nivaran account</p>

        <Card className="mt-8">
          <CardContent className="pt-5">
            <LoginForm nextPath={next} />
          </CardContent>
        </Card>

        <Card className="mt-4 border-brand-100 bg-brand-50/50">
          <CardContent className="pt-4 text-xs text-slate-600">
            <p className="mb-2 font-semibold text-brand-800">Demo accounts (password: Password123!)</p>
            <ul className="space-y-0.5">
              <li>Admin — admin@nivaran.edu</li>
              <li>Technician — ramesh.tech@nivaran.edu</li>
              <li>Student — aarav.student@nivaran.edu</li>
            </ul>
            <p className="mt-2 text-slate-400">
              See{" "}
              <Link href="/about" className="underline">
                About
              </Link>{" "}
              for the full demo account list.
            </p>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-slate-500">
          New student?{" "}
          <Link href="/register" className="font-medium text-brand-600 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

function roleHome(role: string) {
  if (role === "ADMIN") return "/admin";
  if (role === "TECHNICIAN") return "/technician";
  return "/student";
}
