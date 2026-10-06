export type VisibilityScope = "PUBLIC" | "PLATFORM" | "TEAM" | "PRIVATE";

export type ProfileViewer = {
  viewerUserId?: string | null;
  profileUserId: string;
  sharedCollaboration?: boolean;
};

export function resolveProfileVisibility({ scope, viewerUserId, profileUserId, sharedCollaboration = false }: ProfileViewer & { scope: VisibilityScope }): boolean {
  if (viewerUserId === profileUserId) return true;
  if (scope === "PUBLIC") return true;
  if (!viewerUserId) return false;
  if (scope === "PLATFORM") return true;
  if (scope === "TEAM") return sharedCollaboration;
  return false;
}

export const visibilityLabels: Record<VisibilityScope, string> = {
  PUBLIC: "Público", PLATFORM: "Pessoas na plataforma", TEAM: "Colaboradores", PRIVATE: "Privado",
};

export const visibilityDescriptions: Record<VisibilityScope, string> = {
  PUBLIC: "Qualquer pessoa pode ver.",
  PLATFORM: "Apenas pessoas que entraram no Atlas Innove.",
  TEAM: "Apenas pessoas com colaboração vigente em uma equipe ou projeto.",
  PRIVATE: "Somente você pode ver.",
};

export const privacyFields = [
  ["profileVisibility", "Perfil"], ["skillsVisibility", "Competências e interesses"], ["experienceVisibility", "Experiência"],
  ["educationVisibility", "Formação"], ["linksVisibility", "Links"], ["verifiedParticipationVisibility", "Participações verificadas"], ["projectsVisibility", "Projetos públicos"],
] as const;
