import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { projectAccessWhere, participantApplicationAccessWhere } from "@/lib/auth/participant-access";
import { assertActiveOrganizationAccess, AuthorizationError } from "@/lib/auth/authorization";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { normalizeTag } from "@/lib/identity/normalization";
import { evaluateOpportunityRelevance, type OpportunityRelevance } from "@/lib/opportunities/relevance";
import { opportunityWindow } from "@/lib/opportunities/presentation";
import { discoveryMetadataSchema, externalOpportunitySchema, type DiscoveryMetadataInput, type ExternalOpportunityInput, type OpportunityFilters } from "@/lib/opportunities/schemas";

const metadataSelect = { supportType: true, territoryScope: true, territoryLabel: true, eligibleStates: true, audienceTags: true, thematicAreas: true } as const;
const publicCallSelect = {
  id: true, title: true, callNumber: true, objective: true, status: true, publishedAt: true,
  applicationStartsAt: true, applicationEndsAt: true, applicationsEnabled: true, sourceUrl: true, sourceCheckedAt: true,
  totalBudget: true, maximumSupport: true, ...metadataSelect,
  organization: { select: { id: true, name: true } }, fundingProgram: { select: { id: true, name: true } },
} as const satisfies Prisma.FundingCallSelect;
const publicExternalSelect = { id: true, institution: true, callNumber: true, title: true, objective: true, territory: true, audience: true, status: true, publishedAt: true, applicationEndsAt: true, sourceUrl: true, sourceCheckedAt: true, ...metadataSelect } as const satisfies Prisma.OpportunitySelect;
type CallRecord = Prisma.FundingCallGetPayload<{ select: typeof publicCallSelect }>;
type ExternalRecord = Prisma.OpportunityGetPayload<{ select: typeof publicExternalSelect }>;
export type PersonalOpportunityDto = {
  id: string; kind: "INTERNAL" | "EXTERNAL"; title: string; callNumber: string; objective: string | null; institution: string;
  status: string; applicationStartsAt: string | null; applicationEndsAt: string | null; publishedAt: string | null;
  sourceUrl: string | null; sourceCheckedAt: string | null; canApply: boolean; fundingCallId: string | null;
  supportType: string; territoryScope: string; territoryLabel: string | null; eligibleStates: string[]; audienceTags: string[]; thematicAreas: string[];
  territory: string | null; audience: string | null; programName: string | null; saved: boolean; relevance?: OpportunityRelevance;
};
const publicCallWhere: Prisma.FundingCallWhereInput = { publicListingEnabled: true, status: { not: "DRAFT" }, organization: { status: "ACTIVE" } };
const publicExternalWhere: Prisma.OpportunityWhereInput = { publicListingEnabled: true, organization: { status: "ACTIVE" } };
function safeSourceUrl(value: string | null): string | null {
  if (!value) return null;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; }
}

function callDto(call: CallRecord): PersonalOpportunityDto {
  return { id: call.id, kind: "INTERNAL", title: call.title, callNumber: call.callNumber, objective: call.objective, institution: call.organization.name,
    status: call.status, applicationStartsAt: call.applicationStartsAt?.toISOString() ?? null, applicationEndsAt: call.applicationEndsAt?.toISOString() ?? null,
    publishedAt: call.publishedAt?.toISOString() ?? null, sourceUrl: safeSourceUrl(call.sourceUrl), sourceCheckedAt: call.sourceCheckedAt?.toISOString() ?? null,
    canApply: call.applicationsEnabled && opportunityWindow(call.status, call.applicationStartsAt, call.applicationEndsAt) === "OPEN", fundingCallId: call.id,
    supportType: call.supportType, territoryScope: call.territoryScope, territoryLabel: call.territoryLabel, eligibleStates: call.eligibleStates,
    audienceTags: call.audienceTags, thematicAreas: call.thematicAreas, territory: null, audience: null, programName: call.fundingProgram.name, saved: false };
}
function externalDto(entry: ExternalRecord): PersonalOpportunityDto {
  return { id: entry.id, kind: "EXTERNAL", title: entry.title, callNumber: entry.callNumber, objective: entry.objective, institution: entry.institution,
    status: entry.status, applicationStartsAt: null, applicationEndsAt: entry.applicationEndsAt?.toISOString() ?? null, publishedAt: entry.publishedAt?.toISOString() ?? null,
    sourceUrl: safeSourceUrl(entry.sourceUrl), sourceCheckedAt: entry.sourceCheckedAt.toISOString(), canApply: false, fundingCallId: null,
    supportType: entry.supportType, territoryScope: entry.territoryScope, territoryLabel: entry.territoryLabel, eligibleStates: entry.eligibleStates,
    audienceTags: entry.audienceTags, thematicAreas: entry.thematicAreas, territory: entry.territory, audience: entry.audience, programName: null, saved: false };
}

