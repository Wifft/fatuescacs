// Helpers shared by the API route handlers. Server-only module.
import { cookies } from "next/headers";
import { AuthError, RateLimiter, SESSION_DAYS, sessionUser, type User } from "./auth";
import { getDb } from "./db";

export const SESSION_COOKIE = "fc_session";
const MAX_BODY_BYTES = 2_000_000;

/** 5 failed attempts per 15 minutes per (IP, username). */
export const loginLimiter = new RateLimiter(5, 15 * 60_000);
/** 10 registrations per hour per IP. */
export const registerLimiter = new RateLimiter(10, 60 * 60_000);

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export const errorResponse = (code: string, status: number, detail?: string) =>
  json(detail ? { error: code, detail } : { error: code }, status);

const AUTH_STATUS: Record<AuthError["code"], number> = {
  "invalid-username": 400,
  "invalid-password": 400,
  "username-taken": 409,
  "bad-credentials": 401,
  "bad-recovery": 401,
  "rate-limited": 429,
};
export const authErrorResponse = (e: AuthError) => errorResponse(e.code, AUTH_STATUS[e.code]);

/**
 * CSRF defence for state-changing requests: the browser's Origin must match our host.
 * (The session cookie is also SameSite=Lax and bodies must be JSON.)
 */
export function checkOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    if (origin && host && new URL(origin).host === host) return null;
  } catch {
    /* malformed Origin */
  }
  return errorResponse("forbidden-origin", 403);
}

export async function readJson(request: Request): Promise<unknown | Response> {
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    return errorResponse("unsupported-media-type", 415);
  }
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) return errorResponse("too-large", 413);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return errorResponse("validation", 400, "json");
  }
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return sessionUser(getDb(), token);
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export const str = (x: unknown): string => (typeof x === "string" ? x : "");
