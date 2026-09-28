import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { SessionUser } from "@/lib/types";
import { findUserById } from "@/server/repo/reference-data";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "nivaran_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET is not set or too short. Copy .env.example to .env and set a strong random value.");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return (payload as { user: SessionUser }).user ?? null;
  } catch {
    return null;
  }
}

/** Reads and verifies the session cookie for the current request (server components / actions). */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const tokenUser = await verifySessionToken(token);
  if (!tokenUser) return null;
  // Re-check the account on every request so deactivation and role changes take effect immediately
  const current = findUserById(tokenUser.id);
  if (!current || !current.isActive) return null;
  return { id: current.id, name: current.name, email: current.email, role: current.role };
}

export async function setSessionCookie(user: SessionUser) {
  const token = await createSessionToken(user);
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

export { SESSION_COOKIE_NAME };

/** Throws-free helper: requires a session, otherwise returns null so callers can redirect. */
export async function requireRole(roles: SessionUser["role"][]): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session) return null;
  if (!roles.includes(session.role)) return null;
  return session;
}
