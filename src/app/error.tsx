"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream px-6 text-center">
      <h1 className="font-display text-4xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-slate-600">
        The server hit an error. If you are running Nivaran locally, check that PostgreSQL is running, that
        <code className="mx-1 rounded bg-white px-1.5 py-0.5">DATABASE_URL</code>
        in <code className="rounded bg-white px-1.5 py-0.5">.env</code> is correct, and that you ran
        <code className="mx-1 rounded bg-white px-1.5 py-0.5">npm run setup</code>.
      </p>
      {error.digest && <p className="text-xs text-slate-400">Reference: {error.digest}</p>}
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
