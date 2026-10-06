import { z } from "zod";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { loadPosts } from "@/lib/social/read-model";
import { connectedUserWhere, unblockedUserWhere, visiblePostWhere } from "@/lib/social/visibility";
import type { FeedPage } from "@/lib/social/types";
import { isValidSignature, signValue } from "@/lib/security";

const cursorSchema = z.object({ mode: z.enum(["RECENT", "HIGHLIGHTS"]), at: z.string().datetime(), offset: z.number().int().min(0).max(500),
  lastAt: z.string().datetime().optional(), lastId: z.string().max(128).optional() });
const inputSchema = z.object({ mode: z.enum(["RECENT", "HIGHLIGHTS"]).default("RECENT"), cursor: z.string().max(40000).optional() });
const snapshotSchema = z.object({ at: z.string().datetime(), ids: z.array(z.string().min(1).max(128)).max(500) });
function encodeSnapshot(userId: string, at: Date, ids: string[]) {
  if (!ids.length) return null;
  const payload = deflateRawSync(Buffer.from(JSON.stringify({ at: at.toISOString(), ids }))).toString("base64url");
  return `${payload}.${signValue(`social-feed:${userId}:${payload}`)}`;
}
function decodeSnapshot(userId: string, value?: string) {
  if (!value) return null;
  try {
    const [payload, signature, extra] = value.split(".");
    if (!payload || !signature || extra || !isValidSignature(`social-feed:${userId}:${payload}`, signature)) return null;
    const snapshot = snapshotSchema.parse(JSON.parse(inflateRawSync(Buffer.from(payload, "base64url"), { maxOutputLength: 100000 }).toString("utf8")));
    const age = Date.now() - new Date(snapshot.at).getTime();
    return age >= 0 && age < 86400000 ? snapshot : null;
  } catch { return null; }
}
export const FEED_CANDIDATE_LIMIT = 500;
export const FEED_PAGE_SIZE = 20;

export async function getFeed(userId: string, value: unknown = {}): Promise<FeedPage> {
  const input = inputSchema.parse(value);
  let cursor: z.infer<typeof cursorSchema> | null = null;
  if (input.cursor) {
    try { cursor = cursorSchema.parse(JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8"))); } catch { cursor = null; }
  }
  if (cursor?.mode !== input.mode || (cursor && new Date(cursor.at).getTime() > Date.now())) cursor = null;
  const at = new Date(cursor?.at ?? new Date());
  const source: Prisma.SocialPostWhereInput = { OR: [
    { authorUserId: userId }, { author: { followers: { some: { followerUserId: userId, endedAt: null } } } },
  ] };
  const audience = visiblePostWhere(userId);
  const snapshot = input.mode === "HIGHLIGHTS" ? decodeSnapshot(userId, input.cursor) : null;
  if (snapshot) {
    // A signed, viewer-bound ordering snapshot prevents engagement changes from duplicating or skipping pages.
    // Content and subscriptions are still re-authorized on every page; the cursor carries no post bodies.
    const eligible = await db.socialPost.findMany({ where: { AND: [audience, source, { id: { in: snapshot.ids } }] }, select: { id: true }, take: FEED_CANDIDATE_LIMIT });
    const allowed = new Set(eligible.map((row) => row.id));
    const remaining = snapshot.ids.filter((id) => allowed.has(id));
    const ids = remaining.slice(0, FEED_PAGE_SIZE);
    const items = await loadPosts({ AND: [source, { id: { in: ids } }] }, userId, { take: FEED_PAGE_SIZE });
    items.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    return { items, mode: input.mode, nextCursor: encodeSnapshot(userId, new Date(snapshot.at), remaining.slice(FEED_PAGE_SIZE)) };
  }
  if (input.mode === "RECENT") {
    const after: Prisma.SocialPostWhereInput = cursor?.lastAt && cursor.lastId ? { OR: [
      { createdAt: { lt: new Date(cursor.lastAt) } }, { createdAt: new Date(cursor.lastAt), id: { lt: cursor.lastId } },
    ] } : {};
    const rows = await loadPosts({ AND: [source, { createdAt: { lte: at } }, after] }, userId, { take: FEED_PAGE_SIZE + 1 });
    const items = rows.slice(0, FEED_PAGE_SIZE);
    const last = items.at(-1);
    return { items, mode: input.mode, nextCursor: rows.length > FEED_PAGE_SIZE && last ? Buffer.from(JSON.stringify({
      mode: input.mode, at: at.toISOString(), offset: 0, lastAt: last.createdAt, lastId: last.id,
    })).toString("base64url") : null };
  }
  // Rank the entire bounded, audience-filtered 90-day candidate pool before applying the page offset.
  const candidates = await db.socialPost.findMany({ where: { AND: [audience, source, { createdAt: { lte: at, gte: new Date(at.getTime() - 90 * 86400000) } }] },
    select: { id: true, authorUserId: true, createdAt: true, _count: { select: {
      reactions: { where: { createdAt: { lte: at }, user: unblockedUserWhere(userId) } },
      comments: { where: { createdAt: { lte: at }, deletedAt: null, hiddenByPostAuthorAt: null, author: unblockedUserWhere(userId),
        OR: [{ parentCommentId: null }, { parentComment: { hiddenByPostAuthorAt: null, author: unblockedUserWhere(userId) } }] } },
      reposts: { where: { AND: [audience, { createdAt: { lte: at } }] } },
    } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: FEED_CANDIDATE_LIMIT });
  const connections = await db.user.findMany({ where: { id: { in: [...new Set(candidates.map((post) => post.authorUserId))] }, ...connectedUserWhere(userId) }, select: { id: true } });
  const connected = new Set(connections.map((user) => user.id));
  const score = (post: typeof candidates[number]) => {
    const ageDays = Math.max(0, (at.getTime() - post.createdAt.getTime()) / 86400000);
    return (connected.has(post.authorUserId) ? 3 : 0) + 12 / (1 + ageDays)
      + Math.min(post._count.reactions, 20) * .2 + Math.min(post._count.comments, 10) * .5 + Math.min(post._count.reposts, 10) * .5;
  };
  candidates.sort((a, b) => score(b) - score(a) || b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  const ids = candidates.slice(0, FEED_PAGE_SIZE).map((row) => row.id);
  const items = await loadPosts({ AND: [source, { id: { in: ids } }] }, userId, { take: FEED_PAGE_SIZE });
  items.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  return { items, mode: input.mode, nextCursor: encodeSnapshot(userId, at, candidates.slice(FEED_PAGE_SIZE).map((row) => row.id)) };
}
