import { z } from "zod";

export function normalizeTag(value: string): string {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export const tagListSchema = z.array(z.string().trim().min(1, "Informe um tema.").max(80, "Use até 80 caracteres por tema."))
  .max(20, "Use até 20 temas.")
  .superRefine((tags, context) => {
    const keys = tags.map(normalizeTag);
    if (keys.some((key) => !key)) context.addIssue({ code: "custom", message: "Informe temas com letras ou números." });
    if (new Set(keys).size !== keys.length) context.addIssue({ code: "custom", message: "Remova os temas repetidos." });
  });

const reservedHandles = new Set([
  "app", "api", "demo", "login", "signup", "people", "projects", "opportunities", "admin",
  "logout", "recover", "reset-password", "settings", "profile", "atlas", "atlas-innove",
]);

export const publicHandleSchema = z.string().trim().toLowerCase().min(3, "Use ao menos 3 caracteres no endereço.")
  .max(64, "Use até 64 caracteres no endereço.")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens no endereço.")
  .refine((handle) => !reservedHandles.has(handle), "Este endereço é reservado. Escolha outro.");
