"use client";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function SaveOpportunityButton({ id, kind, saved }: { id: string; kind: "INTERNAL" | "EXTERNAL"; saved: boolean }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  async function change() {
    setPending(true); setError(null);
    try { const response = await fetch(`/api/personal/opportunities/saved/${kind}/${id}`, { method: saved ? "DELETE" : "PUT" }); const payload = await response.json() as { error?: string }; if (!response.ok) { setError(payload.error ?? "Não foi possível atualizar os salvos."); return; } router.refresh(); }
    catch { setError("Não foi possível conectar. Tente salvar novamente."); } finally { setPending(false); }
  }
  return <div><button type="button" className="button-secondary" disabled={pending} onClick={change} aria-pressed={saved}>{saved ? <BookmarkCheck size={16} aria-hidden="true" /> : <Bookmark size={16} aria-hidden="true" />}{pending ? "Salvando…" : saved ? "Remover dos salvos" : "Salvar"}</button>{error ? <p role="alert" className="mt-2 max-w-xs text-xs text-danger">{error}</p> : null}</div>;
}
