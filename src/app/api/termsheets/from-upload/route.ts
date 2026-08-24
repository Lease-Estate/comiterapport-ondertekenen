import { NextResponse } from "next/server";
import { getStore } from "@/lib/data";
import { getCurrentUser, canEdit } from "@/lib/auth";
import { initialTermSheetHtml } from "@/lib/termsheet";
import { extractTermSheetFills } from "@/lib/termsheet-extract";

export const maxDuration = 120;
const MAX_BYTES = 32 * 1024 * 1024;

/**
 * POST /api/termsheets/from-upload — nieuwe term sheet vanuit een geüploade
 * PDF (bv. Indicatief Leaserapport) of HTML (bv. geëxporteerd comitérapport).
 * Claude extraheert de veldwaarden; het resultaat blijft daarna volledig
 * handmatig bewerkbaar in /ondertekenen/[id].
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canEdit(user.role)) return NextResponse.json({ error: "Geen rechten." }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY ontbreekt op de server." }, { status: 500 });
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: "Verwacht multipart/form-data." }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: "Geen bestand ontvangen." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Bestand te groot (max 32 MB)." }, { status: 413 });

  const name = file.name.toLowerCase();
  const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
  const isHtml = file.type === "text/html" || name.endsWith(".html") || name.endsWith(".htm");
  if (!isPdf && !isHtml) {
    return NextResponse.json({ error: "Alleen PDF of HTML wordt ondersteund." }, { status: 415 });
  }

  try {
    const fills = isPdf
      ? await extractTermSheetFills({ kind: "pdf", base64: Buffer.from(await file.arrayBuffer()).toString("base64") })
      : await extractTermSheetFills({ kind: "html", html: await file.text() });

    const title = fills.lnNaam ? `Term sheet — ${fills.lnNaam}` : `Term sheet — ${file.name.replace(/\.(pdf|html?)$/i, "")}`;
    const rec = await getStore().createTermSheet({
      title,
      dossierSlug: null,
      payload: {
        bodyHtml: initialTermSheetHtml(fills),
        diagramLayout: null,
        signers: { lessorName: user.fullName ?? undefined, lessorEmail: user.email ?? undefined },
      },
      createdBy: user.id ?? null,
    });
    return NextResponse.json({ termSheet: rec }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Extractie mislukt: " + (e as Error).message }, { status: 502 });
  }
}
