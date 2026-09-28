"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/primitives";

/** Generic form wrapper: runs a server action, shows errors/success, refreshes data. */
export function ActionForm({
  action,
  submitLabel,
  children,
  className,
  variant = "primary",
  size = "md",
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  submitLabel: string;
  children?: React.ReactNode;
  className?: string;
  variant?: "primary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md";
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();

  return (
    <form
      ref={ref}
      className={className}
      action={(fd) => {
        setError(null);
        setSaved(false);
        startTransition(async () => {
          const r = await action(fd);
          if (!r.ok) return setError(r.error);
          setSaved(true);
          ref.current?.reset();
          router.refresh();
        });
      }}
    >
      {children}
      <FormError>{error}</FormError>
      {saved && (
        <p role="status" className="mt-2 text-xs font-medium text-emerald-700">
          Saved.
        </p>
      )}
      <Button type="submit" variant={variant} size={size} className="mt-3" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
