import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeTag } from "@/lib/identity/normalization";
import { getDiscoveryContext } from "@/lib/network/discovery-context";
import { projectDiscoverySchema } from "@/lib/network/discovery-schemas";
import { compareRelevance, explainProjectRelevance } from "@/lib/network/relevance";

const projectSelect = {
  id: true, name: true, summary: true, status: true, thematicAreas: true,
  collaborationOpen: true, collaborationNote: true,
} satisfies Prisma.ProjectSelect;
function eligibleProjectWhere(viewerUserId: string): Prisma.ProjectWhereInput {
  return {
    directoryEnabled: true, visibility: { in: ["PUBLIC", "PLATFORM"] }, archivedAt: null, status: { not: "ARCHIVED" },
    createdBy: { blocksInitiated: { none: { blockedUserId: viewerUserId } }, blocksReceived: { none: { blockerUserId: viewerUserId } } },
  };
}
export async function listDiscoverableProjects(viewerUserId: string, value: unknown = {}) {
  const filters = projectDiscoverySchema.parse(value);
  const normalizedTopic = Prisma.sql`trim(both '-' from regexp_replace(regexp_replace(normalize(lower(topic.label), NFD), '[̀-ͯ]', '', 'g'), '[^a-z0-9]+', '-', 'g'))`;
  const conditions: Prisma.Sql[] = [];
  if (filters.status) conditions.push(Prisma.sql`p."status"::text = ${filters.status}`);
  if (filters.collaborationOpen) conditions.push(Prisma.sql`p."collaborationOpen" = ${filters.collaborationOpen === "true"}`);
  if (filters.q) conditions.push(Prisma.sql`(strpos(lower(p."name"), lower(${filters.q})) > 0 OR strpos(lower(p."summary"), lower(${filters.q})) > 0 OR EXISTS (SELECT 1 FROM unnest(p."thematicAreas") AS topic(label) WHERE strpos(${normalizedTopic}, ${normalizeTag(filters.q) || "__invalid_topic__"}) > 0))`);
  if (filters.topic) conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM unnest(p."thematicAreas") AS topic(label) WHERE strpos(${normalizedTopic}, ${normalizeTag(filters.topic) || "__invalid_topic__"}) > 0)`);
  const [ids, context] = await Promise.all([
    db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT p."id" FROM "Project" p
      WHERE p."directoryEnabled" = true AND p."visibility" IN ('PUBLIC', 'PLATFORM')
        AND p."archivedAt" IS NULL AND p."status" != 'ARCHIVED'
        AND NOT EXISTS (SELECT 1 FROM "UserBlock" b WHERE
          (b."blockerUserId" = ${viewerUserId} AND b."blockedUserId" = p."createdByUserId")
          OR (b."blockedUserId" = ${viewerUserId} AND b."blockerUserId" = p."createdByUserId"))
        ${conditions.length ? Prisma.sql`AND ${Prisma.join(conditions, " AND ")}` : Prisma.empty}
      ORDER BY p."name", p."id" LIMIT ${filters.pageSize + 1} OFFSET ${(filters.page - 1) * filters.pageSize}
    `),
    getDiscoveryContext(viewerUserId),
  ]);
  const records = ids.length ? await db.project.findMany({ where: { ...eligibleProjectWhere(viewerUserId), id: { in: ids.map((row) => row.id) } }, select: projectSelect, orderBy: [{ name: "asc" }, { id: "asc" }] }) : [];
  const projects = records.slice(0, filters.pageSize).map((project) => ({ ...project, relevance: explainProjectRelevance(context, project) }));
  projects.sort((left, right) => compareRelevance(left.relevance, right.relevance) || left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  return { projects, page: filters.page, pageSize: filters.pageSize, hasNext: ids.length > filters.pageSize };
}
export type DiscoverableProject = Awaited<ReturnType<typeof listDiscoverableProjects>>["projects"][number];

function safeLink(value: string | null): string | null {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? value : null; } catch { return null; }
}
export async function getDiscoverableProject(viewerUserId: string, projectId: string) {
  const project = await db.project.findFirst({
    where: { ...eligibleProjectWhere(viewerUserId), id: projectId },
    select: { ...projectSelect, description: true, websiteUrl: true, repositoryUrl: true, demoUrl: true },
  });
  if (!project) return null;
  const context = await getDiscoveryContext(viewerUserId);
  return { ...project, websiteUrl: safeLink(project.websiteUrl), repositoryUrl: safeLink(project.repositoryUrl), demoUrl: safeLink(project.demoUrl), relevance: explainProjectRelevance(context, project) };
}
