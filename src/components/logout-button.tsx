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
  return <button type="button" onClick={logout} className="button-tertiary min-h-11 w-full justify-start px-2 text-sm text-slate hover:text-ink"><LogOut size={16} aria-hidden="true" /> Sair</button>;
}
