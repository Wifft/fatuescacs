import { AuthError, createSession, register } from "@/server/auth";
import { getDb } from "@/server/db";
import {
  authErrorResponse,
  checkOrigin,
  clientIp,
  json,
  readJson,
  registerLimiter,
  setSessionCookie,
  str,
} from "@/server/http";

export async function POST(request: Request) {
  const bad = checkOrigin(request);
  if (bad) return bad;
  const body = await readJson(request);
  if (body instanceof Response) return body;
  const { username, password } = body as Record<string, unknown>;
  const ipKey = `register:${clientIp(request)}`;
  try {
    registerLimiter.check(ipKey);
    const db = getDb();
    const { user, recoveryCode } = await register(db, str(username).trim(), str(password));
    registerLimiter.fail(ipKey); // counts successful registrations too
    await setSessionCookie(createSession(db, user.id));
    return json({ user, recoveryCode }, 201);
  } catch (e) {
    if (e instanceof AuthError) return authErrorResponse(e);
    throw e;
  }
}
