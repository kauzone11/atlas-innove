import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { CallWorkspaceHeader } from "@/components/selection/call-workspace-header";
import { CohortBridge, CreateSelectionCohort } from "@/components/selection/cohort-bridge";
import { Panel, PanelHeader, StatusBadge, statusTone } from "@/components/ui";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { listProgramCohorts } from "@/lib/cohorts/service";
import { getFundingCall } from "@/lib/funding-calls/service";
import { getOrganizationProgram } from "@/lib/programs/service";
import { listCallApplications } from "@/lib/selection/service";
import { listTrackingProtocols } from "@/lib/tracking-protocols/service";

export default async function CallTrackingPage({ params }: { params: Promise<{ programId: string; callId: string }> }) {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  const { programId, callId } = await params;
  const call = await getFundingCall(context.organization.id, programId, callId);
  if (!call) notFound();
  const [allCohorts, applications, protocols, program] = await Promise.all([listProgramCohorts(context.organization.id, programId), listCallApplications(context.organization.id, programId, callId, "", context.auth.user.id), listTrackingProtocols(context.organization.id), getOrganizationProgram(context.organization.id, programId)]);
  const cohorts = allCohorts.filter((cohort) => cohort.fundingCallId === callId);
  const canManage = hasAtLeastRole(context.membership.role, "MANAGER");
  return <div className="space-y-6"><CallWorkspaceHeader call={call} section="Acompanhamento" /><CohortBridge applications={applications} cohorts={cohorts.filter((cohort) => ["PLANNED", "ACTIVE"].includes(cohort.status))} apiBase={`/api/organizations/${context.organization.id}/programs/${programId}/calls/${callId}`} programId={programId} callId={callId} canManage={canManage} published={Boolean(call.resultsPublishedAt) && ["RESULT_PUBLISHED", "CLOSED"].includes(call.status)} /><Panel><PanelHeader title="Coortes do edital" description="O acompanhamento mantém as participações, as ondas e as observações ao longo do tempo." action={canManage && call.status !== "ARCHIVED" && program && ["DRAFT", "ACTIVE"].includes(program.status) ? <CreateSelectionCohort organizationId={context.organization.id} call={call} protocols={protocols} /> : undefined} />{cohorts.length ? <ul className="divide-y divide-line">{cohorts.map((cohort) => <li key={cohort.id}><Link href={`/app/programs/${programId}/cohorts/${cohort.id}`} className="flex min-h-11 flex-col gap-3 px-4 py-5 hover:bg-surface-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="min-w-0"><h3 className="break-words font-medium">{cohort.name}</h3><p className="mt-1 text-sm text-slate">{cohort.ventureCount} participação(ões) · {cohort.waveCount} onda(s)</p><p className="mt-1 text-xs text-slate">{cohort.trackingProtocolVersion ? `${cohort.trackingProtocolVersion.trackingProtocol.name} · v${cohort.trackingProtocolVersion.version}` : "Protocolo a configurar antes da primeira onda"}</p></div><span className="inline-flex items-center gap-3"><StatusBadge label={({ PLANNED: "Planejada", ACTIVE: "Ativa", CLOSED: "Encerrada", ARCHIVED: "Arquivada" } as Record<string, string>)[cohort.status] ?? cohort.status} tone={statusTone(cohort.status)} /><ArrowRight size={16} aria-hidden="true" className="text-accent-hover" /></span></Link></li>)}</ul> : <p className="px-4 py-8 text-sm leading-6 text-slate sm:px-6">Nenhuma coorte vinculada ao edital. Um gestor pode criar o grupo que acompanhará os projetos apoiados, aplicar um protocolo e registrar suas ondas.</p>}</Panel></div>;
}
