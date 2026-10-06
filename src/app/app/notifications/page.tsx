import Link from "next/link";
import { Bell } from "lucide-react";
import { NotificationActions } from "@/components/notifications/actions";
import { PageHeader } from "@/components/ui";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { listNotifications } from "@/lib/notifications/service";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const auth = await requireAuthenticatedSession();
  const list = await listNotifications(auth.user.id, Number((await searchParams).page ?? 1));
  return <>
    <PageHeader title="Notificações" description="Convites, solicitações e acontecimentos dos seus projetos e programas." action={<NotificationActions />} />
    {list.notifications.length ? <ol className="divide-y divide-line rounded-xl border border-line bg-white">{list.notifications.map((record) => <li key={record.id} className={`p-4 sm:p-6 ${!record.readAt ? "bg-surface-subtle" : ""}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><p className="flex items-center gap-2 text-sm font-semibold"><Bell size={16} aria-hidden="true" /><span className="break-words">{record.title}</span></p>{record.body ? <p className="mt-2 break-words text-sm text-slate">{record.body}</p> : null}<p className="mt-2 text-xs text-slate"><time dateTime={record.createdAt}>{new Date(record.createdAt).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}</time>{!record.readAt ? " · Não lida" : " · Lida"}</p></div><NotificationActions id={record.id} href={record.href} read={Boolean(record.readAt)} /></div>
    </li>)}</ol> : <div className="panel p-6"><p className="text-sm text-slate">Seus convites e acontecimentos aparecerão aqui quando houver novidades.</p></div>}
    <nav aria-label="Páginas de notificações" className="mt-5 flex gap-3">{list.page > 1 ? <Link className="button-secondary" href={`?page=${list.page - 1}`}>Anterior</Link> : null}{list.hasNext ? <Link className="button-secondary" href={`?page=${list.page + 1}`}>Próxima</Link> : null}</nav>
  </>;
}
