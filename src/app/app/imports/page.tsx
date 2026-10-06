import Link from "next/link";
import { getImportPageAccess, importPageNumber } from "@/components/imports/access";
import { ImportPagination, importDate } from "@/components/imports/shared";
import { ImportUploadForm } from "@/components/imports/upload-form";
import { Breadcrumbs, PageHeader, StatusBadge } from "@/components/ui";
import { IMPORT_STATUS_LABELS } from "@/lib/imports/copy";
import { listImportBatches } from "@/lib/imports/staging";
import { IMPORT_TEMPLATES } from "@/lib/imports/templates";

export default async function ImportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { context, canManage } = await getImportPageAccess();
  if (!canManage) return <PageHeader title="Importações" description="Esta área está disponível para gestores, administradores e proprietários da instituição." />;
  const query = await searchParams;
  const result = await listImportBatches(context.auth.user.id, context.organization.id, { page: importPageNumber(query.page) });
  return <div className="min-w-0 space-y-6">
    <PageHeader title="Importações" description="Incorpore o histórico institucional preservando identidades, datas e a origem das evidências." breadcrumbs={<Breadcrumbs items={[{ label: "Configurações", href: "/app/settings" }, { label: "Importações" }]} />} />
    <ImportUploadForm organizationId={context.organization.id} />
    <section aria-labelledby="import-history"><h2 id="import-history" className="text-lg font-semibold">Histórico de lotes</h2><p className="mt-1 text-sm text-slate">Os arquivos preparados, aplicados e revertidos permanecem disponíveis para conferência.</p>
      <ul className="my-4 divide-y divide-line border-y border-line">{result.items.map((batch) => <li key={batch.id}><Link className="flex min-h-11 flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between" href={`/app/imports/${batch.id}`}><div className="min-w-0"><span className="block break-words font-semibold">{batch.sourceName ?? IMPORT_TEMPLATES[batch.type].label}</span><span className="mt-1 block break-words text-sm text-slate">{IMPORT_TEMPLATES[batch.type].label} · {batch.totalRows} linha(s) · Origem: {batch.namespace}</span><span className="mt-1 block text-xs text-slate">{importDate(batch.createdAt)} (Fortaleza)</span></div><StatusBadge label={IMPORT_STATUS_LABELS[batch.status]} tone={batch.status === "APPLIED" ? "success" : batch.status === "FAILED" ? "danger" : "neutral"} /></Link></li>)}</ul>
      {!result.items.length ? <p className="py-4 text-sm text-slate">{result.page === 1 ? "Nenhum lote recebido. Carregue um CSV para começar a revisão." : "Nenhum lote nesta página."}</p> : null}
      <ImportPagination page={result.page} hasNext={result.hasNext} href={(page) => `/app/imports?page=${page}`} />
    </section>
  </div>;
}
