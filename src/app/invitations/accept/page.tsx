import Link from "next/link";

import { AcceptInvitationAction } from "@/components/accept-invitation-action";
import { getAuthenticatedSession } from "@/lib/auth/session";

export const metadata = { title: "Aceitar convite" };

export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const auth = await getAuthenticatedSession();
  const loginHref = token ? `/login?next=${encodeURIComponent(`/invitations/accept?token=${token}`)}` : "/login";
  return <main className="flex min-h-screen items-center justify-center bg-canvas px-5 py-10"><section className="panel w-full max-w-md p-6 sm:p-8"><Link href="/" className="text-lg font-semibold text-ink">Atlas Innove</Link><h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink">Convite de organização</h1>{token && auth ? <AcceptInvitationAction token={token} /> : token ? <><p className="mt-3 text-sm leading-6 text-slate">Entre na sua conta para aceitar este convite.</p><Link href={loginHref} className="button-primary mt-6">Entrar</Link></> : <p className="mt-3 text-sm leading-6 text-slate">Este convite não contém um token válido.</p>}</section></main>;
}
