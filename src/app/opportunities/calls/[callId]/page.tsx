import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public-shell";
import { Breadcrumbs, PageHeader } from "@/components/ui";
import { OpportunityCallDetail } from "@/components/opportunities/call-detail";
import { getPublicOpportunity } from "@/lib/opportunities/service";
import { getAuthenticatedSession } from "@/lib/auth/session";
type Props = { params: Promise<{ callId: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { callId } = await params; const call = await getPublicOpportunity(callId);
  if (!call) return { title: "Edital não encontrado | Atlas Innove", robots: { index: false, follow: false } };
  return { title: `${call.title} | Atlas Innove`, description: (call.objective || `${call.institution} · Edital ${call.callNumber}`).slice(0, 160), alternates: { canonical: `/opportunities/calls/${callId}` } };
}
export default async function PublicCallPage({ params }: Props) {
  const { callId } = await params; const [call, auth] = await Promise.all([getPublicOpportunity(callId), getAuthenticatedSession()]); if (!call) notFound();
  const destination = `/app/personal/opportunities/${callId}`;
  return <PublicShell><div className="min-w-0 space-y-6"><PageHeader title={call.title} description={`${call.institution} · ${call.callNumber}`} breadcrumbs={<Breadcrumbs items={[{ label: "Oportunidades", href: "/opportunities" }, { label: "Edital" }]} />} action={call.canApply ? <Link className="button-primary" href={auth ? destination : `/login?next=${encodeURIComponent(destination)}`}>Candidatar projeto</Link> : null} /><OpportunityCallDetail call={call} />{!auth ? <p className="text-sm leading-6 text-slate"><Link className="font-medium text-accent-hover underline underline-offset-4" href={`/signup?next=${encodeURIComponent(destination)}`}>Crie sua conta</Link> para salvar oportunidades e explorar a relação com seus projetos.</p> : null}</div></PublicShell>;
}
