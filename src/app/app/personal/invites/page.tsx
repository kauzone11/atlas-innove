import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui";
import { InviteAcceptance } from "@/components/personal/invite-acceptance";
import { requireAuthenticatedSession } from "@/lib/auth/session";

export default async function PersonalInvite({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  await requireAuthenticatedSession(); const { token } = await searchParams; const valid = typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
  return <div className="space-y-6"><PageHeader title="Convite para equipe" description="O convite será validado para a conta com que você está conectado." /><Panel className="max-w-2xl p-6">{valid ? <><h2 className="text-lg font-semibold">Participar de uma equipe</h2><p className="mt-3 text-sm leading-6 text-slate">Ao aceitar, você terá acesso à equipe e aos seus projetos conforme o perfil definido pelo convite. Um link válido pode ser utilizado apenas uma vez.</p><InviteAcceptance token={token} /></> : <><h2 className="font-semibold">Link de convite inválido</h2><p className="mt-2 text-sm text-slate">Solicite um novo link à liderança da equipe.</p><Link className="button-secondary mt-5" href="/app/personal/teams">Ver minhas equipes</Link></>}</Panel></div>;
}
