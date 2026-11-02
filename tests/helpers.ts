import {
  createUser,
  createCategory,
  createHostel,
  createBlock,
  createRoom,
  upsertSLAConfig,
} from "@/server/repo/reference-data";
import { createComplaint } from "@/server/repo/complaints";
import type { SessionUser, Priority } from "@/lib/types";

export async function setup() {
  const hostel = await createHostel("Test Hostel");
  const block = await createBlock(hostel.id, "Block T");
  const room = await createRoom(block.id, "T101", 1);
  const cat = await createCategory("Electrical", "electrical");
  await upsertSLAConfig(cat.id, "HIGH", 24);
  await upsertSLAConfig(cat.id, "MEDIUM", 72);

  const mk = async (name: string, role: string) =>
    await createUser({
      name,
      email: `${name.toLowerCase().replace(/\s/g, ".")}@test.dev`,
      passwordHash: "x",
      role,
      roomId: role === "STUDENT" ? room.id : null,
    });
  const s = (u: { id: string; name: string; email: string }, role: SessionUser["role"]): SessionUser => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role,
  });

  const adminU = await mk("Admin One", "ADMIN");
  const techU = await mk("Tech One", "TECHNICIAN");
  const tech2U = await mk("Tech Two", "TECHNICIAN");
  const stuU = await mk("Student One", "STUDENT");
  const stu2U = await mk("Student Two", "STUDENT");

  const newComplaint = async (priority: Priority = "HIGH", reporterId = stuU.id) =>
    await createComplaint({
      title: "Broken fan",
      description: "The fan is broken",
      categoryId: cat.id,
      blockId: block.id,
      roomId: room.id,
      priority,
      reporterId,
    });

  return {
    cat,
    block,
    room,
    newComplaint,
    admin: s(adminU, "ADMIN"),
    tech: s(techU, "TECHNICIAN"),
    tech2: s(tech2U, "TECHNICIAN"),
    student: s(stuU, "STUDENT"),
    student2: s(stu2U, "STUDENT"),
  };
}
