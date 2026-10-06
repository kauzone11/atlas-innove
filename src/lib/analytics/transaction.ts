import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { DomainConflictError } from "@/lib/errors";

export async function withAnalyticsSnapshot<T>(action: (client: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(action, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 60000 });
    } catch (error) {
      // PostgreSQL explicitly aborted these transactions; unknown commit outcomes are never replayed.
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2010" && error.meta?.code === "40001");
      if (!retryable) throw error;
    }
  }
  throw new DomainConflictError("ANALYTICS_SOURCE_CHANGED");
}
