import { AuthError, createSession, recover } from "@/server/auth";
import { getDb } from "@/server/db";
import {
  authErrorResponse,
  checkOrigin,
  clientIp,
  json,
  loginLimiter,
  readJson,
  setSessionCookie,
  str,
} from "@/server/http";

export async function POST(request: Request) {
  const bad = checkOrigin(request);
  if (bad) return bad;
  const body = await readJson(request);
  if (body instanceof Response) return body;
  const { username, code, password } = body as Record<string, unknown>;
  const name = str(username).trim();
  const key = `recover:${clientIp(request)}:${name.toLowerCase()}`;
  try {
    loginLimiter.check(key);
    const db = getDb();
    const r = await recover(db, name, str(code), str(password)).catch((e: unknown) => {
      if (e instanceof AuthError && e.code === "bad-recovery") loginLimiter.fail(key);
      throw e;
    });
    loginLimiter.reset(key);
    await setSessionCookie(createSession(db, r.user.id));
    return json({ user: r.user, recoveryCode: r.recoveryCode });
  } catch (e) {
    if (e instanceof AuthError) return authErrorResponse(e);
    throw e;
  }
}
