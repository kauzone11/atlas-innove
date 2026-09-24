"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Member = { id: string; role: string; status: "ACTIVE" | "DISABLED"; user: { email: string; fullName: string } };

export function TeamManager({ organizationId, canManage }: { organizationId: string; canManage: boolean }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("VIEWER");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const loadMembers = useCallback(async () => {
    const response = await fetch(`/api/organizations/${organizationId}/members`);
    if (!response.ok) throw new Error("Não foi possível carregar a equipe.");
    const payload = (await response.json()) as { members: Member[] };
    setMembers(payload.members);
  }, [organizationId]);

  useEffect(() => { void loadMembers().catch((reason: Error) => setError(reason.message)); }, [loadMembers]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setNotice(null); setError(null);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role }) });
      const payload = (await response.json()) as { error?: string; developmentToken?: string };
      if (!response.ok) { setError(payload.error ?? "Não foi possível criar o convite."); return; }
      setEmail("");
      setNotice(payload.developmentToken ? `Convite criado. Token de desenvolvimento: ${payload.developmentToken}` : "Convite criado. A entrega por e-mail será conectada em uma etapa posterior.");
      await loadMembers();
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  async function toggle(member: Member) {
    setPending(true); setNotice(null); setError(null);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/members/${member.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: member.status === "ACTIVE" ? "DISABLED" : "ACTIVE" }) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) { setError(payload.error ?? "Não foi possível atualizar o membro."); return; }
      await loadMembers();
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  return (
    <div className="space-y-8">
      {canManage ? <form onSubmit={invite} className="panel p-6"><h2 className="font-semibold text-ink">Convidar pessoa</h2><p className="mt-1 text-sm text-slate">Defina o papel da pessoa antes de enviar o convite.</p><div className="mt-5 grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end"><label className="block space-y-2 text-sm font-medium text-ink" htmlFor="invite-email"><span>E-mail</span><input id="invite-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@instituicao.org" autoComplete="email" className="field-control" /></label><label className="block space-y-2 text-sm font-medium text-ink" htmlFor="invite-role"><span>Papel</span><select id="invite-role" value={role} onChange={(event) => setRole(event.target.value)} className="field-control"><option value="VIEWER">Visualizador</option><option value="ANALYST">Analista</option><option value="MANAGER">Gestor</option><option value="ADMIN">Administrador</option></select></label><button disabled={pending} className="button-primary">Convidar</button></div></form> : null}
      {notice ? <p className="break-all rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">{notice}</p> : null}
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p> : null}
      <section className="panel"><div className="panel-header"><h2>Pessoas com acesso</h2><p>{members.length} {members.length === 1 ? "pessoa" : "pessoas"} nesta organização.</p></div><div className="divide-y divide-line">{members.map((member) => <div key={member.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-ink">{member.user.fullName}</p><p className="text-sm text-slate">{member.user.email}</p></div><div className="flex items-center gap-3"><span className="status-badge status-neutral">{roleLabel(member.role)} · {member.status === "ACTIVE" ? "Ativo" : "Desativado"}</span>{canManage && member.role !== "OWNER" ? <button type="button" disabled={pending} onClick={() => toggle(member)} className="button-secondary min-h-9 px-3 text-xs">{member.status === "ACTIVE" ? "Desativar" : "Reativar"}</button> : null}</div></div>)}{members.length === 0 ? <p className="px-6 py-8 text-sm text-slate">Nenhuma pessoa encontrada.</p> : null}</div></section>
    </div>
  );
}

function roleLabel(role: string): string {
  return ({ OWNER: "Responsável", ADMIN: "Administrador", MANAGER: "Gestor", ANALYST: "Analista", VIEWER: "Visualizador" } as Record<string, string>)[role] ?? role;
}
