import { notFound, redirect } from "next/navigation";
import { ApplicationsList } from "@/components/selection/applications-list";
import { CallWorkspaceHeader } from "@/components/selection/call-workspace-header";
import { CriteriaManager } from "@/components/selection/criteria-manager";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { getFundingCall } from "@/lib/funding-calls/service";
import { listCallApplications, listCallCriteria } from "@/lib/selection/service";

export default async function CallEvaluationPage({ params }: { params: Promise<{ programId: string; callId: string }> }) {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  const { programId, callId } = await params;
  const call = await getFundingCall(context.organization.id, programId, callId);
  if (!call) notFound();
  const [applications, criteria] = await Promise.all([listCallApplications(context.organization.id, programId, callId, "", context.auth.user.id), listCallCriteria(context.organization.id, programId, callId)]);
  const canManage = hasAtLeastRole(context.membership.role, "MANAGER");
  const canEvaluate = hasAtLeastRole(context.membership.role, "ANALYST");
  return <div className="space-y-6"><CallWorkspaceHeader call={call} section="Avaliação" /><CriteriaManager criteria={criteria} apiBase={`/api/organizations/${context.organization.id}/programs/${programId}/calls/${callId}`} frozen={Boolean(call.evaluationStartedAt)} canManage={canManage} editable={!["ARCHIVED", "CLOSED", "RESULT_PUBLISHED"].includes(call.status)} /><ApplicationsList applications={applications} baseHref={`/app/programs/${programId}/calls/${callId}/applications`} evaluation canEvaluate={canEvaluate && call.status === "IN_REVIEW"} /></div>;
}
