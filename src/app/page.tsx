import { redirect } from "next/navigation";

import { getAuthenticatedSession } from "@/lib/auth/session";

export default async function HomePage() {
  const auth = await getAuthenticatedSession();
  redirect(auth ? "/app" : "/login");
}
