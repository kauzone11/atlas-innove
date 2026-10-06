import { notFound, redirect } from "next/navigation";
import { CallWorkspaceHeader } from "@/components/selection/call-workspace-header";
import { RankingTable } from "@/components/selection/ranking-table";
import { auditDateLabel } from "@/components/selection/types";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { getFundingCall } from "@/lib/funding-calls/service";
import { getCallRanking } from "@/lib/selection/service";

export default async function CallRankingPage({ params }: { params: Promise<{ programId: string; callId: string }> }) {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  const { programId, callId } = await params;
  const call = await getFundingCall(context.organization.id, programId, callId);
  if (!call) notFound();
  const ranking = await getCallRanking(context.organization.id, programId, callId, context.auth.user.id);
  return <div className="space-y-6"><CallWorkspaceHeader call={call} section="Classificação" />{call.resultsPublishedAt ? <p className="border-l-2 border-success pl-4 text-sm leading-6 text-slate">Resultado publicado em {auditDateLabel(call.resultsPublishedAt)} (horário de Brasília). Cada participante pode consultar a decisão de sua candidatura.</p> : null}<RankingTable rows={ranking} baseHref={`/app/programs/${programId}/calls/${callId}/applications`} apiBase={`/api/organizations/${context.organization.id}/programs/${programId}/calls/${callId}`} canManage={hasAtLeastRole(context.membership.role, "MANAGER")} callStatus={call.status} published={Boolean(call.resultsPublishedAt)} executionHref={`/app/programs/${programId}/calls/${callId}/execution`} /></div>;
}