function sharedFilter(filters: OpportunityFilters) {
  return {
    ...(Object.keys({ SUBVENTION: 1, SCHOLARSHIP: 1, CREDIT: 1, RESIDENCY: 1, ACCELERATION: 1, PRIZE: 1, SERVICES: 1, OTHER: 1 }).includes(filters.support ?? "") ? { supportType: filters.support as Prisma.EnumOpportunitySupportTypeFilter["equals"] } : {}),
    ...(["MUNICIPAL", "STATE", "REGIONAL", "NATIONAL", "INTERNATIONAL", "UNSPECIFIED"].includes(filters.territory ?? "") ? { territoryScope: filters.territory as Prisma.EnumOpportunityTerritoryScopeFilter["equals"] } : {}),
    ...(filters.state ? { eligibleStates: { has: filters.state.toUpperCase() } } : {}),
  };
}
function matchesFilter(entry: PersonalOpportunityDto, filters: OpportunityFilters, now: Date): boolean {
  const window = opportunityWindow(entry.status, entry.applicationStartsAt, entry.applicationEndsAt, now);
  if (filters.status === "OPEN" && window !== "OPEN") return false;
  if (filters.status === "UPCOMING" && window !== "UPCOMING") return false;
  if (filters.status === "CLOSED" && window !== "CLOSED") return false;
  if (!filters.status && !["OPEN", "UPCOMING"].includes(window)) return false;
  if (filters.topic && !entry.thematicAreas.some((area) => normalizeTag(area) === normalizeTag(filters.topic!))) return false;
  if (filters.deadline === "7" || filters.deadline === "30") {
    const limit = new Date(now.getTime() + Number(filters.deadline) * 86400000);
    if (!entry.applicationEndsAt || new Date(entry.applicationEndsAt) > limit || window !== "OPEN") return false;
  }
  return !filters.saved || entry.saved;
}
function compareEntries(a: PersonalOpportunityDto, b: PersonalOpportunityDto): number {
  const windowRank = (entry: PersonalOpportunityDto) => ({ OPEN: 0, UPCOMING: 1, CLOSED: 2, OTHER: 3 })[opportunityWindow(entry.status, entry.applicationStartsAt, entry.applicationEndsAt)];
  const relevanceRank = (entry: PersonalOpportunityDto) => entry.relevance?.level === "HIGH" ? 0 : entry.relevance?.level === "COMPATIBLE" ? 1 : 2;
  return windowRank(a) - windowRank(b) || Number(b.saved) - Number(a.saved) || relevanceRank(a) - relevanceRank(b) || (a.applicationEndsAt ?? "9999").localeCompare(b.applicationEndsAt ?? "9999") || a.id.localeCompare(b.id);
}

