import { currentUser, json } from "@/server/http";

export async function GET() {
  return json({ user: await currentUser() });
}
