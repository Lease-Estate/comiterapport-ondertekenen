import { NextResponse } from "next/server";
import { getStore } from "@/lib/data";
import { getCurrentUser, canEdit } from "@/lib/auth";
import { getTemplateRoles } from "@/lib/docuseal";

export const dynamic = "force-dynamic";

/**
 * GET /api/termsheets/[id]/roles — de ondertekenaarsrollen van het document.
 * Term sheets hebben vaste rollen; vrij-documenten lezen ze uit de DocuSeal-
 * template (de partijen zoals in de veldeneditor gedefinieerd).
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || !canEdit(user.role)) return NextResponse.json({ error: "Geen rechten." }, { status: 403 });

  const rec = await getStore().getTermSheet(params.id);
  if (!rec) return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });

  if (!rec.payload.vrij) return NextResponse.json({ roles: ["Leasinggever", "Leasingnemer"] });
  try {
    return NextResponse.json({ roles: await getTemplateRoles(rec.payload.vrij.templateId) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
