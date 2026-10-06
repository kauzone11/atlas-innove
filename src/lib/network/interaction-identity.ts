import { db } from "@/lib/db";

// Callers must obtain these IDs from an interaction already scoped to its viewer, never from request input.
export async function loadInteractionIdentities(viewerUserId: string, authorizedUserIds: string[]) {
  const ids = [...new Set(authorizedUserIds)];
  if (!ids.length) return new Map<string, InteractionIdentity>();
  const [people, blocks] = await Promise.all([
    db.user.findMany({ where: { id: { in: ids } }, select: {
      id: true, profile: { select: { fullName: true } }, innovationProfile: { select: {
        handle: true, headline: true, directoryEnabled: true, publishedAt: true, profileVisibility: true, skillsVisibility: true,
        topics: { select: { type: true, label: true }, orderBy: [{ position: "asc" }, { id: "asc" }], take: 40 },
      } },
    } }),
    db.userBlock.findMany({ where: { OR: [{ blockerUserId: viewerUserId, blockedUserId: { in: ids } }, { blockedUserId: viewerUserId, blockerUserId: { in: ids } }] }, select: { blockerUserId: true, blockedUserId: true } }),
  ]);
  const blocked = new Set(blocks.map((row) => row.blockerUserId === viewerUserId ? row.blockedUserId : row.blockerUserId));
  return new Map(people.map((person) => {
    const profile = person.innovationProfile;
    const visible = !blocked.has(person.id) && (profile?.profileVisibility === "PLATFORM" || (profile?.profileVisibility === "PUBLIC" && Boolean(profile.publishedAt || profile.directoryEnabled)));
    const topics = visible && (profile?.skillsVisibility === "PUBLIC" || profile?.skillsVisibility === "PLATFORM") ? profile.topics : [];
    return [person.id, {
      userId: person.id, fullName: person.profile?.fullName || "Pessoa da plataforma",
      handle: visible && profile?.directoryEnabled ? profile.handle : null, headline: visible ? profile?.headline ?? null : null,
      skills: topics.filter((topic) => topic.type === "SKILL").map((topic) => topic.label),
      interests: topics.filter((topic) => topic.type === "INTEREST").map((topic) => topic.label),
    }];
  }));
}

export type InteractionIdentity = { userId: string; fullName: string; handle: string | null; headline: string | null; skills: string[]; interests: string[] };
