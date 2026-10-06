import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { assertSocialOrigin } from "@/lib/social/api";
import { readMediaUpload, withMediaUploadSlot } from "@/lib/media/multipart";
import { uploadMedia } from "@/lib/media/service";
import { isStorageConfigured } from "@/lib/storage/config";
import { unavailableStorage } from "@/lib/media/errors";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedSession();
    assertSocialOrigin(request);
    if (!isStorageConfigured()) throw unavailableStorage();
    const asset = await withMediaUploadSlot(async () => uploadMedia(user.id, await readMediaUpload(request)));
    return NextResponse.json({ asset }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
