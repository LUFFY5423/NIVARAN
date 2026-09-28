"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCommentAction } from "@/server/actions/complaints";
import { Button } from "@/components/ui/button";
import { Textarea, FormError } from "@/components/ui/primitives";

export function CommentForm({ complaintId, allowInternal }: { complaintId: string; allowInternal: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  return (
    <form
      ref={formRef}
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await addCommentAction(formData);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          formRef.current?.reset();
          router.refresh();
        });
      }}
      className="space-y-2"
    >
      <input type="hidden" name="complaintId" value={complaintId} />
      <Textarea name="body" rows={3} placeholder="Add a comment…" aria-label="Comment" required />
      {allowInternal && (
        <label className="flex items-center gap-2 text-xs text-slate-500">
          <input type="checkbox" name="isInternal" value="true" /> Internal note (hidden from student)
        </label>
      )}
      <FormError>{error}</FormError>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Posting…" : "Post comment"}
      </Button>
    </form>
  );
}
