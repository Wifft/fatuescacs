import { computeStats } from "@/lib/chess/stats";
import { statsGames } from "@/server/analyses";
import { getDb } from "@/server/db";
import { currentUser, errorResponse, json } from "@/server/http";

export async function GET() {
  const user = await currentUser();
  if (!user) return errorResponse("unauthorized", 401);
  return json({ stats: computeStats(statsGames(getDb(), user.id)) });
}
