import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/http";
import { selectActiveOrganization } from "@/lib/auth/session";

const schema = z.object({ organizationId: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const { organizationId } = schema.parse(await request.json());
    await selectActiveOrganization(organizationId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
