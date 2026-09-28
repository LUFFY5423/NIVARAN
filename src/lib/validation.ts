import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  roomId: z.string().optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{7,15}$/u, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "EMERGENCY"]);

export const complaintSchema = z.object({
  title: z.string().trim().min(5, "Title should be at least 5 characters").max(150),
  description: z.string().trim().min(10, "Please describe the issue in more detail").max(3000),
  categoryId: z.string().min(1, "Choose a category"),
  subcategory: z.string().trim().max(100).optional().or(z.literal("")),
  blockId: z.string().optional().or(z.literal("")),
  roomId: z.string().optional().or(z.literal("")),
  floor: z.coerce.number().int().min(0).max(50).optional(),
  priority: priorityEnum,
});

export const commentSchema = z.object({
  complaintId: z.string().min(1),
  body: z.string().trim().min(1, "Comment cannot be empty").max(2000),
  isInternal: z.coerce.boolean().optional(),
});

export const ratingSchema = z.object({
  complaintId: z.string().min(1),
  score: z.coerce.number().int().min(1).max(5),
  feedback: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const assignSchema = z.object({
  complaintId: z.string().min(1),
  technicianId: z.string().min(1, "Choose a technician"),
  departmentId: z.string().optional().or(z.literal("")),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const rejectSchema = z.object({
  complaintId: z.string().min(1),
  reason: z.string().trim().min(5, "Provide a reason for rejection").max(1000),
});

export const resolveSchema = z.object({
  complaintId: z.string().min(1),
  resolutionNotes: z.string().trim().min(5, "Describe the work performed").max(2000),
});

export const slaConfigSchema = z.object({
  categoryId: z.string().min(1),
  priority: priorityEnum,
  hoursToSolve: z.coerce.number().int().min(1).max(2000),
});

// File validation used both client-side (quick feedback) and server-side (source of truth)
export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 5 * 1024 * 1024);

export function validateUploadedFile(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return "Only JPEG, PNG, WEBP, or GIF images are allowed";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `File is too large. Max size is ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB`;
  }
  return null;
}
