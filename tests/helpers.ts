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

export function setup() {
  const hostel = createHostel("Test Hostel");
  const block = createBlock(hostel.id, "Block T");
  const room = createRoom(block.id, "T101", 1);
  const cat = createCategory("Electrical", "electrical");
  upsertSLAConfig(cat.id, "HIGH", 24);
  upsertSLAConfig(cat.id, "MEDIUM", 72);

  const mk = (name: string, role: string) =>
    createUser({
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

  const adminU = mk("Admin One", "ADMIN");
  const techU = mk("Tech One", "TECHNICIAN");
  const tech2U = mk("Tech Two", "TECHNICIAN");
  const stuU = mk("Student One", "STUDENT");
  const stu2U = mk("Student Two", "STUDENT");

  const newComplaint = (priority: Priority = "HIGH", reporterId = stuU.id) =>
    createComplaint({
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
