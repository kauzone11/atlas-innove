import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { StatusBadge, statusTone } from "@/components/ui";
import type { PersonalApplicationDto } from "@/lib/selection/service";
import { applicationStatusLabels, applicationDecisionLabels, formatParticipantTimestamp } from "@/lib/participants/presentation";

export function PersonalApplicationList({ applications }: { applications: PersonalApplicationDto[] }) {
  return <ul className="divide-y divide-line">{applications.map((application) => <li key={application.id}><Link className="flex min-h-24 items-start gap-4 px-5 py-5 hover:bg-surface-subtle" href={`/app/personal/applications/${application.id}`}><span className="min-w-0 flex-1"><span className="block break-words font-semibold text-ink">{application.projectNameSnapshot}</span><span className="mt-1 block break-words text-sm text-slate">{application.fundingCall.title} · {application.fundingCall.organization.name}</span><span className="mt-1 block text-xs text-slate">{application.teamNameSnapshot ?? "Projeto independente"}{application.submittedAt ? ` · Enviada em ${formatParticipantTimestamp(application.submittedAt)}` : ""}</span><span className="mt-3 flex flex-wrap gap-2"><StatusBadge label={applicationStatusLabels[application.status]} tone={statusTone(application.status)} />{application.decision && application.decision !== "PENDING" ? <StatusBadge label={applicationDecisionLabels[application.decision]} tone={application.decision === "SELECTED" ? "success" : "neutral"} /> : null}</span></span><ArrowUpRight size={16} aria-hidden="true" className="shrink-0 text-slate" /></Link></li>)}</ul>;
}
