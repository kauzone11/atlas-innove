import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthorizationError } from "@/lib/auth/authorization";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";

const errorMessages: Record<string, string> = {
  AUTHENTICATION_REQUIRED: "É necessário entrar para continuar.",
  ORGANIZATION_INACTIVE: "A organização está inativa.",
  MEMBERSHIP_DISABLED: "Seu acesso a esta organização está desativado.",
  ORGANIZATION_ACCESS_DENIED: "Você não tem acesso a esta organização.",
  ROLE_FORBIDDEN: "Seu perfil não pode realizar esta operação.",
  TENANT_SCOPE_REQUIRED: "A organização é obrigatória.",
  TENANT_SCOPE_MISMATCH: "Os registros não pertencem à mesma organização.",
  COHORT_SCOPE_MISMATCH: "Os registros não pertencem à mesma coorte.",
  ROLE_ESCALATION_REJECTED: "Esta alteração de perfil não é permitida.",
  VENTURE_ALREADY_ENROLLED: "Este empreendimento já participa desta coorte.",
  PROGRAM_NOT_ELIGIBLE_FOR_COHORT: "O programa não pode receber novas coortes neste estado.",
  COHORT_NOT_ELIGIBLE_FOR_ENROLLMENT: "A coorte não pode receber novas inscrições neste estado.",
  COHORT_DATE_RANGE_INVALID: "A data final deve ser posterior à data inicial.",
  COHORT_ARCHIVED_FOR_WAVE: "Uma coorte arquivada não pode receber novas ondas.",
  BASELINE_ALREADY_EXISTS: "Esta coorte já possui uma baseline.",
  BASELINE_SEQUENCE_INVALID: "A baseline deve usar a primeira sequência, 0.",
  FOLLOW_UP_SEQUENCE_INVALID: "Ondas follow-up devem usar uma sequência positiva.",
  WAVE_STATUS_TRANSITION_INVALID: "Esta transição de status da onda não é permitida.",
  OBSERVATION_STATUS_TRANSITION_INVALID: "Esta transição de status da observação não é permitida.",
  OBSERVATION_SUBMISSION_NOT_AVAILABLE: "A submissão será habilitada quando houver um instrumento de coleta.",
  ENROLLMENT_NOT_ACTIVE: "Esta participação não está ativa.",
  OBSERVATION_ALREADY_EXISTS: "Esta participação já possui uma observação para esta onda.",
};

function messageForCode(code: string): string {
  return errorMessages[code] ?? code;
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  if (error instanceof AuthorizationError) {
    const status = error.code === "AUTHENTICATION_REQUIRED" ? 401 : error.code === "VENTURE_ALREADY_ENROLLED" ? 409 : 403;
    return NextResponse.json({ error: messageForCode(error.code), code: error.code }, { status });
  }
  if (error instanceof DomainConflictError) {
    return NextResponse.json({ error: messageForCode(error.code), code: error.code }, { status: 409 });
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
