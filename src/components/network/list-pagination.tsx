import Link from "next/link";

export function NetworkListPagination({ page, hasNext, href, label }: { page: number; hasNext: boolean; href: (page: number) => string; label: string }) {
  if (page === 1 && !hasNext) return null;
  return <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-5">
    {page > 1 ? <Link href={href(page - 1)} className="button-secondary">Anterior</Link> : <span />}
    <span className="text-sm tabular-nums text-slate">Página {page}</span>
    {hasNext ? <Link href={href(page + 1)} className="button-secondary">Próxima</Link> : <span />}
  </nav>;
}
