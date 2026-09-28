"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label, FormError } from "@/components/ui/primitives";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await loginAction(formData);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.push(nextPath || "/post-login");
          router.refresh();
        });
      }}
      className="space-y-4"
    >
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="you@nivaran.edu" required autoComplete="email" />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required autoComplete="current-password" />
      </div>
      <FormError>{error}</FormError>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
