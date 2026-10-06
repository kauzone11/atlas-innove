import Link from "next/link";
import { Panel, PanelHeader } from "@/components/ui";
import { AwardTrackingForm } from "@/components/execution/award-tracking-action";
import { CreateSelectionCohort } from "@/components/selection/cohort-bridge";
import { listProgramCohorts } from "@/lib/cohorts/service";
import { getFundingCall } from "@/lib/funding-calls/service";
import { listTrackingProtocols } from "@/lib/tracking-protocols/service";

type Props = {
  organizationId: string; programId: string; callId: string; awardId: string;
  canManage: boolean; status: string;
};

export async function AwardTrackingAction(props: Props) {
  const cohorts = await listProgramCohorts(props.organizationId, props.programId);
  const eligible = cohorts.filter((cohort) => cohort.fundingCallId === props.callId && ["PLANNED", "ACTIVE"].includes(cohort.status));
  const [call, protocols] = props.canManage && props.status === "ACTIVE"
    ? await Promise.all([getFundingCall(props.organizationId, props.programId, props.callId), listTrackingProtocols(props.organizationId)])
    : [null, []];
  return <Panel><PanelHeader title="Acompanhamento longitudinal" description="As ondas e os indicadores acompanham a trajetória. São independentes das entregas e relatórios desta execução." />
    <div className="space-y-4 px-4 pb-6 sm:px-6">
      {props.canManage && props.status === "ACTIVE" ? <><AwardTrackingForm {...props} cohorts={eligible.map((cohort) => ({ id: cohort.id, name: cohort.name }))} />{call ? <CreateSelectionCohort organizationId={props.organizationId} call={call} protocols={protocols} /> : null}</> : <p className="text-sm text-slate">O ingresso em uma coorte pode ser organizado pela instituição durante a execução ativa. O acompanhamento registrado continua após o encerramento do apoio.</p>}
      <Link className="button-tertiary" href={`/app/programs/${props.programId}/calls/${props.callId}/tracking`}>Consultar coortes do edital</Link>
    </div>
  </Panel>;
}
