import { createOpaqueToken } from "@/lib/security";

export function createOrganizationSlug(name: string): string {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${normalized || "instituicao"}-${createOpaqueToken(3)}`;
}
