import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthorizationError } from "@/lib/auth/authorization";
import { ResourceNotFoundError } from "@/lib/errors";

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  if (error instanceof AuthorizationError) {
    const status = error.code === "AUTHENTICATION_REQUIRED" ? 401 : error.code === "VENTURE_ALREADY_ENROLLED" ? 409 : 403;
    return NextResponse.json({ error: error.code }, { status });
  }
  if (error instanceof ResourceNotFoundError) {
    return NextResponse.json({ error: "Recurso não encontrado." }, { status: 404 });
  }

  console.error(error);
  return NextResponse.json({ error: "Não foi possível concluir a operação." }, { status: 500 });
}

export function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
