import { notFound, redirect } from "next/navigation";
import { ApplicationsList } from "@/components/selection/applications-list";
import { CallWorkspaceHeader } from "@/components/selection/call-workspace-header";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { getFundingCall } from "@/lib/funding-calls/service";
import { listCallApplications } from "@/lib/selection/service";

export default async function CallApplicationsPage({ params }: { params: Promise<{ programId: string; callId: string }> }) {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  const { programId, callId } = await params;
  const call = await getFundingCall(context.organization.id, programId, callId);
  if (!call) notFound();
  const applications = await listCallApplications(context.organization.id, programId, callId, "", context.auth.user.id);
  return <div className="space-y-6"><CallWorkspaceHeader call={call} section="Candidaturas" /><ApplicationsList applications={applications} baseHref={`/app/programs/${programId}/calls/${callId}/applications`} /></div>;
}
