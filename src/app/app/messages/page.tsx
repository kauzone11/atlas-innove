import Link from "next/link";
import { Avatar } from "@/components/media/avatar";
import { PageHeader, Panel, StatusBadge } from "@/components/ui";
import { ParticipantEmpty } from "@/components/personal/record-list";
import { RefreshCommunication } from "@/components/communication/actions";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { listConversations } from "@/lib/communication/messages";
import { communicationDate } from "@/lib/communication/presentation";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { user } = await requireAuthenticatedSession(); const query = await searchParams;
  const inbox = await listConversations(user.id, query.page);
  return <div className="min-w-0 space-y-6"><PageHeader title="Mensagens" description="Conversas privadas com pessoas da sua rede de colaboração." action={<RefreshCommunication />} /><Panel>{inbox.conversations.length ? <ul className="divide-y divide-line">{inbox.conversations.map((conversation) => <li key={conversation.id}><Link href={`/app/messages/${conversation.id}`} className="flex min-h-20 flex-wrap items-center justify-between gap-3 p-4 sm:p-5"><div className="flex min-w-0 flex-1 items-start gap-3"><Avatar name={conversation.person.fullName} media={conversation.person.avatarMedia} /><div className="min-w-0"><h2 className="break-words font-semibold">{conversation.person.fullName}</h2>{conversation.person.headline ? <p className="mt-1 break-words text-sm text-slate">{conversation.person.headline}</p> : null}<p className="mt-2 text-xs text-slate">{conversation.lastMessageAt ? `Última mensagem em ${communicationDate(conversation.lastMessageAt)}` : "Conversa iniciada"}</p></div></div>{conversation.unreadCount ? <StatusBadge label={`${conversation.unreadCount} não ${conversation.unreadCount === 1 ? "lida" : "lidas"}`} tone="accent" /> : null}</Link></li>)}</ul> : <ParticipantEmpty title="Nenhuma conversa por aqui" description="Você pode iniciar uma conversa depois de se conectar a uma pessoa na rede." />}</Panel><nav className="flex flex-wrap gap-3" aria-label="Páginas de conversas">{inbox.page > 1 ? <Link className="button-secondary" href={`/app/messages?page=${inbox.page - 1}`}>Página anterior</Link> : null}{inbox.page * inbox.pageSize < inbox.total ? <Link className="button-secondary" href={`/app/messages?page=${inbox.page + 1}`}>Próxima página</Link> : null}</nav><Link className="button-secondary" href="/app/personal/network/connections">Abrir conexões</Link></div>;
}
