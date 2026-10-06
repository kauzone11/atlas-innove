import { cleanupMedia } from "../src/lib/media/cleanup";
import { db } from "../src/lib/db";

async function main() {
  const limit = Number(process.argv[2] ?? 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Use a batch size between 1 and 100.");
  const result = await cleanupMedia({ limit });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.failed) process.exitCode = 1;
}
main().catch(() => { process.stderr.write("Media cleanup failed; configuration and object access must be verified.\n"); process.exitCode = 1; }).finally(() => db.$disconnect());
