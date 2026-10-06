import { db } from "@/lib/db";
import { requireProjectAccess } from "@/lib/auth/participant-access";
import type { RelevanceContext } from "@/lib/network/relevance";

export async function getDiscoveryContext(userId: string, projectId?: string): Promise<RelevanceContext> {
  const [profile, project] = await Promise.all([
    db.innovationProfile.findUnique({ where: { userId }, select: {
      state: true, profileVisibility: true, skillsVisibility: true,
      topics: { select: { type: true, label: true }, take: 40, orderBy: [{ position: "asc" }, { id: "asc" }] },
    } }),
    projectId ? requireProjectAccess(userId, projectId) : Promise.resolve(null),
  ]);
  const visible = (scope: string) => scope === "PUBLIC" || scope === "PLATFORM";
  const topics = profile && visible(profile.profileVisibility) && visible(profile.skillsVisibility) ? profile.topics : [];
  return {
    skills: topics.filter((topic) => topic.type === "SKILL").map((topic) => topic.label),
    interests: topics.filter((topic) => topic.type === "INTEREST").map((topic) => topic.label),
    state: profile && visible(profile.profileVisibility) ? profile.state : null,
    projectTopics: project?.thematicAreas ?? [],
  };
}
