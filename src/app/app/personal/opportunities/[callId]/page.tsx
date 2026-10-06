import { notFound } from "next/navigation";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui";
import { CreateApplication } from "@/components/personal/application-actions";
import { OpportunityCallDetail } from "@/components/opportunities/call-detail";
import { SaveOpportunityButton } from "@/components/opportunities/save-button";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { getPersonalOpportunity } from "@/lib/opportunities/service";
import { listProjects, listTeams } from "@/lib/participants/service";
export default async function PersonalOpportunity({ params }: { params: Promise<{ callId: string }> }) {
  const { callId } = await params; const { user } = await requireAuthenticatedSession(); const [call, projects, teams] = await Promise.all([getPersonalOpportunity(user.id, callId), listProjects(user.id), listTeams(user.id)]); if (!call) notFound();
  return <div className="min-w-0 space-y-6"><PageHeader title={call.title} description={`${call.institution} · ${call.callNumber}`} breadcrumbs={<Breadcrumbs items={[{ label: "Oportunidades", href: "/app/personal/opportunities" }, { label: "Edital" }]} />} action={<SaveOpportunityButton id={call.id} kind="INTERNAL" saved={call.saved} />} /><OpportunityCallDetail call={call} /><Panel className="p-5"><h2 className="mb-2 font-semibold">Sua participação</h2><p className="mb-5 text-sm leading-6 text-slate">Escolha um projeto existente. A candidatura será criada como rascunho para revisão antes do envio.</p><CreateApplication callId={callId} projects={projects} teams={teams} canApply={call.canApply} /></Panel></div>;
}
