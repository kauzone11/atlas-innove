import { redirect } from "next/navigation";

export default function LegacyTeamPage() {
  redirect("/app/members");
}
