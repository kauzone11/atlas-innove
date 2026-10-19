import { socialWrite } from "@/lib/social/api";
import { setProfileCoverPreset } from "@/lib/media/service";
export async function PATCH(request: Request) { return socialWrite(request, setProfileCoverPreset); }
