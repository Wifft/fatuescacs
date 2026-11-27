import { listAnalyses, saveAnalysis, ValidationError } from "@/server/analyses";
import { getDb } from "@/server/db";
import { checkOrigin, currentUser, errorResponse, json, readJson } from "@/server/http";

export async function GET() {
  const user = await currentUser();
  if (!user) return errorResponse("unauthorized", 401);
  return json({ analyses: listAnalyses(getDb(), user.id) });
}

export async function POST(request: Request) {
  const bad = checkOrigin(request);
  if (bad) return bad;
  const user = await currentUser();
  if (!user) return errorResponse("unauthorized", 401);
  const body = await readJson(request);
  if (body instanceof Response) return body;
  try {
    return json({ id: saveAnalysis(getDb(), user.id, body) }, 201);
  } catch (e) {
    if (e instanceof ValidationError) return errorResponse("validation", 400, e.message);
    throw e;
  }
}
