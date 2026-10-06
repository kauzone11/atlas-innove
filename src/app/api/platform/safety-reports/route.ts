import { NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/auth/platform-access";
import { errorResponse } from "@/lib/http";
import { listSafetyReports } from "@/lib/network/safety";
export async function GET(request: Request) { try { const { user } = await requireSuperAdminSession(); const query = new URL(request.url).searchParams; return NextResponse.json(await listSafetyReports(user.id, { page: query.get("page") ?? 1, status: query.get("status") ?? undefined })); } catch (error) { return errorResponse(error); } }
