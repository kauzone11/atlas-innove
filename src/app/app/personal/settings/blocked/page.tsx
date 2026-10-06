import { PageHeader, Panel } from "@/components/ui";
import { UnblockAction } from "@/components/network/request-actions";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { listBlockedUsers } from "@/lib/network/blocks";

export default async function BlockedPage() {
  const { user } = await requireAuthenticatedSession(); const blocked = await listBlockedUsers(user.id);
  return <div className="space-y-6"><PageHeader title="Pessoas bloqueadas" description="O bloqueio impede descoberta e contato dentro da plataforma. Vínculos em equipes e projetos e mensagens anteriores permanecem preservados." /><Panel><p className="border-b border-line px-5 py-4 text-sm leading-6 text-slate">Desbloquear permite novos contatos, mas não restaura conexões nem solicitações canceladas. Conteúdo público pode continuar acessível fora da plataforma.</p>{blocked.length ? <ul className="divide-y divide-line">{blocked.map((person) => <li key={person.userId} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="min-w-0 break-words font-medium">{person.fullName}</p><UnblockAction userId={person.userId} /></li>)}</ul> : <p className="p-6 text-sm text-slate">Você não bloqueou nenhuma pessoa.</p>}</Panel></div>;
}
