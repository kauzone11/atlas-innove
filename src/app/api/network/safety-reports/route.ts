import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { createSafetyReport } from "@/lib/network/safety";
export async function POST(request: Request) { try { const { user } = await requireAuthenticatedSession(); return NextResponse.json({ report: await createSafetyReport(user.id, await request.json()) }, { status: 201 }); } catch (error) { return errorResponse(error); } }
