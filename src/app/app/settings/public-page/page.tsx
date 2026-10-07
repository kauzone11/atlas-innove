import Link from "next/link";
import { redirect } from "next/navigation";
import { InstitutionPublicPageManagement } from "@/components/institutions/management";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { getPublicPageManagement } from "@/lib/institutions/service";
import { isStorageConfigured } from "@/lib/storage/config";

export const metadata = { title: "Página institucional" };

export default async function InstitutionPublicPageSettings() {
  const context = await getActiveOrganizationContext(); if (!context) redirect("/app/organizations");
  const initial = await getPublicPageManagement(context.organization.id, context.auth.user.id);
  return <div className="space-y-5"><nav aria-label="Configurações"><Link className="button-tertiary" href="/app/settings">Voltar às configurações</Link></nav><InstitutionPublicPageManagement organizationId={context.organization.id} initial={initial} storageEnabled={isStorageConfigured()} /></div>;
}
