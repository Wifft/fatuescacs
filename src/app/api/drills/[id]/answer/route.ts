import type { NextRequest } from "next/server";
import { getDb } from "@/server/db";
import { answerDrill } from "@/server/drills";
import { checkOrigin, currentUser, errorResponse, json, readJson } from "@/server/http";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/drills/[id]/answer">) {
  const bad = checkOrigin(req);
  if (bad) return bad;
  const user = await currentUser();
  if (!user) return errorResponse("unauthorized", 401);
  const raw = (await ctx.params).id;
  if (!/^\d{1,12}$/.test(raw)) return errorResponse("not-found", 404);
  const body = await readJson(req);
  if (body instanceof Response) return body;
  const correct = (body as { correct?: unknown }).correct;
  if (typeof correct !== "boolean") return errorResponse("validation", 400, "correct");
  const drill = answerDrill(getDb(), user.id, Number(raw), correct);
  return drill ? json({ drill }) : errorResponse("not-found", 404);
}
