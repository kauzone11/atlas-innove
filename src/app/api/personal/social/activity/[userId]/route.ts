import { socialRead, type SocialRouteContext } from "@/lib/social/api";
import { getActivity } from "@/lib/social/activity";
export async function GET(request: Request, context: SocialRouteContext<"userId">) { const { userId: targetId } = await context.params; const query = new URL(request.url).searchParams; return socialRead((userId) => getActivity(targetId, userId, { page: query.get("page") ?? 1, filter: query.get("filter") ?? undefined })); }
