"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/dialog";
import { StartConversation } from "@/components/communication/actions";
import { ReportContact } from "@/components/communication/safety-report";
import { personalRequest } from "@/components/personal/record-form";
import type { PersonNetworkState } from "@/lib/network/connections";
import type { InviteOptions } from "@/lib/network/invites";

export function BlockContact({ userId }: { userId: string }) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  return <><button className="button-tertiary" onClick={() => setOpen(true)}>Bloquear pessoa</button><Dialog open={open} onClose={() => { if (!pending) setOpen(false); }} title="Bloquear pessoa" description="O bloqueio impede descoberta e contato dentro do Atlas Innove. Os vínculos em equipes e projetos e as mensagens anteriores permanecem preservados. Conteúdo público pode continuar acessível na web.">{error ? <p className="mb-4 text-sm text-danger" role="alert">{error}</p> : null}<div className="flex flex-wrap gap-3"><button className="button-secondary" disabled={pending} onClick={() => setOpen(false)}>Cancelar</button><button className="button-primary" disabled={pending} onClick={async () => { setPending(true); setError(null); try { await personalRequest("/api/personal/network/blocks", "POST", { blockedUserId: userId }); setOpen(false); router.refresh(); } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível bloquear."); } finally { setPending(false); } }}>{pending ? "Registrando…" : "Confirmar bloqueio"}</button></div></Dialog></>;
}

export function PersonNetworkActions({ userId, connection, inviteOptions = { teams: [], projects: [] }, self = false, primaryConnect = true }: { userId: string; handle?: string; connection: PersonNetworkState; inviteOptions?: InviteOptions; self?: boolean; primaryConnect?: boolean }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"connect" | "team" | "project" | "block" | "disconnect" | null>(null);
  const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState(""); const [selected, setSelected] = useState("");
  const options = dialog === "team" ? inviteOptions.teams : inviteOptions.projects;
  const filtered = options.filter((option) => option.name.toLocaleLowerCase("pt-BR").includes(filter.toLocaleLowerCase("pt-BR")));
  if (self) return null;
  async function act(url: string, method: string, input?: unknown) {
    setPending(true); setError(null); setNotice(null);
    try { await personalRequest(url, method, input); setDialog(null); setNotice("Alteração registrada."); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Não foi possível concluir a ação."); }
    finally { setPending(false); }
  }
  function open(value: typeof dialog) { setDialog(value); setError(null); setNotice(null); setFilter(""); setSelected(""); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    if (dialog === "connect") await act("/api/personal/network/connections", "POST", { recipientUserId: userId, message: data.get("message") || null });
    else if ((dialog === "team" || dialog === "project") && selected) await act(`/api/personal/network/${dialog === "team" ? "teams" : "projects"}/${selected}/invites`, "POST", { invitedUserId: userId, role: data.get("role") });
  }
  return <div className="social-network-actions"><div className="flex flex-wrap items-center gap-2">
    {connection.state === "AVAILABLE" ? <button className={primaryConnect ? "button-primary" : "button-secondary"} onClick={() => open("connect")}>Conectar</button> : null}
    {connection.state === "OUTGOING" ? <span className="social-relationship-status">Solicitação enviada</span> : null}
    {connection.state === "INCOMING" ? <><button disabled={pending} className="button-primary" onClick={() => void act(`/api/personal/network/connections/${connection.requestId}`, "PATCH", { action: "accept" })}>Aceitar solicitação</button><button disabled={pending} className="button-secondary" onClick={() => void act(`/api/personal/network/connections/${connection.requestId}`, "PATCH", { action: "decline" })}>Recusar</button></> : null}
    {connection.state === "CONNECTED" ? <StartConversation otherUserId={userId} /> : null}
    <details className="social-overflow"><summary className="button-secondary">Outras ações</summary><div className="social-overflow-panel">
      {connection.state === "OUTGOING" ? <button disabled={pending} className="button-tertiary" onClick={() => void act(`/api/personal/network/connections/${connection.requestId}`, "PATCH", { action: "cancel" })}>Cancelar solicitação</button> : null}
      {connection.state === "CONNECTED" ? <button className="button-tertiary" onClick={() => open("disconnect")}>Desconectar</button> : null}
      {inviteOptions.projects.length ? <button className="button-tertiary" onClick={() => open("project")}>Convidar para projeto</button> : null}
      {inviteOptions.teams.length ? <button className="button-tertiary" onClick={() => open("team")}>Convidar para equipe</button> : null}
      <button className="button-tertiary" onClick={() => open("block")}>Bloquear pessoa</button><ReportContact reportedUserId={userId} />
    </div></details>
  </div>{notice ? <p className="text-sm text-slate" role="status">{notice}</p> : null}{error && !dialog ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
  <Dialog open={Boolean(dialog)} onClose={() => { if (!pending) setDialog(null); }} title={dialog === "connect" ? "Solicitar conexão" : dialog === "team" ? "Convidar para equipe" : dialog === "project" ? "Convidar para projeto" : dialog === "disconnect" ? "Encerrar conexão" : "Bloquear pessoa"} description={dialog === "block" ? "O bloqueio impede descoberta e contato dentro do Atlas Innove. Conteúdo já público pode continuar acessível na web. Os vínculos em equipes e projetos e as mensagens anteriores serão preservados." : dialog === "disconnect" ? "O período de conexão e as mensagens anteriores serão preservados. Uma nova conversa exige reconexão." : undefined}>
    {error ? <p className="mb-4 text-sm text-danger" role="alert">{error}</p> : null}
    {dialog === "block" || dialog === "disconnect" ? <div className="flex flex-wrap gap-3"><button className="button-secondary" disabled={pending} onClick={() => setDialog(null)}>Cancelar</button><button className="button-primary" disabled={pending} onClick={() => void act(dialog === "block" ? "/api/personal/network/blocks" : `/api/personal/network/connections/${connection.connectionId}/disconnect`, "POST", dialog === "block" ? { blockedUserId: userId } : undefined)}>{pending ? "Registrando…" : "Confirmar"}</button></div> : <form onSubmit={submit} className="space-y-4">
      {dialog === "connect" ? <label className="block text-sm font-medium"><span>Mensagem (opcional)</span><textarea className="field-control mt-2" name="message" rows={3} maxLength={500} /></label> : <><p className="text-sm leading-6 text-slate">{dialog === "project" ? "A pessoa receberá um convite para colaborar neste projeto, sem entrar automaticamente na equipe." : "A pessoa poderá escolher se deseja entrar nesta equipe."}</p>{options.length > 10 ? <label className="block text-sm"><span>Buscar {dialog === "team" ? "equipe" : "projeto"}</span><input className="field-control mt-2" value={filter} onChange={(event) => { setFilter(event.target.value); setSelected(""); }} /></label> : null}<label className="block text-sm"><span>{dialog === "team" ? "Equipe" : "Projeto"}</span><select className="field-control mt-2" required value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Selecione</option>{filtered.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><label className="block text-sm"><span>Perfil oferecido</span><select className="field-control mt-2" name="role" key={selected}><option value="MEMBER">Membro</option>{options.find((option) => option.id === selected)?.canInviteLead ? <option value="LEAD">Líder</option> : null}</select></label></>}
      <button className="button-primary" disabled={pending || (dialog !== "connect" && !selected)}>{pending ? "Enviando…" : dialog === "connect" ? "Enviar solicitação" : "Enviar convite"}</button>
    </form>}
  </Dialog></div>;
}
