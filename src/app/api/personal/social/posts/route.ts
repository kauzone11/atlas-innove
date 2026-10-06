import { socialWrite } from "@/lib/social/api";
import { createPost } from "@/lib/social/posts";
export async function POST(request: Request) { return socialWrite(request, (userId, input) => createPost(userId, input)); }
