import { Prisma } from "@prisma/client";

// The caller aliases Application as a. Frozen team and membership intervals govern historical access, regardless of current status.
export function submittedApplicationParticipantsSql() {
  return Prisma.sql`
    SELECT a."submittedByUserId" AS "userId"
    UNION
    SELECT membership."userId" FROM "ProjectMembership" membership WHERE membership."projectId" = a."projectId"
      AND membership."joinedAt" <= a."submittedAt" AND (membership."leftAt" IS NULL OR membership."leftAt" > a."submittedAt")
    UNION
    SELECT membership."userId" FROM "TeamMembership" membership WHERE membership."teamId" = a."teamId"
      AND membership."joinedAt" <= a."submittedAt" AND (membership."leftAt" IS NULL OR membership."leftAt" > a."submittedAt")
  `;
}

export type HistoricalRecipient = { applicationId: string; userId: string };
export function historicalApplicationRecipientPage(client: Prisma.TransactionClient, organizationId: string, callId: string, after?: HistoricalRecipient) {
  return client.$queryRaw<HistoricalRecipient[]>(Prisma.sql`
    SELECT a."id" AS "applicationId", participant."userId" FROM "Application" a
    CROSS JOIN LATERAL (${submittedApplicationParticipantsSql()}) participant
    WHERE a."organizationId" = ${organizationId} AND a."fundingCallId" = ${callId}
      AND a."submittedAt" IS NOT NULL AND a."status" NOT IN ('DRAFT', 'WITHDRAWN')
      ${after ? Prisma.sql`AND (a."id", participant."userId") > (${after.applicationId}, ${after.userId})` : Prisma.empty}
    ORDER BY a."id", participant."userId" LIMIT 100
  `);
}
