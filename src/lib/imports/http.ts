import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthorizationError } from "@/lib/auth/authorization";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { errorResponse } from "@/lib/http";
import { ImportInputError } from "@/lib/imports/errors";
import { importMessage } from "@/lib/imports/copy";

export function importResponse(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });
}
export function importErrorResponse(error: unknown) {
  if (error instanceof ImportInputError) {
    const status = error.code === "IMPORT_BATCH_NOT_FOUND" ? 404 : error.code === "IMPORT_ORIGIN_REJECTED" ? 403 : /TOO_LARGE/.test(error.code) ? 413 : /CONFLICT|CHANGED|IMMUTABLE|NOT_READY|NOT_APPLIED|ROLLBACK_BLOCKED|APPLY_FAILED|REVALIDATION/.test(error.code) ? 409 : 400;
    return importResponse({ error: importMessage(error.code), code: error.code, rowNumber: error.rowNumber, field: error.field }, status);
  }
  if (error instanceof ZodError || error instanceof AuthorizationError || error instanceof DomainConflictError || error instanceof ResourceNotFoundError) {
    const response = errorResponse(error); response.headers.set("Cache-Control", "no-store"); return response;
  }
  console.error({ event: "institutional_import_failed", errorType: error instanceof Error ? error.name : "UnknownError" });
  return importResponse({ error: "Não foi possível concluir a operação. Consulte o estado do lote antes de repetir." }, 500);
}
