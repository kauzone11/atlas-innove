BEGIN;

-- Each row represents one period; only current periods are unique.
CREATE UNIQUE INDEX "TeamMembership_current_period_key"
ON "TeamMembership" ("teamId", "userId")
WHERE "status" = 'ACTIVE' AND "leftAt" IS NULL;

CREATE UNIQUE INDEX "ProjectMembership_current_period_key"
ON "ProjectMembership" ("projectId", "userId")
WHERE "leftAt" IS NULL;

CREATE INDEX "TeamMembership_teamId_userId_idx" ON "TeamMembership" ("teamId", "userId");
CREATE INDEX "ProjectMembership_projectId_userId_idx" ON "ProjectMembership" ("projectId", "userId");

DROP INDEX "TeamMembership_teamId_userId_key";
DROP INDEX "ProjectMembership_projectId_userId_key";

COMMIT;
