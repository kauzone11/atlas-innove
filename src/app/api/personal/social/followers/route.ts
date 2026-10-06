import { socialRead } from "@/lib/social/api";
import { listFollows } from "@/lib/social/read-model";
export async function GET(request: Request) { return socialRead((userId) => listFollows(userId, "followers", new URL(request.url).searchParams.get("page") ?? 1)); }
