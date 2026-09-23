import Link from "next/link";

import { AcceptInvitationAction } from "@/components/accept-invitation-action";
import { getAuthenticatedSession } from "@/lib/auth/session";

export const metadata = { title: "Aceitar convite" };

export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const auth = await getAuthenticatedSession();
  const loginHref = token ? `/login?next=${encodeURIComponent(`/invitations/accept?token=${token}`)}` : "/login";
  return <main className="flex min-h-screen items-center justify-center bg-canvas px-6 py-12"><section className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-panel"><Link href="/" className="text-lg font-semibold text-ink">Atlas Innove</Link><h1 className="mt-8 text-2xl font-semibold text-ink">Convite de organização</h1>{token && auth ? <AcceptInvitationAction token={token} /> : token ? <><p className="mt-3 text-sm leading-6 text-slate">Entre na sua conta para aceitar este convite.</p><Link href={loginHref} className="mt-6 inline-flex rounded-lg bg-accent px-4 py-2.5 font-semibold text-white hover:bg-accent-dark">Entrar</Link></> : <p className="mt-3 text-sm leading-6 text-slate">Este convite não contém um token válido.</p>}</section></main>;
}
