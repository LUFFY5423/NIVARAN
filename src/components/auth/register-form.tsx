"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerStudentAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FormError } from "@/components/ui/primitives";

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

export function RegisterForm({ hostels, blocks, rooms }: { hostels: Hostel[]; blocks: Block[]; rooms: Room[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const [hostelId, setHostelId] = useState(hostels[0]?.id ?? "");
  const [blockId, setBlockId] = useState("");

  const filteredBlocks = useMemo(() => blocks.filter((b) => b.hostelId === hostelId), [blocks, hostelId]);
  const filteredRooms = useMemo(() => rooms.filter((r) => r.blockId === blockId), [rooms, blockId]);

  return (
    <form
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await registerStudentAction(formData);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.push("/student");
          router.refresh();
        });
      }}
      className="space-y-4"
    >
      <div>
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" placeholder="Aarav Mehta" required />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="you@nivaran.edu" required />
      </div>
      <div>
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input id="phone" name="phone" placeholder="+91-9800000000" />
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
        </div>
      </div>
      <div>
        <Label htmlFor="roomId">Room</Label>
        <Select id="roomId" name="roomId" defaultValue="" disabled={!blockId}>
          <option value="">Select room (optional)</option>
          {filteredRooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.number} (Floor {r.floor})
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required minLength={8} />
        <p className="mt-1 text-xs text-slate-400">At least 8 characters.</p>
      </div>
      <FormError>{error}</FormError>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
