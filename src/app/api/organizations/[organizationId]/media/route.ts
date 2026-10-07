import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { assertSocialOrigin } from "@/lib/social/api";
import { readMediaUpload, withMediaUploadSlot } from "@/lib/media/multipart";
import { uploadOrganizationMedia } from "@/lib/media/service";
import { isStorageConfigured } from "@/lib/storage/config";
import { unavailableStorage } from "@/lib/media/errors";

export const runtime = "nodejs";
type Context = { params: Promise<{ organizationId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { organizationId } = await context.params;
    const { user } = await requireAuthenticatedSession();
    assertSocialOrigin(request);
    if (!isStorageConfigured()) throw unavailableStorage();
    const asset = await withMediaUploadSlot(user.id, async () => uploadOrganizationMedia(user.id, organizationId, await readMediaUpload(request)));
    return NextResponse.json({ asset }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
