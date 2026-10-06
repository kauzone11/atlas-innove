"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/dialog";
import { personalRequest } from "@/components/personal/record-form";

export function ProfilePublicationControl({ published, ready, handle }: { published: boolean; ready: boolean; handle: string | null }) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null);
    try { await personalRequest("/api/personal/profile", "PATCH", published ? { section: "unpublish" } : { section: "publish", confirmed: new FormData(event.currentTarget).get("confirmed") === "on" }); setOpen(false); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Não foi possível alterar a publicação."); }
    finally { setPending(false); }
  }
  return <><button className={published ? "button-secondary" : "button-primary"} disabled={!published && !ready} type="button" onClick={() => { setError(null); setOpen(true); }}>{published ? "Retirar publicação" : "Publicar perfil"}</button>
    <Dialog open={open} title={published ? "Retirar publicação" : "Publicar perfil"} description={published ? "O endereço público deixará de abrir. Todos os dados do seu perfil serão preservados." : "Seu nome, apresentação, localização e texto sobre você poderão ser vistos sem login. Outras seções seguem as escolhas de privacidade."} onClose={() => { if (!pending) setOpen(false); }}>
      <form className="space-y-4" onSubmit={submit}>{!published ? <><p className="break-all rounded-lg bg-surface-subtle p-3 text-sm">/people/{handle}</p><label className="flex items-start gap-3 text-sm leading-6"><input className="mt-1.5" type="checkbox" name="confirmed" required disabled={pending} />Confirmo a publicação do meu perfil e revisei as seções visíveis.</label></> : null}{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}<div className="flex flex-wrap gap-3"><button className="button-secondary" type="button" disabled={pending} onClick={() => setOpen(false)}>Cancelar</button><button className="button-primary" disabled={pending}>{pending ? "Salvando…" : published ? "Confirmar retirada" : "Confirmar publicação"}</button></div></form>
    </Dialog></>;
}
