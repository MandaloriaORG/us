import { redirect } from "next/navigation";
import { getCouncilShellAccess } from "./access";

export const dynamic = "force-dynamic";

export default async function CouncilPage() {
  const access = await getCouncilShellAccess();

  if (!access.allowed) {
    return null;
  }

  const firstDestination =
    (access.canViewUsers && "/council/users") ||
    (access.canManageCodex && "/council/codex") ||
    (access.canViewReports && "/council/reports") ||
    (access.canManagePlazas && "/council/plazas") ||
    (access.canManageSettings && "/council/settings") ||
    "/council/audit";

  redirect(firstDestination);
}
