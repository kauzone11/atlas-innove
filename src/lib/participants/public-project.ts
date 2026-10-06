import { db } from "@/lib/db";
import { publicHandleSchema } from "@/lib/identity/normalization";

export async function getPublicProject(slug: string) {
  const parsed = publicHandleSchema.safeParse(slug);
  if (!parsed.success) return null;
  const project = await db.project.findFirst({
    where: { publicSlug: parsed.data, visibility: "PUBLIC", publishedAt: { not: null }, archivedAt: null, status: { not: "ARCHIVED" } },
    select: {
      id: true, publicSlug: true, name: true, summary: true, description: true, status: true,
      thematicAreas: true, websiteUrl: true, repositoryUrl: true, demoUrl: true,
      applications: {
        where: { submittedAt: { not: null }, decision: "SELECTED", fundingCall: { publicListingEnabled: true, resultsPublishedAt: { not: null }, organization: { status: "ACTIVE" } } },
        select: { id: true, fundingCall: { select: { id: true, title: true, resultsPublishedAt: true, organization: { select: { name: true } }, fundingProgram: { select: { name: true } } } } },
        orderBy: [{ submittedAt: "desc" }, { id: "asc" }],
      },
    },
  });
  if (!project) return null;
  return {
    id: project.id, slug: project.publicSlug!, name: project.name, summary: project.summary, description: project.description,
    status: project.status, thematicAreas: project.thematicAreas, websiteUrl: project.websiteUrl, repositoryUrl: project.repositoryUrl, demoUrl: project.demoUrl,
    participations: project.applications.map((application) => ({ id: application.id, institution: application.fundingCall.organization.name, program: application.fundingCall.fundingProgram.name, call: application.fundingCall.title, callUrl: `/opportunities/calls/${application.fundingCall.id}`, date: application.fundingCall.resultsPublishedAt!.toISOString() })),
  };
}

export type PublicProjectDto = NonNullable<Awaited<ReturnType<typeof getPublicProject>>>;
