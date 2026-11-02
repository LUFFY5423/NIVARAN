"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitComplaintAction } from "@/server/actions/complaints";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FormError } from "@/components/ui/primitives";
import { PRIORITIES } from "@/lib/types";

interface Category {
  id: string;
  name: string;
}
interface Hostel {
  id: string;
  name: string;
}
interface Block {
  id: string;
  name: string;
  hostelId: string;
}
interface Room {
  id: string;
  number: string;
  floor: number;
  blockId: string;
}

export function SubmitComplaintForm({
  categories,
  hostels,
  blocks,
  rooms,
  defaultRoomId,
}: {
  categories: Category[];
  hostels: Hostel[];
  blocks: Block[];
  rooms: Room[];
  defaultRoomId?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const defaultRoom = rooms.find((r) => r.id === defaultRoomId);
  const defaultBlock = blocks.find((b) => b.id === defaultRoom?.blockId);
  const defaultHostel = hostels.find((h) => h.id === defaultBlock?.hostelId);

  const [hostelId, setHostelId] = useState(defaultHostel?.id ?? hostels[0]?.id ?? "");
  const [blockId, setBlockId] = useState(defaultBlock?.id ?? "");

  const filteredBlocks = useMemo(() => blocks.filter((b) => b.hostelId === hostelId), [blocks, hostelId]);
  const filteredRooms = useMemo(() => rooms.filter((r) => r.blockId === blockId), [rooms, blockId]);

  return (
    <form
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await submitComplaintAction(formData);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.push("/student/complaints");
          router.refresh();
        });
      }}
      className="space-y-4"
    >
      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" placeholder="e.g. Ceiling fan not working in room A101" required />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={4} placeholder="Describe the issue in detail…" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="categoryId">Category</Label>
          <Select id="categoryId" name="categoryId" required defaultValue="">
            <option value="" disabled>
              Select category
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="subcategory">Subcategory (optional)</Label>
          <Input id="subcategory" name="subcategory" placeholder="e.g. Fan / Switch" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Hostel</Label>
          <Select
            value={hostelId}
            onChange={(e) => {
              setHostelId(e.target.value);
              setBlockId("");
            }}
          >
            {hostels.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Block</Label>
          <Select value={blockId} onChange={(e) => setBlockId(e.target.value)}>
            <option value="">Select block</option>
            {filteredBlocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <input type="hidden" name="blockId" value={blockId} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="roomId">Room</Label>
          <Select id="roomId" name="roomId" defaultValue={defaultRoomId ?? ""} disabled={!blockId}>
            <option value="">Select room</option>
            {filteredRooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.number} (Floor {r.floor})
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select id="priority" name="priority" defaultValue="MEDIUM" required>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="evidence">Attach a photo (optional)</Label>
        <Input id="evidence" name="evidence" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
        <p className="mt-1 text-xs text-slate-400">JPEG, PNG, WEBP, or GIF. Max 5MB.</p>
      </div>

      <FormError>{error}</FormError>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Submitting…" : "Submit Complaint"}
      </Button>
    </form>
  );
}
