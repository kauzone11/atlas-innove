import { socialWrite, type SocialRouteContext } from "@/lib/social/api";
import { updateComment, deleteComment } from "@/lib/social/comments";
export async function PATCH(request: Request, context: SocialRouteContext<"commentId">) { const { commentId } = await context.params; return socialWrite(request, (userId, input) => updateComment(userId, commentId, input)); }
export async function DELETE(request: Request, context: SocialRouteContext<"commentId">) { const { commentId } = await context.params; return socialWrite(request, (userId) => deleteComment(userId, commentId)); }
