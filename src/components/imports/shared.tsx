import Link from "next/link";

export type Serialized<T> = T extends Date ? string : T extends readonly unknown[] ? { [K in keyof T]: Serialized<T[K]> } : T extends object ? { [K in keyof T]: Serialized<T[K]> } : T;
export function serializeImportView<T>(value: T): Serialized<T> { return JSON.parse(JSON.stringify(value)) as Serialized<T>; }
export function importDate(value: string | Date | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Fortaleza" }).format(new Date(value)) : "Não realizada";
}
export function ImportPagination({ page, hasNext, href }: { page: number; hasNext: boolean; href: (page: number) => string }) {
  return <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"><span className="text-sm text-slate">Página {page} · até 20 registros</span><div className="flex flex-wrap gap-2">{page > 1 ? <Link className="button-secondary" href={href(page - 1)}>Anterior</Link> : null}{hasNext ? <Link className="button-secondary" href={href(page + 1)}>Próxima</Link> : null}</div></nav>;
}
