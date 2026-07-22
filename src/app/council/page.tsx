import { redirect } from "next/navigation";
import { getCouncilShellAccess } from "./access";

export const dynamic = "force-dynamic";

export default async function CouncilPage() {
  const access = await getCouncilShellAccess();

  if (!access.allowed) {
    return null;
  }

  redirect(access.canViewUsers ? "/council/users" : "/council/audit");
}
