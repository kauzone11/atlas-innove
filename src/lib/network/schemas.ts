import { z } from "zod";

export const networkUserIdSchema = z.string().trim().min(1).max(128);
const message = z.string().trim().max(500).nullable().optional();
export const connectionRequestSchema = z.object({ recipientUserId: networkUserIdSchema, message }).strict();
export const requestActionSchema = z.object({ action: z.enum(["accept", "decline", "cancel"]) }).strict();
export const projectRequestSchema = z.object({ message }).strict();
export const targetedInviteSchema = z.object({ invitedUserId: networkUserIdSchema, role: z.enum(["LEAD", "MEMBER"]).default("MEMBER") }).strict();
export const inviteActionSchema = z.object({ action: z.enum(["accept", "decline", "revoke"]) }).strict();
export const blockSchema = z.object({ blockedUserId: networkUserIdSchema }).strict();
