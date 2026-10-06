import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs, PageHeader } from "@/components/ui";
import { getAnalyticsAccess } from "@/components/analytics/access";
import { AnalyticsNavigation } from "@/components/analytics/navigation";
import { PortfolioView } from "@/components/analytics/views";
import { ExportButton } from "@/components/analytics/filters";
import { getProgramAnalytics } from "@/lib/analytics/read-model";
import { ResourceNotFoundError } from "@/lib/errors";

export default async function ProgramAnalyticsPage({ params }: { params: Promise<{ programId: string }> }) {
  const { access, canAnalyze } = await getAnalyticsAccess();
  const { programId } = await params;
  const data = await getProgramAnalytics(access, programId).catch((error: unknown) => { if (error instanceof ResourceNotFoundError) notFound(); throw error; });
  if (!data) notFound();
  return <div className="min-w-0 space-y-6"><PageHeader title={data.program.name} description="Análises do programa · Seleção, execução e resultados observados." breadcrumbs={<Breadcrumbs items={[{ label: "Análises", href: "/app/analytics" }, { label: data.program.name }]} />} action={<Link href={`/app/programs/${programId}`} className="button-secondary">Abrir programa</Link>} /><AnalyticsNavigation current="/app/analytics" canConfigure={canAnalyze} /><PortfolioView data={data} canAnalyze={canAnalyze} />{canAnalyze ? <div className="flex flex-wrap gap-2"><Link href={`/app/analytics/reports?${new URLSearchParams({ type: "PROGRAM_SUMMARY", programId })}`} className="button-primary">Preparar relatório do programa</Link><ExportButton organizationId={access.organizationId} type="PROGRAM_SUMMARY" programId={programId} label="Exportar resumo" /><ExportButton organizationId={access.organizationId} type="EXECUTION_SUMMARY" programId={programId} label="Exportar execução" /></div> : null}</div>;
}
