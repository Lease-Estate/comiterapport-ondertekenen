import { NextResponse } from "next/server";
import { getStore } from "@/lib/data";
import { getCurrentUser, canEdit } from "@/lib/auth";
import { dossierToFills, initialTermSheetHtml } from "@/lib/termsheet";
import type { TermSheetFills, TermSheetSigners } from "@/lib/termsheet";

export const dynamic = "force-dynamic";

/** GET /api/termsheets — alle term sheets (lijst op /ondertekenen). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canEdit(user.role)) return NextResponse.json({ error: "Geen rechten." }, { status: 403 });
  const list = await getStore().listTermSheets();
  return NextResponse.json({ termSheets: list });
}

/**
 * POST /api/termsheets — nieuwe term sheet.
 * Body: { dossierSlug?: string } → voorgevuld vanuit het dossier (knop
 * "Ter ondertekening" in het rapport), anders een blanco template.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canEdit(user.role)) return NextResponse.json({ error: "Geen rechten." }, { status: 403 });

  let dossierSlug: string | null = null;
  try {
    const body = (await req.json()) as { dossierSlug?: string };
    dossierSlug = body.dossierSlug?.trim() || null;
  } catch {
    /* leeg body = blanco term sheet */
  }

  const store = getStore();
  let fills: TermSheetFills = {
    datum: new Date().toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" }),
  };
  let title = "Term sheet — onroerende leasing";
  const signers: TermSheetSigners = { lessorName: user.fullName ?? undefined, lessorEmail: user.email ?? undefined };

  if (dossierSlug) {
    const result = await store.getDossier(dossierSlug);
    if (!result) return NextResponse.json({ error: `Dossier "${dossierSlug}" niet gevonden.` }, { status: 404 });
    const d = result.version.data;
    fills = { ...fills, ...dossierToFills(d, dossierSlug) };
    title = `Term sheet — ${d.company?.name || result.record.title}`;
    signers.lesseeName = d.company?.manager || undefined;
    signers.lesseeEmail = d.company?.contactPerson?.email || d.company?.email || undefined;
  }

  const rec = await store.createTermSheet({
    title,
    dossierSlug,
    payload: { bodyHtml: initialTermSheetHtml(fills), diagramLayout: null, signers },
    createdBy: user.id ?? null,
  });
  return NextResponse.json({ termSheet: rec }, { status: 201 });
}
