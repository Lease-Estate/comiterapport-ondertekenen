import { NextResponse } from "next/server";
import { getStore } from "@/lib/data";
import { getCurrentUser, canEdit } from "@/lib/auth";
import { createTemplateFromPdf, docusealConfigured } from "@/lib/docuseal";

export const maxDuration = 60;
const MAX_BYTES = 32 * 1024 * 1024;

/**
 * POST /api/termsheets/vrij — vrij-document-flow: upload een willekeurige PDF,
 * die als DocuSeal-template wordt aangemaakt (Pro API). De velden (naam,
 * datum, handtekening, …) plaatst de gebruiker daarna zelf in de ingebedde
 * veldeneditor op /ondertekenen/vrij/[id].
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canEdit(user.role)) return NextResponse.json({ error: "Geen rechten." }, { status: 403 });
  if (!docusealConfigured()) {
    return NextResponse.json(
      { error: "DocuSeal is niet gekoppeld: zet DOCUSEAL_URL en DOCUSEAL_API_TOKEN in de omgeving." },
      { status: 500 },
    );
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
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return NextResponse.json({ error: "Alleen PDF wordt ondersteund." }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "PDF te groot (max 32 MB)." }, { status: 413 });

  const name = file.name.replace(/\.pdf$/i, "");
  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const template = await createTemplateFromPdf(name, base64);
    const rec = await getStore().createTermSheet({
      title: name,
      dossierSlug: null,
      payload: { bodyHtml: "", vrij: { templateId: template.id } },
      createdBy: user.id ?? null,
    });
    return NextResponse.json({ termSheet: rec }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Aanmaken mislukt: " + (e as Error).message }, { status: 502 });
  }
}
