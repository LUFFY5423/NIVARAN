"use client";

import { useState, useTransition } from "react";
import { toggleTechnicianAvailabilityAction } from "@/server/actions/admin";

export function AvailabilityToggle({ initial }: { initial: boolean }) {
  const [available, setAvailable] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={available}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const next = !available;
          const r = await toggleTechnicianAvailabilityAction(next);
          if (r.ok) setAvailable(next);
        })
      }
      className={`focus-ring relative h-6 w-11 rounded-full transition-colors ${available ? "bg-brand-600" : "bg-slate-300"}`}
    >
      <span className="sr-only">{available ? "Available" : "Unavailable"}</span>
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${available ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}
