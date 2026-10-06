"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { personalRequest } from "@/components/personal/record-form";

export function InviteAcceptance({ token }: { token: string }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  async function accept() { setPending(true); setError(null); try { const payload = await personalRequest("/api/personal/invites/accept", "POST", { token }); router.replace(`/app/personal/teams/${payload.team.id}`); } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível aceitar o convite."); setPending(false); } }
  return <div className="mt-5 space-y-4">{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}<button className="button-primary" disabled={pending} onClick={accept}>{pending ? "Validando convite…" : "Aceitar convite e entrar na equipe"}</button></div>;
}
