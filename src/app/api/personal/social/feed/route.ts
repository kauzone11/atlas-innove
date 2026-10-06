import { socialRead } from "@/lib/social/api";
import { getFeed } from "@/lib/social/feed";
export async function GET(request: Request) { const query = new URL(request.url).searchParams; return socialRead((userId) => getFeed(userId, { mode: query.get("mode") ?? undefined, cursor: query.get("cursor") ?? undefined })); }
