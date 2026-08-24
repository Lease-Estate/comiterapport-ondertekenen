/**
 * Minimale client voor de zelf-gehoste DocuSeal-instantie (Railway).
 * Env: DOCUSEAL_URL (bv. https://sign.lease-estate.digital) — ook gebruikt
 * voor de kaart op de dossierlijst — en DOCUSEAL_API_TOKEN (DocuSeal →
 * Settings → API). Flow: HTML → POST /templates/html (DocuSeal rendert naar
 * PDF met de velden op hun plaats) → POST /submissions met de ondertekenaars,
 * die elk per e-mail een uitnodiging krijgen.
 */

function baseUrl(): string {
  const url = process.env.DOCUSEAL_URL?.trim();
  if (!url) throw new Error("DOCUSEAL_URL ontbreekt op de server.");
  return url.replace(/\/+$/, "");
}

function token(): string {
  const t = process.env.DOCUSEAL_API_TOKEN?.trim();
  if (!t) throw new Error("DOCUSEAL_API_TOKEN ontbreekt op de server (DocuSeal → Settings → API).");
  return t;
}

export function docusealConfigured(): boolean {
  return Boolean(process.env.DOCUSEAL_URL?.trim() && process.env.DOCUSEAL_API_TOKEN?.trim());
}

async function call<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${baseUrl()}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Auth-Token": token() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Diagnose in de serverlogs zonder de token te lekken: host + lengte +
    // eerste/laatste 2 tekens volstaan om een verkeerd geplakte env-waarde
    // te herkennen tegenover de token in DocuSeal → Settings → API.
    const t = token();
    console.error(
      `[docuseal] ${path} → HTTP ${res.status} | host=${baseUrl()} | token: lengte=${t.length}, begint met "${t.slice(0, 2)}…", eindigt op "…${t.slice(-2)}"`,
    );
    throw new Error(`DocuSeal ${path} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export async function createTemplateFromHtml(html: string, name: string): Promise<{ id: number }> {
  return call<{ id: number }>("/templates/html", { html, name });
}

export interface DocusealSubmitter {
  role: string;
  name?: string;
  email: string;
  /** E.164-nummer; samen met require_phone_2fa activeert dit SMS-verificatie. */
  phone?: string;
  /** Ondertekenaar moet eerst een sms-code invoeren om het document te openen. */
  require_phone_2fa?: boolean;
}

interface SubmissionResponseItem {
  id: number;
  submission_id?: number;
  email?: string;
  role?: string;
  slug?: string;
  embed_src?: string;
}

export interface CreatedSubmitter {
  role: string;
  email: string;
  /** Slug voor de embed-/ondertekenlink ({DOCUSEAL_URL}/s/{slug}). */
  slug: string | null;
}

/**
 * Maak de submission aan ZONDER DocuSeal-mails (send_email: false): de app
 * verstuurt zelf de uitnodigingen met een link naar de eigen interactieve
 * ondertekenpagina, waarin het DocuSeal-formulier is ingebed.
 */
export async function createSubmission(
  templateId: number,
  submitters: DocusealSubmitter[],
): Promise<{ submissionId: number | null; submitters: CreatedSubmitter[] }> {
  const resp = await call<SubmissionResponseItem[] | { id: number; submitters?: SubmissionResponseItem[] }>(
    "/submissions",
    {
      template_id: templateId,
      send_email: false,
      submitters,
    },
  );
  // De API geeft (afhankelijk van versie) een lijst submitters of een object terug.
  const items = Array.isArray(resp) ? resp : (resp.submitters ?? []);
  const created: CreatedSubmitter[] = items.map((s) => ({
    role: s.role ?? "",
    email: s.email ?? "",
    slug: s.slug ?? (s.embed_src ? s.embed_src.split("/").pop() ?? null : null),
  }));
  const submissionId = Array.isArray(resp)
    ? (resp[0]?.submission_id ?? resp[0]?.id ?? null)
    : (resp.id ?? null);
  return { submissionId, submitters: created };
}

/** Publieke ondertekenlink van een submitter op de DocuSeal-instantie. */
export function docusealSignUrl(slug: string): string {
  return `${baseUrl()}/s/${slug}`;
}

/** Hostnaam van de instantie (voor data-host op de embed-componenten). */
export function docusealHost(): string {
  return new URL(baseUrl()).host;
}

/** Maak een template aan vanuit een geüploade PDF (Pro API, vrij-document-flow). */
export async function createTemplateFromPdf(name: string, pdfBase64: string): Promise<{ id: number }> {
  return call<{ id: number }>("/templates/pdf", {
    name,
    documents: [{ name, file: pdfBase64 }],
  });
}

/** Rollen (ondertekenaars-partijen) van een bestaande template. */
export async function getTemplateRoles(templateId: number): Promise<string[]> {
  // cache: no-store — Next's Data Cache zou verouderde rollen teruggeven.
  const res = await fetch(`${baseUrl()}/api/templates/${templateId}`, {
    headers: { "X-Auth-Token": token() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`DocuSeal /templates/${templateId} → HTTP ${res.status}`);
  const data = (await res.json()) as { submitters?: { name?: string }[] };
  const roles = (data.submitters ?? []).map((s) => s.name ?? "").filter(Boolean);
  return roles.length > 0 ? roles : ["First Party"];
}

/**
 * E-mailadres van de template-auteur = de eigenaar van de API-token. Nodig als
 * user_email in de builder-JWT: dat MOET een bestaand account op de instantie
 * zijn, en gokken via env bleek foutgevoelig.
 */
export async function getTemplateAuthorEmail(templateId: number): Promise<string | null> {
  try {
    const res = await fetch(`${baseUrl()}/api/templates/${templateId}`, {
      headers: { "X-Auth-Token": token() },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[docuseal] auteur-lookup /templates/${templateId} → HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { author?: { email?: string }; author_id?: number };
    const email = data.author?.email ?? null;
    console.error(`[docuseal] auteur-lookup template ${templateId}:`, email ?? "GEEN author.email in antwoord", {
      keys: Object.keys(data ?? {}).slice(0, 20),
    });
    return email;
  } catch (e) {
    console.error("[docuseal] auteur-lookup faalde:", (e as Error).message);
    return null;
  }
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/**
 * HS256-JWT voor de ingebedde veldeneditor (docuseal-builder), server-side
 * ondertekend met de API-token. user_email = de eigenaar van de API-token
 * (DOCUSEAL_ADMIN_EMAIL, met SMTP_USER als terugval).
 */
export function builderToken(opts: { templateId?: number; name?: string; userEmail?: string }): string {
  // node:crypto — alleen serverside gebruiken.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createHmac } = require("node:crypto") as typeof import("node:crypto");
  // DOCUSEAL_ADMIN_EMAIL wint bewust van de auteur-lookup: na de gebruikers-
  // opruiming op de instantie kan de template-auteur naar een niet-(meer-)
  // bestaand account verwijzen, terwijl de builder een bestaand account eist.
  const userEmail = process.env.DOCUSEAL_ADMIN_EMAIL?.trim() || opts.userEmail?.trim() || process.env.SMTP_USER?.trim();
  if (!userEmail) throw new Error("Geen user_email voor de builder-token (template-auteur onbekend en env ontbreekt).");
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      user_email: userEmail,
      ...(opts.templateId ? { template_id: opts.templateId } : {}),
      ...(opts.name ? { name: opts.name } : {}),
    }),
  );
  const sig = createHmac("sha256", token()).update(`${header}.${payload}`).digest("base64")
    .replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${header}.${payload}.${sig}`;
}

export function docusealSubmissionUrl(submissionId: number | null): string | null {
  if (!submissionId || !process.env.DOCUSEAL_URL) return null;
  return `${baseUrl()}/submissions/${submissionId}`;
}
