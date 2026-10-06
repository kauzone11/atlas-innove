import assert from "node:assert/strict";
import test from "node:test";
import { boundedPage, createConversationSchema, createDiscussionSchema, messageBodySchema, safetyReportSchema, sendMessageSchema } from "@/lib/communication/schemas";

test("communication inputs bound plain text and reject arbitrary sender, recipient and mention fields", () => {
  assert.equal(messageBodySchema.parse("  Uma colaboração possível.  "), "Uma colaboração possível.");
  assert.equal(messageBodySchema.safeParse(" ").success, false);
  assert.equal(messageBodySchema.safeParse("x".repeat(4001)).success, false);
  assert.equal(sendMessageSchema.safeParse({ body: "Olá", senderUserId: "other" }).success, false);
  assert.equal(sendMessageSchema.safeParse({ body: "Olá", recipientUserId: "other" }).success, false);
  assert.equal(createDiscussionSchema.safeParse({ title: "Assunto", body: "Olá", mentionedUserIds: ["other"] }).success, false);
  assert.equal(createConversationSchema.safeParse({ otherUserId: "other", participants: ["third"] }).success, false);
});

test("safety evidence requires a conversation for a message and limits disclosure payload", () => {
  assert.equal(safetyReportSchema.safeParse({ reportedUserId: "other", reason: "SPAM", messageId: "message" }).success, false);
  assert.equal(safetyReportSchema.safeParse({ reportedUserId: "other", reason: "SPAM", details: "x".repeat(2001) }).success, false);
  assert.equal(safetyReportSchema.safeParse({ reportedUserId: "other", reason: "SPAM", reporterUserId: "forged" }).success, false);
  assert.equal(safetyReportSchema.safeParse({ reportedUserId: "other", reason: "SPAM", conversationId: "conversation", messageId: "message" }).success, true);
});

test("communication pagination stays bounded", () => {
  assert.equal(boundedPage(undefined), 1); assert.equal(boundedPage("invalid"), 1);
  assert.equal(boundedPage(-20), 1); assert.equal(boundedPage(100001), 10000);
  assert.equal(boundedPage("2.9"), 2);
});
