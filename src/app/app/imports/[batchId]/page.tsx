import { notFound } from "next/navigation";
import { getImportPageAccess, importPageNumber } from "@/components/imports/access";
import { ImportBatchWorkspace } from "@/components/imports/batch-workspace";
import { serializeImportView } from "@/components/imports/shared";
import { Breadcrumbs, PageHeader } from "@/components/ui";
import { getImportBatch } from "@/lib/imports/staging";
import { getImportAudit, getImportQualityLink } from "@/lib/imports/audit";
import { ImportInputError } from "@/lib/imports/errors";
import { IMPORT_TEMPLATES } from "@/lib/imports/templates";

export default async function ImportBatchPage({ params, searchParams }: { params: Promise<{ batchId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { context, canManage } = await getImportPageAccess();
  if (!canManage) return <PageHeader title="Importações" description="Esta área está disponível para gestores, administradores e proprietários da instituição." />;
  const { batchId } = await params; const query = await searchParams;
  const filter = query.filter === "INVALID" || query.filter === "WARNINGS" ? query.filter : "ALL";
  try {
    const detail = await getImportBatch(context.auth.user.id, context.organization.id, batchId, { page: importPageNumber(query.page), filter });
    const [audit, qualityHref] = await Promise.all([getImportAudit(context.auth.user.id, context.organization.id, batchId, { page: importPageNumber(query.auditPage) }), getImportQualityLink(context.auth.user.id, context.organization.id, batchId)]);
    return <div className="min-w-0 space-y-6"><PageHeader title={detail.batch.sourceName ?? "Revisar importação"} description={IMPORT_TEMPLATES[detail.batch.type].label} breadcrumbs={<Breadcrumbs items={[{ label: "Importações", href: "/app/imports" }, { label: "Revisão do lote" }]} />} /><ImportBatchWorkspace initial={serializeImportView(detail)} audit={serializeImportView(audit)} qualityHref={qualityHref} /></div>;
  } catch (error) { if (error instanceof ImportInputError && error.code === "IMPORT_BATCH_NOT_FOUND") notFound(); throw error; }
}
