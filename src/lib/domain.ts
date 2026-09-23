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
