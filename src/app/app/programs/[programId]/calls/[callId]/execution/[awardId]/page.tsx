import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StatusBadge } from "@/components/ui";
import { CallWorkspaceHeader } from "@/components/selection/call-workspace-header";
import { AwardDetailSections } from "@/components/execution/award-detail";
import { AwardTrackingAction } from "@/components/execution/award-tracking";
import { awardStatusLabels, executionTone } from "@/components/execution/presentation";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getFundingCall } from "@/lib/funding-calls/service";
import { getInstitutionAward } from "@/lib/awards/service";
import { ResourceNotFoundError } from "@/lib/errors";

export default async function InstitutionalAwardPage({ params }: { params: Promise<{ programId: string; callId: string; awardId: string }> }) { const context = await getActiveOrganizationContext(); if (!context) redirect("/app/organizations"); const { programId, callId, awardId } = await params; const call = await getFundingCall(context.organization.id, programId, callId); if (!call) notFound(); const award = await getInstitutionAward(context, awardId).catch((error: unknown) => { if (error instanceof ResourceNotFoundError) notFound(); throw error; }); if (award.fundingCall.id !== callId || award.fundingCall.fundingProgram.id !== programId) notFound(); const canManage = hasAtLeastRole(context.membership.role, "MANAGER"); const detailHref = `/app/programs/${programId}/calls/${callId}/execution/${awardId}`; return <div className="min-w-0 space-y-6"><CallWorkspaceHeader call={call} section="Execução do apoio" /><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h2 className="break-words text-xl font-semibold">{award.application.projectNameSnapshot}</h2><Link className="inline-flex min-h-11 items-center text-sm font-medium text-accent-hover" href={`/app/programs/${programId}/calls/${callId}/applications/${award.applicationId}`}>Consultar candidatura de origem</Link></div><StatusBadge label={awardStatusLabels[award.status]} tone={executionTone(award.status)} /></div><AwardDetailSections award={award} institutional canManage={canManage} apiBase={`/api/organizations/${context.organization.id}/awards/${awardId}`} detailHref={detailHref} trackingAction={!award.enrollments.length && !award.historicalEnrollments.length && canManage && award.status === "ACTIVE" ? <AwardTrackingAction organizationId={context.organization.id} programId={programId} callId={callId} awardId={awardId} canManage={canManage} status={award.status} /> : undefined} /></div>; }
