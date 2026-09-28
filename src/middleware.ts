import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "nivaran_session";

const roleAreaPrefix: Record<string, string> = {
  STUDENT: "/student",
  ADMIN: "/admin",
  TECHNICIAN: "/technician",
};

async function getRoleFromToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const user = (payload as { user?: { role?: string } }).user;
    return user?.role ?? null;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected =
    pathname.startsWith("/student") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/technician") ||
    pathname.startsWith("/notifications") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/complaints");

  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const role = await getRoleFromToken(token);

  if (!role) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // /complaints/[id], /notifications, /profile are shared across roles once authenticated
  if (pathname.startsWith("/complaints") || pathname.startsWith("/notifications") || pathname.startsWith("/profile")) {
    return NextResponse.next();
  }

  const requiredPrefix = Object.entries(roleAreaPrefix).find(([r]) => r === role)?.[1];
  if (requiredPrefix && !pathname.startsWith(requiredPrefix)) {
    const url = req.nextUrl.clone();
    url.pathname = requiredPrefix;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/student/:path*",
    "/admin/:path*",
    "/technician/:path*",
    "/complaints/:path*",
    "/notifications",
    "/profile",
  ],
};
