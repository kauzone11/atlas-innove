import { socialWrite } from "@/lib/social/api";
import { setProfileMedia } from "@/lib/media/service";
export async function PATCH(request: Request) { return socialWrite(request, setProfileMedia); }
