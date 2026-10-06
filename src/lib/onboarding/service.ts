import { db } from "@/lib/db";
import { assertImportAccess } from "@/lib/auth/imports-access";

export async function getInstitutionOnboarding(userId: string, organizationId: string) {
  return db.$transaction(async (client) => {
    await assertImportAccess(userId, organizationId, client);
    const [organization, program, call, protocol, cohort, enrollment, wave, observation] = await Promise.all([
      client.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { name: true, slug: true } }),
      client.fundingProgram.findFirst({ where: { organizationId }, orderBy: { createdAt: "asc" }, select: { id: true } }),
      client.fundingCall.findFirst({ where: { organizationId }, select: { id: true } }),
      client.trackingProtocolVersion.findFirst({ where: { organizationId, indicators: { some: { organizationId } } }, select: { id: true } }),
      client.cohort.findFirst({ where: { organizationId }, orderBy: { createdAt: "asc" }, select: { id: true, fundingProgramId: true } }),
      client.ventureEnrollment.findFirst({ where: { organizationId }, select: { id: true } }),
      client.followUpWave.findFirst({ where: { organizationId }, select: { id: true } }),
      client.ventureObservation.findFirst({ where: { organizationId, status: "SUBMITTED" }, select: { id: true } }),
    ]);
    const cohortHref = cohort ? `/app/programs/${cohort.fundingProgramId}/cohorts/${cohort.id}` : program ? `/app/programs/${program.id}` : "/app/programs";
    return { steps: [
      { key: "organization", title: "Identificação institucional", description: "Confira o nome e o identificador da instituição.", complete: Boolean(organization.name && organization.slug), href: "/app/settings", action: "Conferir identificação" },
      { key: "program", title: "Programa", description: "Organize a finalidade e os ciclos do acompanhamento.", complete: Boolean(program), href: "/app/programs", action: "Abrir programas" },
      { key: "call", title: "Edital, quando aplicável", description: "Vincule o instrumento de apoio. A divulgação pública é uma decisão separada.", complete: Boolean(call), href: program ? `/app/programs/${program.id}` : "/app/programs", action: "Abrir editais do programa", optional: true },
      { key: "protocol", title: "Protocolo com indicadores", description: "Defina o que será observado e preserve a versão usada em cada coorte.", complete: Boolean(protocol), href: "/app/protocols", action: "Abrir protocolos" },
      { key: "cohort", title: "Coorte", description: "Defina um ciclo de acompanhamento dentro do programa.", complete: Boolean(cohort), href: cohortHref, action: "Abrir ciclo" },
      { key: "enrollment", title: "Empreendimento e participação", description: "Vincule a identidade estável do empreendimento à coorte.", complete: Boolean(enrollment), href: cohortHref, action: "Abrir participações" },
      { key: "wave", title: "Onda de acompanhamento", description: "Defina uma baseline ou um novo momento de observação.", complete: Boolean(wave), href: cohortHref, action: "Organizar ondas" },
      { key: "observation", title: "Primeira observação enviada", description: "Registre evidências pelo acompanhamento ou importe dados históricos validados.", complete: Boolean(observation), href: "/app/follow-ups", action: "Abrir acompanhamentos" },
    ] };
  });
}
