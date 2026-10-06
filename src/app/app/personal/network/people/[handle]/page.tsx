import { notFound } from "next/navigation";
import { Breadcrumbs, StatusBadge } from "@/components/ui";
import { RelevanceExplanation } from "@/components/network/discovery-list";
import { SocialProfile } from "@/components/social/profile";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { getVisibleProfile } from "@/lib/profiles/service";
import { getDiscoverablePerson } from "@/lib/network/people";
import { collaborationStatusLabels } from "@/lib/network/presentation";
export default async function NetworkPerson({ params }: { params: Promise<{ handle: string }> }) {
  const { user } = await requireAuthenticatedSession(); const { handle } = await params;
  const profile = await getVisibleProfile(handle, user.id); if (!profile) notFound();
  const discovery = await getDiscoverablePerson(user.id, handle);
  return <div className="min-w-0 space-y-6"><Breadcrumbs items={[{ label: "Rede", href: "/app/personal/network" }, { label: "Pessoas", href: "/app/personal/network/people" }, { label: profile.fullName }]} /><SocialProfile profile={profile} viewerUserId={user.id} own={profile.userId === user.id} />{discovery ? <section className="mx-auto max-w-5xl space-y-3 border-t border-line py-6"><h2 className="text-lg font-semibold">Colaboração na Rede</h2><StatusBadge label={collaborationStatusLabels[discovery.person.collaborationStatus]} tone={discovery.person.collaborationStatus === "OPEN" ? "success" : "neutral"} />{discovery.person.collaborationNote ? <p className="max-w-3xl whitespace-pre-line break-words text-sm leading-7 text-slate">{discovery.person.collaborationNote}</p> : null}{discovery.person.relevance.reasons.length ? <RelevanceExplanation relevance={discovery.person.relevance} /> : null}</section> : null}</div>;
}
