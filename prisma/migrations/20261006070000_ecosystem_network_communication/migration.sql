-- CreateEnum
CREATE TYPE "CollaborationStatus" AS ENUM ('OPEN', 'SELECTIVE', 'NOT_AVAILABLE');

-- CreateEnum
CREATE TYPE "NetworkRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('CONNECTION_REQUEST', 'CONNECTION_ACCEPTED', 'TEAM_INVITE', 'TEAM_INVITE_ACCEPTED', 'PROJECT_INVITE', 'PROJECT_INVITE_ACCEPTED', 'PROJECT_COLLABORATION_REQUEST', 'PROJECT_COLLABORATION_ACCEPTED', 'PROJECT_TASK_ASSIGNED', 'PROJECT_DISCUSSION', 'PROJECT_MENTION', 'APPLICATION_RESULT', 'AWARD_STATUS_CHANGED', 'AWARD_REVIEW_CHANGES_REQUESTED', 'AWARD_REVIEW_APPROVED', 'DIRECT_MESSAGE');

-- CreateEnum
CREATE TYPE "ProjectDiscussionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "SafetyReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'IMPERSONATION', 'INAPPROPRIATE_CONTENT', 'OTHER');

-- CreateEnum
CREATE TYPE "SafetyReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED', 'ACTIONED');

-- AlterTable
ALTER TABLE "InnovationProfile" ADD COLUMN     "collaborationNote" TEXT,
ADD COLUMN     "collaborationStatus" "CollaborationStatus" NOT NULL DEFAULT 'NOT_AVAILABLE',
ADD COLUMN     "directoryEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TeamInvite" ADD COLUMN     "declinedAt" TIMESTAMP(3),
ADD COLUMN     "invitedUserId" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "collaborationNote" TEXT,
ADD COLUMN     "collaborationOpen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "directoryEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ConnectionRequest" (
    "id" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "message" TEXT,
    "status" "NetworkRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "ConnectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkConnection" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "sourceRequestId" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endedByUserId" TEXT,

    CONSTRAINT "NetworkConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCollaborationRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "message" TEXT,
    "status" "NetworkRequestStatus" NOT NULL DEFAULT 'PENDING',
    "respondedByUserId" TEXT,
    "respondedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectCollaborationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectInvite" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "invitedUserId" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL DEFAULT 'MEMBER',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBlock" (
    "blockerUserId" TEXT NOT NULL,
    "blockedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("blockerUserId","blockedUserId")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "kind" "NotificationKind" NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3),

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("conversationId","userId")
);

-- CreateTable
CREATE TABLE "DirectMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDiscussion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ProjectDiscussionStatus" NOT NULL DEFAULT 'OPEN',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDiscussion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDiscussionMessage" (
    "id" TEXT NOT NULL,
    "discussionId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectDiscussionMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDiscussionSubscription" (
    "discussionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectDiscussionSubscription_pkey" PRIMARY KEY ("discussionId","userId")
);

