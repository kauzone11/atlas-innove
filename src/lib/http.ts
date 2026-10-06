import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthorizationError } from "@/lib/auth/authorization";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";

const errorMessages: Record<string, string> = {
  PROGRAM_STATUS_TRANSITION_INVALID: "Este programa não pode mudar para o estado escolhido. Programas arquivados permanecem no histórico.",
  CALL_STATUS_TRANSITION_INVALID: "Este edital não pode mudar para o estado escolhido. Confira a etapa atual da chamada.",
  COHORT_STATUS_TRANSITION_INVALID: "Esta coorte não pode mudar para o estado escolhido. Coortes encerradas e arquivadas preservam seu histórico.",
  COHORT_NOT_ELIGIBLE_FOR_WAVE: "Somente coortes planejadas ou ativas podem receber novas ondas. O histórico desta coorte permanece disponível.",
  CALL_PUBLICATION_REQUIRED: "Publique o resultado pela classificação do edital, após registrar as decisões das candidaturas.",
  CALL_APPLICATION_SETTINGS_FROZEN: "A opção de receber candidaturas está preservada após o início da avaliação. Ela não pode ser alterada nesta etapa.",
  PARTICIPANT_ROLE_FORBIDDEN: "Seu papel nesta equipe ou projeto não permite esta ação. Consulte uma pessoa responsável.",
  PARTICIPANT_LAST_OWNER_REQUIRED: "É necessário manter uma pessoa responsável. Transfira essa função antes de sair ou remover o acesso.",
  TEAM_ARCHIVED: "Esta equipe foi arquivada e não aceita alterações. Seus projetos e participações permanecem no histórico.",
  TEAM_INVITE_INVALID: "Este convite não está disponível. Solicite um novo link a uma pessoa responsável pela equipe.",
  TEAM_INVITE_USED: "Este convite já foi aceito e não pode ser usado novamente. Consulte suas equipes ou solicite outro convite.",
  TEAM_INVITE_EXPIRED: "Este convite expirou. Solicite um novo link a uma pessoa responsável pela equipe.",
  TEAM_INVITE_EMAIL_MISMATCH: "Este convite foi destinado a outro e-mail. Entre com a conta correspondente ou solicite um novo convite.",
  TEAM_ALREADY_MEMBER: "Você já participa desta equipe. Abra a equipe em seu espaço de participante.",
  PROJECT_ARCHIVED: "Este projeto foi arquivado e não aceita alterações. As candidaturas e participações anteriores permanecem no histórico.",
  PROJECT_CONCURRENT_CHANGE: "O contexto deste projeto mudou em outra sessão. Recarregue a página e confira a equipe vinculada antes de continuar.",
  PROJECT_STATUS_TRANSITION_INVALID: "Este estado não pode ser usado ao criar o projeto. Crie um projeto vigente antes de arquivá-lo.",
  PROJECT_TEAM_REQUIRED: "Vincule o projeto a uma equipe antes de adicionar uma pessoa dessa equipe ao projeto.",
  PROJECT_ALREADY_MEMBER: "Esta pessoa já participa do projeto. Confira os membros existentes antes de continuar.",
  APPLICATION_CALL_NOT_OPEN: "Este edital não está recebendo candidaturas pela plataforma. Confira seu estado e a forma oficial de participação.",
  APPLICATION_WINDOW_NOT_STARTED: "O período de candidaturas ainda não começou. Confira a data de abertura do edital.",
  APPLICATION_DEADLINE_PASSED: "O prazo de candidaturas terminou. O rascunho foi preservado, mas não pode ser enviado neste edital.",
  APPLICATION_TEAM_PROJECT_MISMATCH: "A equipe deve ser a equipe vinculada ao projeto. Confira o vínculo atual antes de continuar.",
  APPLICATION_MANAGEMENT_FORBIDDEN: "Seu acesso atual ao projeto ou à equipe não permite alterar esta candidatura. Consulte uma pessoa responsável.",
  APPLICATION_REVISION_CONFLICT: "Esta candidatura foi alterada em outra sessão. O preenchimento desta página foi preservado; confira a versão atual antes de salvar.",
  APPLICATION_SNAPSHOT_FROZEN: "Esta candidatura já foi enviada. O conteúdo submetido permanece preservado e não pode ser editado.",
  APPLICATION_SNAPSHOT_INCOMPLETE: "Informe o nome e o resumo do projeto antes de enviar a candidatura.",
  APPLICATION_WITHDRAWAL_UNAVAILABLE: "Esta candidatura não pode ser retirada nesta etapa. Consulte seu estado e a publicação do resultado.",
  EVALUATION_CRITERIA_FROZEN: "O plano está congelado porque as avaliações já começaram. Os critérios, pesos e notas máximas foram preservados.",
  EVALUATION_PHASE_INVALID: "Esta ação não está disponível na etapa atual do edital. O preenchimento e o envio de avaliações exigem a fase de avaliação.",
  EVALUATION_CRITERIA_ORDER_INVALID: "Os critérios mudaram desde a última consulta. Recarregue o plano antes de alterar sua ordem.",
  APPLICATION_NOT_EVALUABLE: "Esta candidatura não está disponível para avaliação. Confira se ela foi enviada, retirada ou já decidida.",
  EVALUATION_CRITERIA_REQUIRED: "Configure pelo menos um critério no plano do edital antes de iniciar a avaliação.",
  EVALUATION_CRITERION_DUPLICATE: "Um critério foi informado mais de uma vez. Revise o preenchimento da avaliação.",
  EVALUATION_CRITERION_CALL_MISMATCH: "Todos os critérios devem pertencer ao mesmo edital da candidatura. Recarregue o plano de avaliação.",
  EVALUATION_SCORE_RANGE_INVALID: "Informe uma nota entre zero e a nota máxima de cada critério.",
  EVALUATION_INCOMPLETE: "Preencha todos os critérios antes de enviar. Você pode salvar o preenchimento parcial como rascunho.",
  EVALUATION_SUBMITTED_IMMUTABLE: "Esta avaliação já foi enviada. As notas e os comentários permanecem preservados e não podem ser editados.",
  EVALUATION_REVISION_CONFLICT: "Esta avaliação foi alterada em outra sessão. O preenchimento desta página foi preservado; compare a versão atual antes de salvar.",
  DECISION_PHASE_INVALID: "Registre e publique as decisões durante a fase de avaliação. Decisões já publicadas permanecem preservadas.",
  APPLICATION_DECISION_SCOPE_INVALID: "Uma das candidaturas não está disponível para decisão neste edital. Recarregue a lista e confira a seleção.",
  APPLICATION_DECISIONS_INCOMPLETE: "Registre a decisão de todas as candidaturas vigentes antes de publicar o resultado.",
  RESULTS_NOT_PUBLISHED: "Publique o resultado do edital antes de encaminhar as candidaturas selecionadas ao acompanhamento.",
  APPLICATION_COHORT_CALL_MISMATCH: "A coorte de destino deve pertencer à mesma instituição, programa e edital da candidatura.",
  APPLICATION_SELECTION_REQUIRED: "Selecione de 1 a 200 candidaturas para registrar o ingresso no acompanhamento.",
  APPLICATION_SELECTION_SCOPE_INVALID: "Somente candidaturas selecionadas e decididas neste edital podem ingressar no acompanhamento. Confira a seleção atual.",
  APPLICATION_ALREADY_ENROLLED_OTHER_COHORT: "Esta candidatura já originou uma participação em outra coorte. Consulte o acompanhamento existente.",
  APPLICATION_VENTURE_ARCHIVED: "A entidade acompanhada deste projeto está arquivada. Confira seu histórico antes de escolher o destino.",
  APPLICATION_VENTURE_ALREADY_ENROLLED: "Esta entidade já participa da coorte com outra origem. Consulte a participação existente antes de continuar.",
  APPLICATION_VENTURE_MAPPING_INVALID: "O vínculo escolhido não está disponível para este projeto. Confira se a entidade pertence à instituição e se já possui outro projeto de origem.",
  APPLICATION_VENTURE_MAPPING_CHANGED: "Este projeto passou a ter uma entidade acompanhada desde a conferência. Revise a seleção e prepare a conferência novamente antes de confirmar. Suas escolhas permanecem nesta janela.",
  FUNDING_PROGRAM_ARCHIVED: "Um programa arquivado não pode ser reativado.",
  FUNDING_CALL_ARCHIVED: "Este edital está arquivado e não aceita alterações. Seu histórico permanece preservado.",
  FUNDING_CALL_DATE_RANGE_INVALID: "O encerramento das inscrições deve ocorrer após a abertura.",
  FUNDING_CALL_NOT_ELIGIBLE_FOR_COHORT: "Este edital não pode receber novas coortes neste estado.",
  PROGRAM_NOT_ELIGIBLE_FOR_CALL: "Este programa não pode receber novos editais neste estado.",
  COHORT_ARCHIVED: "Esta coorte está arquivada e não aceita alterações. Seu histórico permanece preservado.",
  COHORT_PROTOCOL_FROZEN: "O protocolo está congelado porque a coorte já possui ondas de acompanhamento.",
  COHORT_HISTORY_FROZEN: "O vínculo com o edital está preservado porque a coorte já possui histórico.",
  PROTOCOL_HAS_NO_INDICATORS: "Selecione uma versão de protocolo que contenha indicadores.",
  COHORT_PROTOCOL_REQUIRED: "Selecione uma versão de protocolo na coorte antes de criar a primeira onda.",
  FUNDING_CALL_PROGRAM_MISMATCH: "O edital deve pertencer ao programa desta coorte.",
  OBSERVATION_REVISION_CONFLICT: "Esta observação foi alterada em outra janela. Recarregue para conferir a versão atual antes de salvar.",
  OBSERVATION_SUBMISSION_EMPTY: "Registre ao menos um valor observado antes de enviar. Os campos vazios permanecerão sem informação.",
  OBSERVATION_SUBMITTED: "Esta observação já foi enviada e seu histórico está preservado.",
  OBSERVATION_MISSED: "Esta observação foi encerrada como não respondida.",
  OBSERVATION_WAVE_NOT_OPEN: "Abra a onda de acompanhamento antes de registrar valores.",
  OBSERVATION_PROTOCOL_MISSING: "Esta coorte precisa de uma versão de protocolo com indicadores.",
  OBSERVATION_ENROLLMENT_NOT_ELIGIBLE: "A participação não estava vigente na data de referência desta onda.",
  OBSERVATION_INDICATOR_DUPLICATE: "O mesmo indicador foi informado mais de uma vez.",
  OBSERVATION_INDICATOR_VERSION_MISMATCH: "Os indicadores devem pertencer à versão de protocolo desta coorte.",
  OBSERVATION_INTEGER_INVALID: "Informe um número inteiro não negativo dentro do limite permitido.",
  OBSERVATION_CURRENCY_INVALID: "Informe um valor monetário não negativo com até duas casas decimais.",
  OBSERVATION_ENUM_INVALID: "Selecione uma das opções previstas pelo indicador.",
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
