import { FundingCallNavigation } from "@/components/funding-call-navigation";
import { Breadcrumbs, PageHeader, StatusBadge } from "@/components/ui";
import { fundingCallStatusLabels } from "@/lib/funding-calls/presentation";
import type { FundingCallDto } from "@/lib/funding-calls/service";

export function CallWorkspaceHeader({ call, section }: { call: FundingCallDto; section: string }) {
  return <>
    <PageHeader title={section} description={`${call.shortTitle || call.title} · Edital ${call.callNumber}`} breadcrumbs={<Breadcrumbs items={[{ label: "Programas", href: "/app/programs" }, { label: call.fundingProgram.name, href: `/app/programs/${call.fundingProgramId}` }, { label: `Edital ${call.callNumber}`, href: `/app/programs/${call.fundingProgramId}/calls/${call.id}` }, { label: section }]} />} action={<StatusBadge label={fundingCallStatusLabels[call.status] ?? call.status} tone={call.status === "OPEN" ? "success" : call.status === "IN_REVIEW" ? "accent" : "neutral"} />} />
    <FundingCallNavigation programId={call.fundingProgramId} callId={call.id} />
  </>;
}
