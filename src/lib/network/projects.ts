import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeTag } from "@/lib/identity/normalization";
import { getDiscoveryContext } from "@/lib/network/discovery-context";
import { projectDiscoverySchema } from "@/lib/network/discovery-schemas";
import { explainProjectRelevance } from "@/lib/network/relevance";
import { matchesTopicsSql, normalizedTagSql } from "@/lib/network/discovery-sql";
import { projectContactAllowedSql } from "@/lib/network/project-contact";

const projectSelect = {
  id: true, name: true, summary: true, status: true, thematicAreas: true,
  collaborationOpen: true, collaborationNote: true,
} satisfies Prisma.ProjectSelect;
function eligibleProjectWhere(): Prisma.ProjectWhereInput {
  return {
    directoryEnabled: true, visibility: { in: ["PUBLIC", "PLATFORM"] }, archivedAt: null, status: { not: "ARCHIVED" },
  };
}
export async function listDiscoverableProjects(viewerUserId: string, value: unknown = {}) {
  const filters = projectDiscoverySchema.parse(value);
  const context = await getDiscoveryContext(viewerUserId);
  const normalizedTopic = normalizedTagSql(Prisma.sql`topic.label`);
  const conditions: Prisma.Sql[] = [];
  if (filters.status) conditions.push(Prisma.sql`p."status"::text = ${filters.status}`);
  if (filters.collaborationOpen) conditions.push(Prisma.sql`p."collaborationOpen" = ${filters.collaborationOpen === "true"}`);
  if (filters.q) conditions.push(Prisma.sql`(strpos(lower(p."name"), lower(${filters.q})) > 0 OR strpos(lower(p."summary"), lower(${filters.q})) > 0 OR EXISTS (SELECT 1 FROM unnest(p."thematicAreas") AS topic(label) WHERE strpos(${normalizedTopic}, ${normalizeTag(filters.q) || "__invalid_topic__"}) > 0))`);
  if (filters.topic) conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM unnest(p."thematicAreas") AS topic(label) WHERE strpos(${normalizedTopic}, ${normalizeTag(filters.topic) || "__invalid_topic__"}) > 0)`);
  const topicSignal = (topics: string[]) => Prisma.sql`EXISTS (SELECT 1 FROM unnest(p."thematicAreas") AS topic(label) WHERE ${matchesTopicsSql(normalizedTopic, topics)})`;
  const signals = Prisma.sql`(${topicSignal(context.skills)})::int + (${topicSignal(context.interests)})::int`;
  const ids = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT p."id" FROM "Project" p
      WHERE p."directoryEnabled" = true AND p."visibility" IN ('PUBLIC', 'PLATFORM')
        AND p."archivedAt" IS NULL AND p."status" != 'ARCHIVED'
        AND ${projectContactAllowedSql(Prisma.sql`p."id"`, viewerUserId)}
        ${conditions.length ? Prisma.sql`AND ${Prisma.join(conditions, " AND ")}` : Prisma.empty}
      ORDER BY LEAST(2, (${signals}) + ((${signals}) > 0 AND p."collaborationOpen")::int) DESC,
        p."name" COLLATE "C", p."id" COLLATE "C" LIMIT ${filters.pageSize + 1} OFFSET ${(filters.page - 1) * filters.pageSize}
    `);
  const records = ids.length ? await db.project.findMany({ where: { ...eligibleProjectWhere(), id: { in: ids.slice(0, filters.pageSize).map((row) => row.id) } }, select: projectSelect }) : [];
  const positions = new Map(ids.map((row, index) => [row.id, index]));
  records.sort((left, right) => positions.get(left.id)! - positions.get(right.id)!);
  const projects = records.map((project) => ({ ...project, relevance: explainProjectRelevance(context, project) }));
  return { projects, page: filters.page, pageSize: filters.pageSize, hasNext: ids.length > filters.pageSize };
}
export type DiscoverableProject = Awaited<ReturnType<typeof listDiscoverableProjects>>["projects"][number];

function safeLink(value: string | null): string | null {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? value : null; } catch { return null; }
}
export async function getDiscoverableProject(viewerUserId: string, projectId: string) {
  const [contact] = await db.$queryRaw<Array<{ allowed: boolean }>>(Prisma.sql`SELECT ${projectContactAllowedSql(Prisma.sql`${projectId}`, viewerUserId)} AS allowed`);
  if (!contact.allowed) return null;
  const project = await db.project.findFirst({
    where: { ...eligibleProjectWhere(), id: projectId },
    select: { ...projectSelect, description: true, websiteUrl: true, repositoryUrl: true, demoUrl: true },
  });
  if (!project) return null;
  const context = await getDiscoveryContext(viewerUserId);
  return { ...project, websiteUrl: safeLink(project.websiteUrl), repositoryUrl: safeLink(project.repositoryUrl), demoUrl: safeLink(project.demoUrl), relevance: explainProjectRelevance(context, project) };
}
