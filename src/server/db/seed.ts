import "dotenv/config";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { getDb, genId, nowIso } from "./client";
import {
  createHostel,
  createBlock,
  createRoom,
  createDepartment,
  createCategory,
  createUser,
  upsertSLAConfig,
} from "@/server/repo/reference-data";
import {
  createComplaint,
  transitionComplaint,
  addComment,
  addAttachment,
  addRating,
  recordAssignment,
} from "@/server/repo/complaints";
import { createNotification } from "@/server/repo/notifications";
import type { SessionUser, Priority, ComplaintStatus } from "@/lib/types";

// tsx runs this outside of the Next.js "server-only" boundary is fine since
// it's a standalone Node script, not part of the app's request pipeline.

/** Builds a small solid-colour PNG (fictional placeholder evidence; no real photos are bundled). */
function makePng(r: number, g: number, b: number, w = 320, h = 200): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const row = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) {
    const stripe = Math.floor(x / 20) % 2 === 0 ? 0 : 18; // subtle stripes so it reads as a placeholder
    row[1 + x * 3] = Math.max(0, r - stripe);
    row[2 + x * 3] = Math.max(0, g - stripe);
    row[3 + x * 3] = Math.max(0, b - stripe);
  }
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function seedImage(complaintId: string, userId: string, kind: "EVIDENCE" | "RESOLUTION") {
  const dir = path.join(process.cwd(), process.env.UPLOAD_DIR || "uploads");
  fs.mkdirSync(dir, { recursive: true });
  const name = `seed-${complaintId}-${kind.toLowerCase()}.png`;
  const png = kind === "EVIDENCE" ? makePng(214, 120, 96) : makePng(96, 170, 130);
  fs.writeFileSync(path.join(dir, name), png);
  addAttachment({
    complaintId,
    uploadedById: userId,
    fileName: kind === "EVIDENCE" ? "demo-before.png" : "demo-after.png",
    filePath: `/api/uploads/${name}`,
    mimeType: "image/png",
    fileSize: png.length,
    kind,
  });
}

