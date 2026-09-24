import { notFound } from "next/navigation";

import { VentureDetailView } from "@/components/demo/demo-views";
import { getDemoVenture, hasConfiguredDemoOrganization } from "@/lib/demo/read-model";

export const dynamic = "force-dynamic";

export default async function DemoVenturePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ perspectiva?: string }> }) {
  if (!(await hasConfiguredDemoOrganization())) notFound();
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const result = await getDemoVenture(slug);
  if (!result) notFound();
  return <VentureDetailView dataset={result.dataset} venture={result.venture} perspective={query.perspectiva === "participante" ? "participante" : "instituicao"} />;
}
