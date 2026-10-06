import { socialWrite } from "@/lib/social/api";
import { reportSocialContent } from "@/lib/social/moderation";
export async function POST(request: Request) { return socialWrite(request, (userId, input) => reportSocialContent(userId, input)); }
