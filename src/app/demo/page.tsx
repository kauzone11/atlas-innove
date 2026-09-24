import { notFound } from "next/navigation";

import { InstitutionOverview, ParticipantHome } from "@/components/demo/demo-views";
import { getDemoDataset, hasConfiguredDemoOrganization } from "@/lib/demo/read-model";

export const dynamic = "force-dynamic";

export default async function DemoHomePage({ searchParams }: { searchParams: Promise<{ perspectiva?: string }> }) {
  const params = await searchParams;
  if (!(await hasConfiguredDemoOrganization())) notFound();
  const dataset = await getDemoDataset();
  if (!dataset) notFound();
  return params.perspectiva === "participante" ? <ParticipantHome dataset={dataset} /> : <InstitutionOverview dataset={dataset} />;
}
