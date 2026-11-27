import type { NextRequest } from "next/server";
import { deleteAnalysis, getAnalysis } from "@/server/analyses";
import { getDb } from "@/server/db";
import { checkOrigin, currentUser, errorResponse, json } from "@/server/http";

const parseId = (raw: string) => (/^\d{1,12}$/.test(raw) ? Number(raw) : null);

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/analyses/[id]">) {
  const user = await currentUser();
  if (!user) return errorResponse("unauthorized", 401);
  const id = parseId((await ctx.params).id);
  const a = id === null ? null : getAnalysis(getDb(), user.id, id);
  return a ? json({ analysis: a }) : errorResponse("not-found", 404);
}

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/analyses/[id]">) {
  const bad = checkOrigin(req);
  if (bad) return bad;
  const user = await currentUser();
  if (!user) return errorResponse("unauthorized", 401);
  const id = parseId((await ctx.params).id);
  return id !== null && deleteAnalysis(getDb(), user.id, id)
    ? json({ ok: true })
    : errorResponse("not-found", 404);
}
