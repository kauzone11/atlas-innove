import { z } from "zod";

import { db } from "@/lib/db";
import { getActiveOrganizationContext, requireAuthenticatedSession } from "@/lib/auth/session";
import { listDiscoverablePeople } from "@/lib/network/people";

const querySchema = z.string().trim().min(2).max(80);

export type GlobalSearchResult = {
  programs: Array<{ id: string; name: string; href: string; hint: string }>;
  ventures: Array<{ id: string; name: string; href: string; hint: string }>;
  people: Array<{ id: string; name: string; href: string; hint: string }>;
};

/** Organization results require a server-validated active membership; people use the visibility-filtered directory. */
export async function searchWorkspace(value: unknown): Promise<GlobalSearchResult> {
  const auth = await requireAuthenticatedSession();
  const parsed = querySchema.safeParse(value);
  if (!parsed.success) return { programs: [], ventures: [], people: [] };
  const q = parsed.data;
  const context = await getActiveOrganizationContext();
  const organizationId = context?.organization.id;
  const [programs, ventures, people] = await Promise.all([
    organizationId ? db.fundingProgram.findMany({ where: { organizationId, name: { contains: q, mode: "insensitive" } }, orderBy: { name: "asc" }, take: 5, select: { id: true, name: true, code: true } }) : [],
    organizationId ? db.venture.findMany({ where: { organizationId, archivedAt: null, name: { contains: q, mode: "insensitive" } }, orderBy: { name: "asc" }, take: 5, select: { id: true, name: true, legalName: true } }) : [],
    listDiscoverablePeople(auth.user.id, { q, pageSize: 5 }).then((result) => result.people).catch(() => []),
  ]);
  return {
    programs: programs.map((program) => ({ id: program.id, name: program.name, href: `/app/programs/${program.id}`, hint: program.code ?? "Programa" })),
    ventures: ventures.map((venture) => ({ id: venture.id, name: venture.name, href: `/app/ventures/${venture.id}`, hint: venture.legalName ?? "Empreendimento" })),
    people: people.map((person) => ({ id: person.userId, name: person.fullName, href: `/app/personal/network/people/${person.handle}`, hint: person.headline })),
  };
}