async function discover(filters: OpportunityFilters): Promise<PersonalOpportunityDto[]> {
  const query = filters.q?.trim().slice(0, 200);
  const metadata = sharedFilter(filters);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const deadline = { OR: [{ applicationEndsAt: null }, { applicationEndsAt: { gte: now } }, { applicationEndsAt: today }] };
  const endsSoon = filters.deadline === "7" || filters.deadline === "30" ? { applicationEndsAt: { lte: new Date(now.getTime() + Number(filters.deadline) * 86400000) } } : {};
  const expired = { applicationEndsAt: { lt: now }, NOT: { applicationEndsAt: today } };
  const callWindow: Prisma.FundingCallWhereInput = filters.status === "ALL" ? {} : filters.status === "CLOSED" ? { AND: [{ OR: [{ status: { in: ["CLOSED", "ARCHIVED", "IN_REVIEW", "RESULT_PUBLISHED"] } }, expired] }] } : { status: "OPEN", AND: [deadline, endsSoon, ...(filters.status === "OPEN" ? [{ OR: [{ applicationStartsAt: null }, { applicationStartsAt: { lte: now } }] }] : filters.status === "UPCOMING" ? [{ applicationStartsAt: { gt: now } }] : [])] };
  const externalWindow: Prisma.OpportunityWhereInput = filters.status === "ALL" ? {} : filters.status === "CLOSED" ? { AND: [{ OR: [{ status: { in: ["CLOSED", "ARCHIVED", "IN_REVIEW", "RESULT_PUBLISHED"] } }, expired] }] } : { status: filters.status === "OPEN" ? "OPEN" : filters.status === "UPCOMING" ? "UPCOMING" : { in: ["OPEN", "UPCOMING"] }, AND: [deadline, endsSoon] };
  const [calls, external] = await Promise.all([
    filters.source === "EXTERNAL" ? [] : db.fundingCall.findMany({ where: { ...publicCallWhere, ...callWindow, ...metadata, ...(query ? { OR: [{ title: { contains: query, mode: "insensitive" } }, { callNumber: { contains: query, mode: "insensitive" } }, { organization: { name: { contains: query, mode: "insensitive" } } }] } : {}) }, select: publicCallSelect, take: 150, orderBy: [{ applicationEndsAt: "asc" }, { id: "asc" }] }),
    filters.source === "INTERNAL" ? [] : db.opportunity.findMany({ where: { ...publicExternalWhere, ...externalWindow, ...metadata, ...(query ? { OR: [{ title: { contains: query, mode: "insensitive" } }, { institution: { contains: query, mode: "insensitive" } }, { callNumber: { contains: query, mode: "insensitive" } }] } : {}) }, select: publicExternalSelect, take: 150, orderBy: [{ applicationEndsAt: "asc" }, { id: "asc" }] }),
  ]);
  return [...calls.map(callDto), ...external.map(externalDto)];
}
export async function listPublicOpportunities(filters: OpportunityFilters = {}) {
  return (await discover(filters)).filter((entry) => matchesFilter(entry, filters, new Date())).sort(compareEntries).slice(0, 150);
}
export async function listPersonalOpportunities(userId: string, searchOrFilters: string | OpportunityFilters = "") {
  const filters = typeof searchOrFilters === "string" ? { q: searchOrFilters } : searchOrFilters;
  const [records, profile, project, savedCalls, savedExternal] = await Promise.all([
    discover(filters), db.innovationProfile.findUnique({ where: { userId }, select: { state: true, topics: { select: { label: true, type: true }, orderBy: [{ position: "asc" }, { id: "asc" }] } } }),
    filters.projectId ? db.project.findFirst({ where: { id: filters.projectId, ...projectAccessWhere(userId) }, select: { thematicAreas: true } }) : null,
    db.savedFundingCall.findMany({ where: { userId }, select: { fundingCallId: true }, take: 1000 }), db.savedExternalOpportunity.findMany({ where: { userId }, select: { opportunityId: true }, take: 1000 }),
  ]);
  if (filters.projectId && !project) throw new ResourceNotFoundError("PROJECT_NOT_FOUND");
  const calls = new Set(savedCalls.map((entry) => entry.fundingCallId)); const external = new Set(savedExternal.map((entry) => entry.opportunityId));
  return records.map((entry) => ({ ...entry, saved: (entry.kind === "INTERNAL" ? calls : external).has(entry.id), relevance: evaluateOpportunityRelevance({ profile, project, opportunity: entry }) })).filter((entry) => matchesFilter(entry, filters, new Date())).sort(compareEntries).slice(0, 150);
}
const documentSelect = { id: true, title: true, type: true, externalUrl: true, publishedAt: true } as const;
async function readCall(where: Prisma.FundingCallWhereInput) {
  const call = await db.fundingCall.findFirst({ where, select: { ...publicCallSelect, documents: { where: { publicListingEnabled: true, publishedAt: { lte: new Date() } }, select: documentSelect, orderBy: [{ publishedAt: "asc" }, { id: "asc" }] } } });
  return call ? { ...callDto(call), organization: call.organization, fundingProgram: call.fundingProgram, applicationsEnabled: call.applicationsEnabled, totalBudget: call.totalBudget?.toFixed(2) ?? null, maximumSupport: call.maximumSupport?.toFixed(2) ?? null, documents: call.documents.filter((document) => safeSourceUrl(document.externalUrl)).map((document) => ({ ...document, externalUrl: safeSourceUrl(document.externalUrl)!, publishedAt: document.publishedAt?.toISOString() ?? null })) } : null;
}
export function getPublicOpportunity(callId: string) { return readCall({ id: callId, ...publicCallWhere }); }
export async function getPersonalOpportunity(userId: string, callId: string) {
  const applicationAccess = await participantApplicationAccessWhere(userId);
  const call = await readCall({ id: callId, organization: { status: "ACTIVE" }, OR: [{ publicListingEnabled: true, status: { not: "DRAFT" } }, { applications: { some: applicationAccess } }] });
  if (!call) return null;
  const saved = await db.savedFundingCall.findUnique({ where: { userId_fundingCallId: { userId, fundingCallId: callId } }, select: { id: true } });
  return { ...call, saved: Boolean(saved) };
}

