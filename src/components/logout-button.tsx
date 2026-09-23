"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return <button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate hover:bg-white hover:text-ink"><LogOut size={16} aria-hidden="true" /> Sair</button>;
}