-- CreateTable
CREATE TABLE "SafetyReport" (
    "id" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "reportedUserId" TEXT NOT NULL,
    "conversationId" TEXT,
    "messageId" TEXT,
    "reason" "SafetyReportReason" NOT NULL,
    "details" TEXT,
    "status" "SafetyReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,

    CONSTRAINT "SafetyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConnectionRequest_recipientUserId_status_createdAt_idx" ON "ConnectionRequest"("recipientUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ConnectionRequest_requesterUserId_createdAt_idx" ON "ConnectionRequest"("requesterUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkConnection_sourceRequestId_key" ON "NetworkConnection"("sourceRequestId");

-- CreateIndex
CREATE INDEX "NetworkConnection_userAId_endedAt_connectedAt_idx" ON "NetworkConnection"("userAId", "endedAt", "connectedAt");

-- CreateIndex
CREATE INDEX "NetworkConnection_userBId_endedAt_connectedAt_idx" ON "NetworkConnection"("userBId", "endedAt", "connectedAt");

-- CreateIndex
CREATE INDEX "ProjectCollaborationRequest_projectId_status_createdAt_idx" ON "ProjectCollaborationRequest"("projectId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectCollaborationRequest_requesterUserId_createdAt_idx" ON "ProjectCollaborationRequest"("requesterUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectInvite_invitedUserId_expiresAt_idx" ON "ProjectInvite"("invitedUserId", "expiresAt");

-- CreateIndex
CREATE INDEX "ProjectInvite_projectId_expiresAt_idx" ON "ProjectInvite"("projectId", "expiresAt");

-- CreateIndex
CREATE INDEX "ProjectInvite_invitedByUserId_createdAt_idx" ON "ProjectInvite"("invitedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "UserBlock_blockedUserId_idx" ON "UserBlock"("blockedUserId");

-- CreateIndex
CREATE INDEX "Notification_recipientUserId_archivedAt_createdAt_id_idx" ON "Notification"("recipientUserId", "archivedAt", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Notification_recipientUserId_readAt_archivedAt_idx" ON "Notification"("recipientUserId", "readAt", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_recipientUserId_dedupeKey_key" ON "Notification"("recipientUserId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_userAId_userBId_key" ON "Conversation"("userAId", "userBId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_archivedAt_conversationId_idx" ON "ConversationParticipant"("userId", "archivedAt", "conversationId");

-- CreateIndex
CREATE INDEX "DirectMessage_conversationId_createdAt_id_idx" ON "DirectMessage"("conversationId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "DirectMessage_senderUserId_createdAt_idx" ON "DirectMessage"("senderUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectDiscussion_projectId_updatedAt_id_idx" ON "ProjectDiscussion"("projectId", "updatedAt", "id");

-- CreateIndex
CREATE INDEX "ProjectDiscussion_createdByUserId_createdAt_idx" ON "ProjectDiscussion"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectDiscussionMessage_discussionId_createdAt_id_idx" ON "ProjectDiscussionMessage"("discussionId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ProjectDiscussionMessage_authorUserId_createdAt_idx" ON "ProjectDiscussionMessage"("authorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "SafetyReport_status_createdAt_id_idx" ON "SafetyReport"("status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "SafetyReport_reporterUserId_createdAt_idx" ON "SafetyReport"("reporterUserId", "createdAt");

-- CreateIndex
CREATE INDEX "InnovationProfile_directoryEnabled_profileVisibility_collab_idx" ON "InnovationProfile"("directoryEnabled", "profileVisibility", "collaborationStatus", "userId");

-- CreateIndex
CREATE INDEX "TeamInvite_invitedByUserId_createdAt_idx" ON "TeamInvite"("invitedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "TeamInvite_invitedUserId_expiresAt_idx" ON "TeamInvite"("invitedUserId", "expiresAt");

-- CreateIndex
CREATE INDEX "Project_directoryEnabled_visibility_archivedAt_status_id_idx" ON "Project"("directoryEnabled", "visibility", "archivedAt", "status", "id");

-- AddForeignKey
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionRequest" ADD CONSTRAINT "ConnectionRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionRequest" ADD CONSTRAINT "ConnectionRequest_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkConnection" ADD CONSTRAINT "NetworkConnection_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkConnection" ADD CONSTRAINT "NetworkConnection_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkConnection" ADD CONSTRAINT "NetworkConnection_sourceRequestId_fkey" FOREIGN KEY ("sourceRequestId") REFERENCES "ConnectionRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkConnection" ADD CONSTRAINT "NetworkConnection_endedByUserId_fkey" FOREIGN KEY ("endedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCollaborationRequest" ADD CONSTRAINT "ProjectCollaborationRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCollaborationRequest" ADD CONSTRAINT "ProjectCollaborationRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCollaborationRequest" ADD CONSTRAINT "ProjectCollaborationRequest_respondedByUserId_fkey" FOREIGN KEY ("respondedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInvite" ADD CONSTRAINT "ProjectInvite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInvite" ADD CONSTRAINT "ProjectInvite_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInvite" ADD CONSTRAINT "ProjectInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerUserId_fkey" FOREIGN KEY ("blockerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedUserId_fkey" FOREIGN KEY ("blockedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDiscussion" ADD CONSTRAINT "ProjectDiscussion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDiscussion" ADD CONSTRAINT "ProjectDiscussion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDiscussionMessage" ADD CONSTRAINT "ProjectDiscussionMessage_discussionId_fkey" FOREIGN KEY ("discussionId") REFERENCES "ProjectDiscussion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDiscussionMessage" ADD CONSTRAINT "ProjectDiscussionMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDiscussionSubscription" ADD CONSTRAINT "ProjectDiscussionSubscription_discussionId_fkey" FOREIGN KEY ("discussionId") REFERENCES "ProjectDiscussion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDiscussionSubscription" ADD CONSTRAINT "ProjectDiscussionSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyReport" ADD CONSTRAINT "SafetyReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyReport" ADD CONSTRAINT "SafetyReport_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyReport" ADD CONSTRAINT "SafetyReport_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyReport" ADD CONSTRAINT "SafetyReport_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "DirectMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyReport" ADD CONSTRAINT "SafetyReport_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Canonical pairs and partial uniqueness preserve ended periods and prevent crossed pending requests.
ALTER TABLE "ConnectionRequest" ADD CONSTRAINT "ConnectionRequest_pair_check" CHECK (
  "userAId" < "userBId" AND "requesterUserId" <> "recipientUserId" AND
  (("requesterUserId" = "userAId" AND "recipientUserId" = "userBId") OR
   ("requesterUserId" = "userBId" AND "recipientUserId" = "userAId"))
);
CREATE UNIQUE INDEX "ConnectionRequest_pending_pair_key" ON "ConnectionRequest"("userAId", "userBId") WHERE "status" = 'PENDING';
ALTER TABLE "NetworkConnection" ADD CONSTRAINT "NetworkConnection_pair_check" CHECK ("userAId" < "userBId");
CREATE UNIQUE INDEX "NetworkConnection_active_pair_key" ON "NetworkConnection"("userAId", "userBId") WHERE "endedAt" IS NULL;
CREATE UNIQUE INDEX "ProjectCollaborationRequest_pending_key" ON "ProjectCollaborationRequest"("projectId", "requesterUserId") WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "ProjectInvite_pending_target_key" ON "ProjectInvite"("projectId", "invitedUserId") WHERE "acceptedAt" IS NULL AND "declinedAt" IS NULL AND "revokedAt" IS NULL;
CREATE UNIQUE INDEX "TeamInvite_pending_target_key" ON "TeamInvite"("teamId", "invitedUserId") WHERE "invitedUserId" IS NOT NULL AND "acceptedAt" IS NULL AND "declinedAt" IS NULL AND "revokedAt" IS NULL;
ALTER TABLE "ProjectInvite" ADD CONSTRAINT "ProjectInvite_role_check" CHECK ("role" <> 'OWNER');
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_no_self_check" CHECK ("blockerUserId" <> "blockedUserId");
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_pair_check" CHECK ("userAId" < "userBId");
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_body_check" CHECK (length(trim("body")) BETWEEN 1 AND 4000);
ALTER TABLE "ProjectDiscussionMessage" ADD CONSTRAINT "ProjectDiscussionMessage_body_check" CHECK (length(trim("body")) BETWEEN 1 AND 4000);
ALTER TABLE "SafetyReport" ADD CONSTRAINT "SafetyReport_no_self_check" CHECK ("reporterUserId" <> "reportedUserId");
ALTER TABLE "Project" ADD CONSTRAINT "Project_collaboration_directory_check" CHECK (NOT "collaborationOpen" OR "directoryEnabled");
ALTER TABLE "InnovationProfile" ADD CONSTRAINT "InnovationProfile_directory_identity_check" CHECK (NOT "directoryEnabled" OR (COALESCE(length(btrim("handle")), 0) > 0 AND COALESCE(length(btrim("headline")), 0) > 0));
ALTER TABLE "Project" ADD CONSTRAINT "Project_directory_identity_check" CHECK (NOT "directoryEnabled" OR (length(btrim("name")) > 0 AND length(btrim("summary")) > 0));
