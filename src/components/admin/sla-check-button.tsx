"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { runSlaCheckAction } from "@/server/actions/complaints";
import { Button } from "@/components/ui/button";

export function SlaCheckButton() {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex items-center gap-3">
      {msg && (
        <span role="status" className="text-xs text-slate-500">
          {msg}
        </span>
      )}
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await runSlaCheckAction();
            setMsg(r.ok ? `Escalated ${r.escalated ?? 0} overdue · ${r.nearing ?? 0} nearing deadline` : r.error);
            router.refresh();
          })
        }
      >
        <ShieldAlert size={16} /> {pending ? "Checking…" : "Run SLA Check"}
      </Button>
    </div>
  );
}
