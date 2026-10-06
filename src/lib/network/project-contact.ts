import { Prisma } from "@prisma/client";

// Discovery and contact authorization use the same current managers, including the active primary team.
export function projectManagersSql(projectId: Prisma.Sql) {
  return Prisma.sql`
    SELECT membership."userId" FROM "ProjectMembership" membership
    WHERE membership."projectId" = ${projectId} AND membership."leftAt" IS NULL AND membership."role" IN ('OWNER', 'LEAD')
    UNION
    SELECT membership."userId" FROM "Project" project
    JOIN "Team" team ON team."id" = project."primaryTeamId" AND team."archivedAt" IS NULL
    JOIN "TeamMembership" membership ON membership."teamId" = team."id"
    WHERE project."id" = ${projectId} AND membership."leftAt" IS NULL AND membership."status" = 'ACTIVE' AND membership."role" IN ('OWNER', 'LEAD')
  `;
}

export function projectContactAllowedSql(projectId: Prisma.Sql, viewerUserId: string) {
  return Prisma.sql`NOT EXISTS (
    SELECT 1 FROM (${projectManagersSql(projectId)}) manager JOIN "UserBlock" block ON
      (block."blockerUserId" = ${viewerUserId} AND block."blockedUserId" = manager."userId") OR
      (block."blockedUserId" = ${viewerUserId} AND block."blockerUserId" = manager."userId")
  )`;
}

export async function projectManagerIds(client: Prisma.TransactionClient, projectId: string) {
  const managers = await client.$queryRaw<Array<{ userId: string }>>(Prisma.sql`${projectManagersSql(Prisma.sql`${projectId}`)} ORDER BY "userId"`);
  return managers.map((manager) => manager.userId);
}
