import { getDb } from "@/server/db";
import { dueDrills } from "@/server/drills";
import { currentUser, errorResponse, json } from "@/server/http";

export async function GET() {
  const user = await currentUser();
  if (!user) return errorResponse("unauthorized", 401);
  return json(dueDrills(getDb(), user.id));
}
