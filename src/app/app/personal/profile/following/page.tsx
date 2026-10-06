import { FollowList } from "@/components/social/follow-list";
import { requireAuthenticatedSession } from "@/lib/auth/session";
export default async function Following({ searchParams }: { searchParams: Promise<{ page?: string }> }) { const { user } = await requireAuthenticatedSession(); return <FollowList userId={user.id} direction="following" {...await searchParams} />; }