export async function setSavedOpportunity(userId: string, kind: "INTERNAL" | "EXTERNAL", id: string, saved: boolean) {
  if (!saved) {
    if (kind === "INTERNAL") await db.savedFundingCall.deleteMany({ where: { userId, fundingCallId: id } });
    else await db.savedExternalOpportunity.deleteMany({ where: { userId, opportunityId: id } });
    return { saved: false };
  }
  return db.$transaction(async (transaction) => {
    if (kind === "INTERNAL") {
      await transaction.$queryRaw`SELECT "id" FROM "FundingCall" WHERE "id" = ${id} FOR SHARE`;
      if (!await transaction.fundingCall.findFirst({ where: { id, ...publicCallWhere }, select: { id: true } })) throw new ResourceNotFoundError("OPPORTUNITY_UNAVAILABLE");
      await transaction.savedFundingCall.upsert({ where: { userId_fundingCallId: { userId, fundingCallId: id } }, create: { userId, fundingCallId: id }, update: {} });
    } else {
      await transaction.$queryRaw`SELECT "id" FROM "Opportunity" WHERE "id" = ${id} FOR SHARE`;
      if (!await transaction.opportunity.findFirst({ where: { id, ...publicExternalWhere }, select: { id: true } })) throw new ResourceNotFoundError("OPPORTUNITY_UNAVAILABLE");
      await transaction.savedExternalOpportunity.upsert({ where: { userId_opportunityId: { userId, opportunityId: id } }, create: { userId, opportunityId: id }, update: {} });
    }
    return { saved: true };
  });
}
export type SavedOpportunity = { id: string; kind: "INTERNAL" | "EXTERNAL"; savedAt: string; opportunity: PersonalOpportunityDto | null };
export async function listSavedOpportunities(userId: string): Promise<SavedOpportunity[]> {
  const [calls, external, profile] = await Promise.all([
    db.savedFundingCall.findMany({ where: { userId }, select: { fundingCallId: true, createdAt: true }, take: 1000, orderBy: [{ createdAt: "desc" }, { id: "asc" }] }),
    db.savedExternalOpportunity.findMany({ where: { userId }, select: { opportunityId: true, createdAt: true }, take: 1000, orderBy: [{ createdAt: "desc" }, { id: "asc" }] }),
    db.innovationProfile.findUnique({ where: { userId }, select: { state: true, topics: { select: { label: true, type: true }, orderBy: [{ position: "asc" }, { id: "asc" }] } } }),
  ]);
  const [visibleCalls, visibleExternal] = await Promise.all([
    db.fundingCall.findMany({ where: { id: { in: calls.map((entry) => entry.fundingCallId) }, ...publicCallWhere }, select: publicCallSelect }),
    db.opportunity.findMany({ where: { id: { in: external.map((entry) => entry.opportunityId) }, ...publicExternalWhere }, select: publicExternalSelect }),
  ]);
  const byCall = new Map(visibleCalls.map((entry) => [entry.id, callDto(entry)])); const byExternal = new Map(visibleExternal.map((entry) => [entry.id, externalDto(entry)]));
  return [...calls.map((entry) => ({ id: entry.fundingCallId, kind: "INTERNAL" as const, savedAt: entry.createdAt.toISOString(), opportunity: byCall.get(entry.fundingCallId) ?? null })), ...external.map((entry) => ({ id: entry.opportunityId, kind: "EXTERNAL" as const, savedAt: entry.createdAt.toISOString(), opportunity: byExternal.get(entry.opportunityId) ?? null }))].sort((a, b) => (a.opportunity?.applicationEndsAt ?? "9999").localeCompare(b.opportunity?.applicationEndsAt ?? "9999") || b.savedAt.localeCompare(a.savedAt)).map((entry) => ({ ...entry, opportunity: entry.opportunity ? { ...entry.opportunity, saved: true, relevance: evaluateOpportunityRelevance({ profile, opportunity: entry.opportunity }) } : null }));
}

