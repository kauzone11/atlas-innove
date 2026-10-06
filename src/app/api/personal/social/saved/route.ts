import { socialRead } from "@/lib/social/api";
import { getSavedPosts } from "@/lib/social/read-model";
export async function GET(request: Request) { return socialRead((userId) => getSavedPosts(userId, new URL(request.url).searchParams.get("page") ?? 1)); }
