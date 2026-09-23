export const organizationRoles = [
  "OWNER",
  "ADMIN",
  "MANAGER",
  "ANALYST",
  "VIEWER",
] as const;

export type OrganizationRole = (typeof organizationRoles)[number];

export const organizationStatuses = ["ACTIVE", "INACTIVE"] as const;
export type OrganizationStatus = (typeof organizationStatuses)[number];

export const membershipStatuses = ["ACTIVE", "DISABLED"] as const;
export type MembershipStatus = (typeof membershipStatuses)[number];

export const ROLE_LABELS: Record<OrganizationRole, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  MANAGER: "Gestor",
  ANALYST: "Analista",
  VIEWER: "Visualizador",
};

export const fundingProgramStatuses = ["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"] as const;
export type FundingProgramStatus = (typeof fundingProgramStatuses)[number];

export const cohortStatuses = ["PLANNED", "ACTIVE", "CLOSED", "ARCHIVED"] as const;
export type CohortStatus = (typeof cohortStatuses)[number];

export const ventureKinds = ["COMPANY", "PROJECT", "INITIATIVE", "OTHER"] as const;
export type VentureKind = (typeof ventureKinds)[number];

export const ventureEnrollmentStatuses = ["ACTIVE", "WITHDRAWN"] as const;
export type VentureEnrollmentStatus = (typeof ventureEnrollmentStatuses)[number];

export const followUpWaveKinds = ["BASELINE", "FOLLOW_UP"] as const;
export type FollowUpWaveKind = (typeof followUpWaveKinds)[number];

export const followUpWaveStatuses = ["PLANNED", "OPEN", "CLOSED", "ARCHIVED"] as const;
export type FollowUpWaveStatus = (typeof followUpWaveStatuses)[number];

export const ventureObservationStatuses = ["PENDING", "IN_PROGRESS", "SUBMITTED", "MISSED"] as const;
export type VentureObservationStatus = (typeof ventureObservationStatuses)[number];

export const FUNDING_PROGRAM_STATUS_LABELS: Record<FundingProgramStatus, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativo",
  CLOSED: "Encerrado",
  ARCHIVED: "Arquivado",
};

export const COHORT_STATUS_LABELS: Record<CohortStatus, string> = {
  PLANNED: "Planejada",
  ACTIVE: "Ativa",
  CLOSED: "Encerrada",
  ARCHIVED: "Arquivada",
};

export const VENTURE_KIND_LABELS: Record<VentureKind, string> = {
  COMPANY: "Empresa",
  PROJECT: "Projeto tecnológico",
  INITIATIVE: "Iniciativa",
  OTHER: "Outro",
};

export const VENTURE_ENROLLMENT_STATUS_LABELS: Record<VentureEnrollmentStatus, string> = {
  ACTIVE: "Ativa",
  WITHDRAWN: "Retirada",
};

export const FOLLOW_UP_WAVE_KIND_LABELS: Record<FollowUpWaveKind, string> = {
  BASELINE: "Baseline",
  FOLLOW_UP: "Follow-up",
};

export const FOLLOW_UP_WAVE_STATUS_LABELS: Record<FollowUpWaveStatus, string> = {
  PLANNED: "Planejada",
  OPEN: "Aberta",
  CLOSED: "Encerrada",
  ARCHIVED: "Arquivada",
};

export const VENTURE_OBSERVATION_STATUS_LABELS: Record<VentureObservationStatus, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  SUBMITTED: "Enviada",
  MISSED: "Não respondida",
};
