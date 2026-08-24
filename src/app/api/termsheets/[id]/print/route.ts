import { NextResponse } from "next/server";
import { getStore } from "@/lib/data";
import { getCurrentUser, canEdit } from "@/lib/auth";
import { buildSignHtml } from "@/lib/termsheet";

export const dynamic = "force-dynamic";

/**
 * GET /api/termsheets/[id]/print — afdrukversie van de term sheet (gratis
 * DocuSeal-route, zonder Pro-API): dezelfde standalone HTML als de export,
 * maar met onzichtbare {{...}}-teksttags op de handtekeninglijnen en een
 * automatisch afdrukvenster. De gebruiker bewaart als PDF en sleept die in
 * DocuSeal, dat de tags herkent en de velden zelf plaatst.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || !canEdit(user.role)) return NextResponse.json({ error: "Geen rechten." }, { status: 403 });

  const rec = await getStore().getTermSheet(params.id);
  if (!rec) return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const html = buildSignHtml(rec, `${proto}://${host}`, { fields: "texttags", autoPrint: true });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
