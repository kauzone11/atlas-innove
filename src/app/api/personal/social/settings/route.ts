import { socialWrite, socialRead } from "@/lib/social/api";
import { updateFollowSettings } from "@/lib/social/follows";
import { getSocialProfileSummary } from "@/lib/social/read-model";
export async function GET() { return socialRead((userId) => getSocialProfileSummary(userId, userId)); }
export async function PATCH(request: Request) { return socialWrite(request, (userId, input) => updateFollowSettings(userId, input)); }
