import { notFound } from "next/navigation";

import { FollowUpsView } from "@/components/demo/demo-views";
import { getDemoDataset, hasConfiguredDemoOrganization } from "@/lib/demo/read-model";

export const dynamic = "force-dynamic";

export default async function DemoFollowUpsPage() {
  if (!(await hasConfiguredDemoOrganization())) notFound();
  const dataset = await getDemoDataset();
  if (!dataset) notFound();
  return <FollowUpsView dataset={dataset} />;
}
