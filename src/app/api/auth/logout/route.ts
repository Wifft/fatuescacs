import { cookies } from "next/headers";
import { deleteSession } from "@/server/auth";
import { getDb } from "@/server/db";
import { checkOrigin, clearSessionCookie, json, SESSION_COOKIE } from "@/server/http";

export async function POST(request: Request) {
  const bad = checkOrigin(request);
  if (bad) return bad;
  deleteSession(getDb(), (await cookies()).get(SESSION_COOKIE)?.value);
  await clearSessionCookie();
  return json({ ok: true });
}
