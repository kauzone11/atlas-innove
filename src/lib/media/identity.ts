export function avatarMonogram(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => Array.from(part)[0]).join("").toLocaleUpperCase("pt-BR") || "AI";
}
