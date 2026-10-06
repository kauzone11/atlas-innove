import type { Prisma } from "@prisma/client";
import { AuthorizationError } from "@/lib/auth/authorization";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function requireSuperAdminUser(userId: string, client: Prisma.TransactionClient = db): Promise<void> {
  const user = await client.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (user?.platformRole !== "SUPER_ADMIN") throw new AuthorizationError("PLATFORM_ROLE_FORBIDDEN");
}

export async function requireSuperAdminSession() {
  const auth = await requireAuthenticatedSession();
  await requireSuperAdminUser(auth.user.id);
  return auth;
}
