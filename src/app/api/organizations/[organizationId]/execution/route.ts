import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse } from "@/lib/http";
import { awardStatusSchema } from "@/lib/awards/schemas";
import { listOrganizationExecution } from "@/lib/awards/service";
type Context = { params: Promise<{ organizationId: string }> };
const filterSchema = z.object({ page: z.coerce.number().int().min(1).max(10000).optional(), status: awardStatusSchema.optional(), programId: z.string().cuid().optional(), callId: z.string().cuid().optional(), attention: z.enum(["OVERDUE", "REVIEW", "CHANGES", "DISBURSEMENT", "ENDING", "PREPARING"]).optional() }).strict();
export async function GET(request: Request, context: Context) {
  try {
    const { organizationId } = await context.params;
    const access = await requireOrganizationAccess(organizationId);
    const query = Object.fromEntries(new URL(request.url).searchParams);
    return NextResponse.json({ execution: await listOrganizationExecution(access, filterSchema.parse(query)) });
  } catch (error) { return errorResponse(error); }
}