async function requireManager(transaction: Prisma.TransactionClient, userId: string, organizationId: string) {
  await transaction.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR SHARE`;
  await transaction.$queryRaw`SELECT "id" FROM "OrganizationMembership" WHERE "organizationId" = ${organizationId} AND "userId" = ${userId} FOR SHARE`;
  const membership = await transaction.organizationMembership.findFirst({ where: { organizationId, userId }, select: { role: true, status: true, organization: { select: { status: true } } } });
  if (!membership) throw new AuthorizationError("ORGANIZATION_ACCESS_DENIED");
  assertActiveOrganizationAccess({ organizationStatus: membership.organization.status, membershipStatus: membership.status, role: membership.role, minimumRole: "MANAGER" });
}
export async function updateFundingCallDiscovery(userId: string, organizationId: string, programId: string, callId: string, rawInput: DiscoveryMetadataInput) {
  const input = discoveryWriteData(discoveryMetadataSchema.parse(rawInput));
  await db.$transaction(async (transaction) => {
    await requireManager(transaction, userId, organizationId);
    await transaction.$queryRaw`SELECT "id" FROM "FundingCall" WHERE "organizationId" = ${organizationId} AND "id" = ${callId} FOR UPDATE`;
    const record = await transaction.fundingCall.findFirst({ where: { organizationId, fundingProgramId: programId, id: callId }, select: { id: true, status: true } });
    if (!record) throw new ResourceNotFoundError("FUNDING_CALL_NOT_FOUND");
    if (input.publicListingEnabled && record.status === "DRAFT") throw new DomainConflictError("FUNDING_CALL_PUBLICATION_REQUIRES_VISIBLE_STATUS");
    await transaction.fundingCall.updateMany({ where: { organizationId, fundingProgramId: programId, id: callId }, data: input });
  });
}
export async function saveExternalOpportunity(userId: string, organizationId: string, id: string | null, rawInput: ExternalOpportunityInput) {
  const parsed = externalOpportunitySchema.parse(rawInput);
  const input = { ...discoveryWriteData(parsed), institution: parsed.institution, callNumber: parsed.callNumber, title: parsed.title, objective: parsed.objective, territory: parsed.territory, audience: parsed.audience, status: parsed.status, publishedAt: parsed.publishedAt, applicationEndsAt: parsed.applicationEndsAt, sourceUrl: parsed.sourceUrl, sourceCheckedAt: parsed.sourceCheckedAt };
  return db.$transaction(async (transaction) => {
    await requireManager(transaction, userId, organizationId);
    if (id) {
      if (!await transaction.opportunity.findFirst({ where: { organizationId, id }, select: { id: true } })) throw new ResourceNotFoundError("OPPORTUNITY_NOT_FOUND");
      await transaction.opportunity.updateMany({ where: { organizationId, id }, data: input });
      return { id };
    }
    return transaction.opportunity.create({ data: { ...input, organizationId }, select: { id: true } });
  });
}
export async function listInstitutionOpportunities(organizationId: string) {
  return db.opportunity.findMany({ where: { organizationId }, select: { ...publicExternalSelect, publicListingEnabled: true }, take: 300, orderBy: [{ applicationEndsAt: "asc" }, { id: "asc" }] });
}
export type InstitutionOpportunity = Awaited<ReturnType<typeof listInstitutionOpportunities>>[number];

function discoveryWriteData(input: DiscoveryMetadataInput) {
  return { publicListingEnabled: input.publicListingEnabled, supportType: input.supportType, territoryScope: input.territoryScope, territoryLabel: input.territoryLabel, eligibleStates: input.eligibleStates, audienceTags: input.audienceTags, thematicAreas: input.thematicAreas };
}

export async function updateCallDocumentVisibility(userId: string, organizationId: string, programId: string, callId: string, documentId: string, publicListingEnabled: boolean, publishedAt?: Date | null) {
  await db.$transaction(async (transaction) => {
    await requireManager(transaction, userId, organizationId);
    await transaction.$queryRaw`SELECT "id" FROM "FundingCall" WHERE "organizationId" = ${organizationId} AND "id" = ${callId} FOR UPDATE`;
    const document = await transaction.fundingCallDocument.findFirst({ where: { id: documentId, organizationId, fundingCallId: callId, fundingCall: { fundingProgramId: programId } }, select: { publishedAt: true } });
    if (!document) throw new ResourceNotFoundError("FUNDING_CALL_DOCUMENT_NOT_FOUND");
    const publication = publishedAt === undefined ? document.publishedAt : publishedAt;
    if (publicListingEnabled && !publication) throw new DomainConflictError("DOCUMENT_PUBLICATION_DATE_REQUIRED");
    await transaction.fundingCallDocument.updateMany({ where: { id: documentId, organizationId, fundingCallId: callId }, data: { publicListingEnabled, ...(publishedAt !== undefined ? { publishedAt } : {}) } });
  });
}
