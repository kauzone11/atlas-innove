import { notFound } from "next/navigation";

import { ProgramView } from "@/components/demo/demo-views";
import { getDemoDataset, hasConfiguredDemoOrganization } from "@/lib/demo/read-model";

export const dynamic = "force-dynamic";

export default async function DemoProgramsPage({ searchParams }: { searchParams: Promise<{ perspectiva?: string }> }) {
  const params = await searchParams;
  if (!(await hasConfiguredDemoOrganization())) notFound();
  const dataset = await getDemoDataset();
  if (!dataset) notFound();
  return <ProgramView dataset={dataset} perspective={params.perspectiva === "participante" ? "participante" : "instituicao"} />;
}
