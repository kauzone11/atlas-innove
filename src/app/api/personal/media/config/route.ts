import { socialRead } from "@/lib/social/api";
import { isStorageConfigured } from "@/lib/storage/config";
export async function GET() { return socialRead(async () => ({ enabled: isStorageConfigured() })); }
