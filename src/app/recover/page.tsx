import { AuthShell } from "@/components/auth/auth-shell";
import { RecoverForm } from "@/components/recover-form";

export const metadata = { title: "Recuperar senha" };

export default function RecoverPage() {
  return <AuthShell title="Recuperar senha" description="Informe seu e-mail para receber as instruções."><RecoverForm /></AuthShell>;
}
