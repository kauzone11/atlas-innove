import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { listSavedOpportunities } from "@/lib/opportunities/service";
import { errorResponse } from "@/lib/http";
export async function GET() { try { const { user } = await requireAuthenticatedSession(); return NextResponse.json({ opportunities: await listSavedOpportunities(user.id) }); } catch (error) { return errorResponse(error); } }