async function main() {
  const db = getDb();
  db.exec("PRAGMA foreign_keys = ON;");

  console.log("🌱 Seeding Nivaran demo data (all names/emails are fictional)...");

  // ---- Wipe existing data (idempotent re-seed) ----
  const tables = [
    "AuditLog",
    "Rating",
    "Notification",
    "ActivityLog",
    "Attachment",
    "Comment",
    "Assignment",
    "Complaint",
    "SLAConfig",
    "Category",
    "User",
    "Department",
    "Room",
    "Block",
    "Hostel",
  ];
  for (const t of tables) db.exec(`DELETE FROM ${t};`);

  // ---- Hostels / Blocks / Rooms ----
  const hostelA = createHostel("Ganga Hostel", "North Campus");
  const hostelB = createHostel("Yamuna Hostel", "South Campus");

  const blockA1 = createBlock(hostelA.id, "Block A");
  const blockA2 = createBlock(hostelA.id, "Block B");
  const blockB1 = createBlock(hostelB.id, "Block A");

  const rooms: Record<string, ReturnType<typeof createRoom>> = {};
  for (const [block, prefix, floors] of [
    [blockA1, "A", 3],
    [blockA2, "B", 2],
    [blockB1, "C", 3],
  ] as const) {
    for (let floor = 1; floor <= floors; floor++) {
      for (let n = 1; n <= 4; n++) {
        const number = `${prefix}${floor}0${n}`;
        rooms[number] = createRoom(block.id, number, floor);
      }
    }
  }

  // ---- Departments ----
  const electricalDept = createDepartment("Electrical Maintenance");
  const plumbingDept = createDepartment("Plumbing & Water Supply");
  const generalDept = createDepartment("General Facilities");
  const itDept = createDepartment("IT & Networking");

  // ---- Categories ----
  const categories = {
    electrical: createCategory("Electrical", "electrical", "Wiring, switches, fans, lighting"),
    plumbing: createCategory("Plumbing", "plumbing", "Taps, pipes, drainage"),
    cleaning: createCategory("Cleaning", "cleaning", "Housekeeping and sanitation"),
    internet: createCategory("Internet", "internet", "Wi-Fi and network connectivity"),
    furniture: createCategory("Furniture", "furniture", "Beds, desks, chairs, cupboards"),
    security: createCategory("Security", "security", "Locks, CCTV, access control"),
    food: createCategory("Food or Mess", "food-mess", "Dining hall and mess complaints"),
    water: createCategory("Water Supply", "water-supply", "Water availability and quality"),
    room: createCategory("Room Allocation", "room-allocation", "Room change/allocation issues"),
    other: createCategory("Other Grievance", "other-grievance", "Anything not covered above"),
  };

  // ---- SLA configuration (hours to resolve, by category + priority) ----
  const priorities: Priority[] = ["LOW", "MEDIUM", "HIGH", "EMERGENCY"];
  const baseHours: Record<Priority, number> = { LOW: 168, MEDIUM: 72, HIGH: 24, EMERGENCY: 4 };
  for (const cat of Object.values(categories)) {
    for (const p of priorities) {
      upsertSLAConfig(cat.id, p, baseHours[p]);
    }
  }
  // Security & electrical emergencies get a tighter SLA
  upsertSLAConfig(categories.electrical.id, "EMERGENCY", 2);
  upsertSLAConfig(categories.security.id, "EMERGENCY", 1);

  // ---- Users ----
  const pw = await bcrypt.hash("Password123!", 10);

  const admin = createUser({
    name: "Priya Sharma",
    email: "admin@nivaran.edu",
    passwordHash: pw,
    role: "ADMIN",
    phone: "+91-9800000001",
  });

  const tech1 = createUser({
    name: "Ramesh Kumar",
    email: "ramesh.tech@nivaran.edu",
    passwordHash: pw,
    role: "TECHNICIAN",
    departmentId: electricalDept.id,
    phone: "+91-9800000002",
    specialties: "electrical,security",
  });
  const tech2 = createUser({
    name: "Sunita Devi",
    email: "sunita.tech@nivaran.edu",
    passwordHash: pw,
    role: "TECHNICIAN",
    departmentId: plumbingDept.id,
    phone: "+91-9800000003",
    specialties: "plumbing,water-supply",
  });

  const studentDefs = [
    { name: "Aarav Mehta", email: "aarav.student@nivaran.edu", room: "A101" },
    { name: "Diya Patel", email: "diya.student@nivaran.edu", room: "A102" },
    { name: "Kabir Singh", email: "kabir.student@nivaran.edu", room: "B201" },
    { name: "Anika Reddy", email: "anika.student@nivaran.edu", room: "B202" },
    { name: "Vihaan Nair", email: "vihaan.student@nivaran.edu", room: "C101" },
  ];
  const students = studentDefs.map((s) =>
    createUser({
      name: s.name,
      email: s.email,
      passwordHash: pw,
      role: "STUDENT",
      roomId: rooms[s.room]?.id ?? null,
      phone: "+91-9800000000",
    })
  );

  const adminSession: SessionUser = { id: admin.id, name: admin.name, email: admin.email, role: "ADMIN" };
  const tech1Session: SessionUser = { id: tech1.id, name: tech1.name, email: tech1.email, role: "TECHNICIAN" };
  const tech2Session: SessionUser = { id: tech2.id, name: tech2.name, email: tech2.email, role: "TECHNICIAN" };

  // ---- Complaints across the full lifecycle ----
  type Def = {
    title: string;
    description: string;
    category: keyof typeof categories;
    priority: Priority;
    student: number; // index into students
    block?: ReturnType<typeof createBlock>;
    room?: string;
    path: ComplaintStatus[]; // sequence of statuses to walk through (after SUBMITTED)
    technician?: "tech1" | "tech2";
    rate?: number;
  };

  const defs: Def[] = [
    {
      title: "Ceiling fan not working in room A101",
      description:
        "The ceiling fan has stopped working completely for the past two days. It's getting very hot at night.",
      category: "electrical",
      priority: "HIGH",
      student: 0,
      room: "A101",
      technician: "tech1",
      path: ["UNDER_REVIEW", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "READY_FOR_VERIFICATION", "RESOLVED", "CLOSED"],
      rate: 5,
    },
    {
      title: "Leaking tap in common bathroom, Block A",
      description: "The common bathroom tap on the first floor has been leaking continuously, wasting a lot of water.",
      category: "plumbing",
      priority: "MEDIUM",
      student: 1,
      room: "A102",
      technician: "tech2",
      path: ["UNDER_REVIEW", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "READY_FOR_VERIFICATION", "RESOLVED"],
      rate: 4,
    },
    {
      title: "No Wi-Fi connectivity in Block B for 3 days",
      description:
        "Wi-Fi has been completely down in Block B since Monday. Several students are affected and cannot attend online classes.",
      category: "internet",
      priority: "HIGH",
      student: 2,
      room: "B201",
      technician: "tech1",
      path: ["UNDER_REVIEW", "ASSIGNED", "ACCEPTED", "IN_PROGRESS"],
    },
    {
      title: "Room needs cleaning - garbage not collected",
      description:
        "Garbage has not been collected from our floor for over a week. It's starting to smell and attract insects.",
      category: "cleaning",
      priority: "MEDIUM",
      student: 3,
      room: "B202",
      technician: undefined,
      path: ["UNDER_REVIEW"],
    },
    {
      title: "Broken chair in study room",
      description: "One of the study chairs in the common study room has a broken leg and is unsafe to use.",
      category: "furniture",
      priority: "LOW",
      student: 4,
      room: "C101",
      technician: "tech1",
      path: ["UNDER_REVIEW", "ASSIGNED", "ACCEPTED"],
    },
    {
      title: "Main door lock of Block A is jammed",
      description:
        "The main entrance lock of Block A is jammed and does not open smoothly. This is a security concern at night.",
      category: "security",
      priority: "EMERGENCY",
      student: 0,
      room: "A101",
      technician: "tech1",
      path: ["UNDER_REVIEW", "ASSIGNED"],
    },
    {
      title: "Food quality in mess has declined",
      description:
        "The quality and hygiene of food served in the mess has declined significantly over the last two weeks.",
      category: "food",
      priority: "MEDIUM",
      student: 1,
      room: "A102",
      path: ["UNDER_REVIEW"],
    },
    {
      title: "No water supply since morning",
      description: "There has been no water supply in Block A since this morning. Please look into this urgently.",
      category: "water",
      priority: "EMERGENCY",
      student: 2,
      room: "B201",
      technician: "tech2",
      path: ["UNDER_REVIEW", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "READY_FOR_VERIFICATION"],
    },
    {
      title: "Requesting room change due to allergy",
      description: "I have a dust allergy and would like to request a room change to a different block if possible.",
      category: "room",
      priority: "LOW",
      student: 3,
      room: "B202",
      path: [],
    },
    {
      title: "Streetlight outside Block B not working",
      description: "The streetlight outside Block B has been off for several nights, making the path unsafe to walk.",
      category: "electrical",
      priority: "MEDIUM",
      student: 4,
      room: "C101",
      technician: "tech1",
      path: ["UNDER_REVIEW", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "READY_FOR_VERIFICATION", "RESOLVED", "CLOSED"],
      rate: 3,
    },
    {
      title: "Cupboard door hinge broken",
      description: "The cupboard door in my room has a broken hinge and won't close properly.",
      category: "furniture",
      priority: "LOW",
      student: 0,
      room: "A101",
      path: ["UNDER_REVIEW", "REJECTED"],
    },
    {
      title: "Frequent power cuts in Block C",
      description: "Block C has been experiencing frequent short power cuts throughout the day for the last week.",
      category: "electrical",
      priority: "HIGH",
      student: 4,
      room: "C101",
      technician: "tech1",
      path: ["UNDER_REVIEW", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "READY_FOR_VERIFICATION", "RESOLVED", "REOPENED"],
    },
    {
      title: "Washbasin pipe leaking under sink",
      description: "The pipe under the washbasin in the common washroom is leaking and has created a puddle.",
      category: "plumbing",
      priority: "MEDIUM",
      student: 2,
      room: "B201",
      technician: "tech2",
      path: ["UNDER_REVIEW", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "READY_FOR_VERIFICATION", "RESOLVED", "CLOSED"],
      rate: 5,
    },
    {
      title: "CCTV camera in corridor not working",
      description: "The CCTV camera in the Block A corridor appears to be non-functional; the red light is off.",
      category: "security",
      priority: "HIGH",
      student: 1,
      room: "A102",
      technician: undefined,
      path: ["UNDER_REVIEW"],
    },
    {
      title: "Newly submitted: AC not cooling in reading room",
      description:
        "The air conditioner in the shared reading room isn't cooling properly, making it hard to study in the evenings.",
      category: "electrical",
      priority: "MEDIUM",
      student: 3,
      room: "B202",
      path: [],
    },
    {
      title: "Mess bill discrepancy for last month",
      description:
        "There seems to be an error in my mess bill for last month; I was charged for extra days I wasn't present.",
      category: "food",
      priority: "LOW",
      student: 2,
      room: "B201",
      path: [],
    },
    {
      title: "Window latch broken, won't stay shut",
      description: "The window latch in my room is broken so the window won't stay closed during windy weather.",
      category: "furniture",
      priority: "MEDIUM",
      student: 1,
      room: "A102",
      technician: "tech1",
      path: ["UNDER_REVIEW", "ASSIGNED", "ACCEPTED", "IN_PROGRESS"],
    },
  ];

  const techSessions = { tech1: tech1Session, tech2: tech2Session };

  for (const def of defs) {
    const student = students[def.student];
    const room = def.room ? rooms[def.room] : undefined;
    const complaint = createComplaint({
      title: def.title,
      description: def.description,
      categoryId: categories[def.category].id,
      priority: def.priority,
      blockId: room?.blockId ?? null,
      roomId: room?.id ?? null,
      floor: room?.floor ?? null,
      reporterId: student.id,
    });

    let assignedTechSession: SessionUser | undefined;
    for (const status of def.path) {
      if (status === "ASSIGNED" && def.technician) {
        assignedTechSession = techSessions[def.technician];
        transitionComplaint(complaint.id, adminSession, "ASSIGNED", {
          assigneeId: assignedTechSession.id,
          departmentId:
            def.category === "electrical" || def.category === "security"
              ? electricalDept.id
              : def.category === "plumbing" || def.category === "water"
                ? plumbingDept.id
                : generalDept.id,
          comment: `Assigned to ${assignedTechSession.name}`,
        });
        recordAssignment(complaint.id, assignedTechSession.id, admin.id, "Please attend within SLA window");
        continue;
      }
      const actor: SessionUser =
        status === "ACCEPTED" || status === "IN_PROGRESS" || status === "READY_FOR_VERIFICATION"
          ? (assignedTechSession ?? adminSession)
          : status === "RESOLVED" || status === "REOPENED"
            ? { id: student.id, name: student.name, email: student.email, role: "STUDENT" }
            : adminSession;

      const opts: Parameters<typeof transitionComplaint>[3] = {};
      if (status === "RESOLVED") opts.resolutionNotes = "Issue inspected and fixed; parts replaced where required.";
      if (status === "REJECTED") opts.rejectionReason = "Duplicate of an existing maintenance ticket";

      transitionComplaint(complaint.id, actor, status, opts);
    }

    // A couple of comments for realism
    addComment(complaint.id, student.id, "Any update on this? It's been a few days.", false);
    if (assignedTechSession) {
      addComment(complaint.id, assignedTechSession.id, "On it — will inspect today.", false);
    }

    // Fictional placeholder evidence: "before" photo on every complaint, "after" once work is done
    seedImage(complaint.id, student.id, "EVIDENCE");
    if (assignedTechSession && def.path.includes("READY_FOR_VERIFICATION")) {
      seedImage(complaint.id, assignedTechSession.id, "RESOLUTION");
    }

    if (def.rate) {
      addRating(complaint.id, student.id, def.rate, "Thanks for the quick resolution!");
    }

    // Backdate a handful of complaints so the monthly trend chart has more than one bucket
    if (Math.random() < 0.5) {
      const daysAgo = 20 + Math.floor(Math.random() * 40);
      const backdated = new Date(Date.now() - daysAgo * 86400000).toISOString();
      db.prepare("UPDATE Complaint SET createdAt = ? WHERE id = ?").run(backdated, complaint.id);
    }
  }

  // A couple of extra manual notifications for demo richness
  createNotification(students[0].id, null, "STATUS_CHANGED", "Welcome to Nivaran! Track all your complaints here.");
  createNotification(tech1.id, null, "COMPLAINT_ASSIGNED", "You have pending assignments to review.");

  db.prepare(
    "INSERT INTO AuditLog (id, actorId, action, entityType, entityId, metadata, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    genId("adt_"),
    admin.id,
    "SEED_COMPLETED",
    "System",
    null,
    JSON.stringify({ complaints: defs.length }),
    nowIso()
  );

  console.log(`✅ Seeded ${defs.length} complaints, ${students.length} students, 2 technicians, 1 admin.`);
  console.log("\nDemo accounts (password for all: Password123!):");
  console.log("  Admin:      admin@nivaran.edu");
  console.log("  Technician: ramesh.tech@nivaran.edu (Electrical)");
  console.log("  Technician: sunita.tech@nivaran.edu (Plumbing)");
  console.log("  Student:    aarav.student@nivaran.edu");
  console.log("  Student:    diya.student@nivaran.edu");
  console.log("  (3 more student accounts also seeded, see README)");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
