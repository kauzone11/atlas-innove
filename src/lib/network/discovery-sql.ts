import { Prisma } from "@prisma/client";
import { normalizeTag } from "@/lib/identity/normalization";

export function normalizedTagSql(value: Prisma.Sql) {
  return Prisma.sql`trim(both '-' from regexp_replace(lower(regexp_replace(normalize(${value}, NFD), '[̀-ͯ]', '', 'g')), '[^a-z0-9]+', '-', 'g'))`;
}

export function matchesTopicsSql(value: Prisma.Sql, topics: string[]) {
  const keys = [...new Set(topics.map(normalizeTag).filter(Boolean))];
  return keys.length ? Prisma.sql`${value} IN (${Prisma.join(keys)})` : Prisma.sql`FALSE`;
}
