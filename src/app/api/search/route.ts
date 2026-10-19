import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/http";
import { searchWorkspace } from "@/lib/search/global";

export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams.get("q") ?? "";
    return NextResponse.json(await searchWorkspace(q), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
