import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs, StatusBadge } from "@/components/ui";
import { ProfileRenderer } from "@/components/profiles/profile-renderer";
import { RelevanceExplanation } from "@/components/network/discovery-list";
import { PersonNetworkActions } from "@/components/network/person-actions";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { getDiscoverablePerson } from "@/lib/network/people";
import { getPersonNetworkState } from "@/lib/network/connections";
import { getInviteOptions } from "@/lib/network/invites";
import { collaborationStatusLabels } from "@/lib/network/presentation";

export default async function NetworkPerson({ params }: { params: Promise<{ handle: string }> }) {
  const { user } = await requireAuthenticatedSession(); const { handle } = await params;
  const result = await getDiscoverablePerson(user.id, handle); if (!result) notFound();
  const [connection, inviteOptions] = await Promise.all([getPersonNetworkState(user.id, result.person.userId), getInviteOptions(user.id, result.person.userId)]);
  return <div className="min-w-0 space-y-6"><Breadcrumbs items={[{ label: "Rede", href: "/app/personal/network" }, { label: "Pessoas", href: "/app/personal/network/people" }, { label: result.person.fullName }]} /><div className="flex flex-wrap items-center justify-between gap-3"><StatusBadge label={collaborationStatusLabels[result.person.collaborationStatus]} tone={result.person.collaborationStatus === "OPEN" ? "success" : "neutral"} />{user.id === result.person.userId ? <Link className="button-secondary" href="/app/personal/profile">Editar meu perfil</Link> : <PersonNetworkActions userId={result.person.userId} handle={result.person.handle} connection={connection} inviteOptions={inviteOptions} />}</div>{result.person.collaborationNote ? <section className="border-b border-line pb-5"><h2 className="font-semibold">Interesses de colaboração</h2><p className="mt-2 max-w-3xl whitespace-pre-line break-words text-sm leading-6 text-slate">{result.person.collaborationNote}</p></section> : null}{result.person.relevance.reasons.length ? <RelevanceExplanation relevance={result.person.relevance} /> : null}<ProfileRenderer profile={result.profile} /></div>;
}
