import { NextResponse } from "next/server";
import { getStore } from "@/lib/data";
import { getCurrentUser, canEdit } from "@/lib/auth";
import { buildSignHtml } from "@/lib/termsheet";
import type { TermSheetSigners, TermSheetSubmitter } from "@/lib/termsheet";
import { createSubmission, createTemplateFromHtml, docusealConfigured, docusealSubmissionUrl } from "@/lib/docuseal";
import { sendSignInvite, mailerConfigured } from "@/lib/mailer";
import { generateShareToken } from "@/lib/token";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SignerInput {
  role: string;
  name?: string;
  email: string;
  /** GSM; ingevuld = SMS-verificatie vereist. Wordt genormaliseerd naar E.164. */
  phone?: string;
}

/**
 * Normaliseer een (Belgisch) GSM-nummer naar E.164. "0471 29 30 71" → "+32471293071".
 * Geeft null terug bij een onbruikbaar nummer.
 */
function normalizePhone(raw: string | undefined): string | null | undefined {
  const s = (raw ?? "").replace(/[\s./()-]/g, "");
  if (!s) return undefined; // niet ingevuld = geen SMS-verificatie
  let e164 = s;
  if (e164.startsWith("00")) e164 = "+" + e164.slice(2);
  else if (e164.startsWith("0")) e164 = "+32" + e164.slice(1);
  return /^\+\d{8,15}$/.test(e164) ? e164 : null;
}

/**
 * POST /api/termsheets/[id]/send — verstuur ter ondertekening via DocuSeal.
 * - Term sheets: body { signers: { lessorName?, lessorEmail, lesseeName?, lesseeEmail } };
 *   de huisstijl-HTML wordt eerst als template aangemaakt (/templates/html).
 * - Vrij-documenten: body { signersList: [{ role, name?, email }] }; de template
 *   bestaat al (upload + ingebedde veldeneditor).
 * In beide gevallen: DocuSeal-mails uit, eigen uitnodigingen via SMTP, en per
 * ondertekenaar een stabiele token voor de interactieve pagina (/ondertekenen/t/…).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || !canEdit(user.role)) return NextResponse.json({ error: "Geen rechten." }, { status: 403 });
  if (!docusealConfigured()) {
    return NextResponse.json(
      { error: "DocuSeal is niet gekoppeld: zet DOCUSEAL_URL en DOCUSEAL_API_TOKEN in de omgeving." },
      { status: 500 },
    );
  }

  let body: { signers?: TermSheetSigners; signersList?: SignerInput[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON." }, { status: 400 });
  }

  const store = getStore();
  const rec = await store.getTermSheet(params.id);
  if (!rec) return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });

  // Ondertekenaars normaliseren naar één lijst.
  let signerInputs: SignerInput[];
  let signers: TermSheetSigners | undefined;
  if (rec.payload.vrij) {
    signerInputs = body.signersList ?? [];
    if (signerInputs.length === 0) {
      return NextResponse.json({ error: "Geen ondertekenaars opgegeven." }, { status: 400 });
    }
  } else {
    signers = body.signers ?? {};
    if (!signers.lessorEmail || !emailRe.test(signers.lessorEmail)) {
      return NextResponse.json({ error: "Geef een geldig e-mailadres voor de ondertekenaar van Lease Estate." }, { status: 400 });
    }
    if (!signers.lesseeEmail || !emailRe.test(signers.lesseeEmail)) {
      return NextResponse.json({ error: "Geef een geldig e-mailadres voor de leasingnemer." }, { status: 400 });
    }
    signerInputs = [
      { role: "Leasinggever", name: signers.lessorName, email: signers.lessorEmail, phone: signers.lessorPhone },
      { role: "Leasingnemer", name: signers.lesseeName, email: signers.lesseeEmail, phone: signers.lesseePhone },
    ];
  }
  for (const s of signerInputs) {
    if (!s.email || !emailRe.test(s.email)) {
      return NextResponse.json({ error: `Geef een geldig e-mailadres voor "${s.role}".` }, { status: 400 });
    }
    const norm = normalizePhone(s.phone);
    if (norm === null) {
      return NextResponse.json(
        { error: `Het GSM-nummer voor "${s.role}" is ongeldig — gebruik bv. +32 4xx xx xx xx.` },
        { status: 400 },
      );
    }
    s.phone = norm;
  }

  // Absolute origin van de app (voor de font-URL's en de ondertekenlinks).
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;

  try {
    const templateId = rec.payload.vrij
      ? rec.payload.vrij.templateId
      : (await createTemplateFromHtml(buildSignHtml(rec, origin), rec.title)).id;

    const { submissionId, submitters: created } = await createSubmission(
      templateId,
      signerInputs.map((s) => ({
        role: s.role,
        name: s.name,
        email: s.email,
        // GSM ingevuld = SMS-verificatie: de ondertekenaar moet eerst een
        // sms-code invoeren om het document te openen en te tekenen.
        ...(s.phone ? { phone: s.phone, require_phone_2fa: true } : {}),
      })),
    );

    // Stabiele token per rol (herverzending breekt eerder gemailde links niet)
    // + eigen uitnodigingsmail per ondertekenaar.
    const submitters: TermSheetSubmitter[] = [];
    const mailErrors: Record<string, string | null> = {};
    for (const s of signerInputs) {
      const fromApi = created.find((c) => c.role === s.role) ?? created.find((c) => c.email === s.email);
      const prev = rec.payload.docuseal?.submitters?.find((x) => x.role === s.role);
      const token = prev?.token ?? generateShareToken();
      const signUrl = `${origin}/ondertekenen/t/${token}`;
      const mailResult = await sendSignInvite({
        to: s.email,
        toName: s.name,
        documentTitle: rec.title,
        signUrl,
      });
      submitters.push({
        role: s.role,
        name: s.name,
        email: s.email,
        phone: s.phone,
        slug: fromApi?.slug ?? null,
        token,
        mailed: mailResult.ok,
      });
      mailErrors[s.role] = mailResult.error ?? null;
    }

    const updated = await store.updateTermSheet(params.id, {
      status: "sent",
      payload: {
        ...rec.payload,
        ...(signers ? { signers } : {}),
        docuseal: { templateId, submissionId, sentAt: new Date().toISOString(), submitters },
      },
    });
    return NextResponse.json({
      termSheet: updated,
      docusealUrl: docusealSubmissionUrl(submissionId),
      mailerConfigured: mailerConfigured(),
      signLinks: submitters.map((s) => ({
        role: s.role,
        email: s.email,
        url: `${origin}/ondertekenen/t/${s.token}`,
        mailed: s.mailed,
        mailError: mailErrors[s.role] ?? null,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: "Verzenden mislukt: " + (e as Error).message }, { status: 502 });
  }
}
