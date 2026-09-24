import { notFound } from "next/navigation";

import { DemoPageHeader, DemoSourceNote } from "@/components/demo/demo-views";
import { OpportunitiesView } from "@/components/demo/opportunities-view";
import { getDemoDataset, hasConfiguredDemoOrganization } from "@/lib/demo/read-model";

export const dynamic = "force-dynamic";

export default async function DemoOpportunitiesPage() {
  if (!(await hasConfiguredDemoOrganization())) notFound();
  const dataset = await getDemoDataset();
  if (!dataset) notFound();
  return <div><DemoPageHeader eyebrow="Ecossistema de inovação" title="Oportunidades" description="Editais públicos verificados para acompanhar possibilidades de participação em Sergipe." /><DemoSourceNote>As oportunidades vêm de páginas oficiais da FAPITEC/SE. O Atlas Innove armazena os metadados verificados e direciona você à fonte original.</DemoSourceNote><OpportunitiesView opportunities={dataset.opportunities} /></div>;
}
