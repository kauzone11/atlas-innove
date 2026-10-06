import { NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/auth/platform-access";
import { errorResponse } from "@/lib/http";
import { reviewSafetyReport } from "@/lib/network/safety";
type Context = { params: Promise<{ reportId: string }> };
export async function PATCH(request: Request, { params }: Context) { try { const { user } = await requireSuperAdminSession(); const { reportId } = await params; await reviewSafetyReport(user.id, reportId, await request.json()); return NextResponse.json({ ok: true }); } catch (error) { return errorResponse(error); } }
