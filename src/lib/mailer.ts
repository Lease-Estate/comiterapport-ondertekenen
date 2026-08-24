import nodemailer from "nodemailer";

/**
 * Eigen uitnodigingsmails voor het digitaal ondertekenen (de DocuSeal-mails
 * staan uit; de klant krijgt een link naar onze interactieve ondertekenpagina).
 *
 * Twee transports, in volgorde van voorkeur:
 * 1. Microsoft Graph (aanbevolen) — werkt mét Security Defaults, mails
 *    vertrekken echt uit de afzender-mailbox (incl. map Verzonden Items).
 *    Env: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, en de
 *    afzender-mailbox in SMTP_FROM (of SMTP_USER).
 * 2. Klassiek SMTP — Env: SMTP_HOST/PORT/USER/PASS (+ SMTP_FROM).
 * Ontbreekt beide, dan meldt de verzendflow dat de links handmatig gemaild
 * moeten worden — de flow blokkeert nooit op mail.
 */

function graphConfigured(): boolean {
  return Boolean(
    process.env.AZURE_TENANT_ID &&
      process.env.AZURE_CLIENT_ID &&
      process.env.AZURE_CLIENT_SECRET &&
      (process.env.SMTP_FROM || process.env.SMTP_USER),
  );
}

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function mailerConfigured(): boolean {
  return graphConfigured() || smtpConfigured();
}

function senderAddress(): string {
  return (process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "").trim();
}

/* ── Microsoft Graph (client credentials) ── */

let graphToken: { value: string; expiresAt: number } | null = null;

async function getGraphToken(): Promise<string> {
  if (graphToken && Date.now() < graphToken.expiresAt - 60_000) return graphToken.value;
  const res = await fetch(`https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AZURE_CLIENT_ID!,
      client_secret: process.env.AZURE_CLIENT_SECRET!,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
    cache: "no-store",
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(`Graph-token mislukt: ${data.error_description?.slice(0, 200) ?? `HTTP ${res.status}`}`);
  }
  graphToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return graphToken.value;
}

async function sendViaGraph(to: string, subject: string, html: string): Promise<void> {
  const token = await getGraphToken();
  const sender = senderAddress();
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "HTML", content: html },
        toRecipients: [{ emailAddress: { address: to } }],
        from: { emailAddress: { address: sender, name: "Lease Estate" } },
      },
      saveToSentItems: true,
    }),
    cache: "no-store",
  });
  if (res.status !== 202) {
    const text = await res.text().catch(() => "");
    throw new Error(`Graph sendMail → HTTP ${res.status}: ${text.slice(0, 250)}`);
  }
}

/* ── klassiek SMTP ── */

function transporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

export interface SignInviteInput {
  to: string;
  toName?: string;
  documentTitle: string;
  signUrl: string;
}

export interface SendResult {
  ok: boolean;
  /** Foutmelding bij falen — getoond in de verzendbanner voor diagnose. */
  error?: string;
}

/** Verstuur één uitnodiging; geeft {ok:false, error} terug bij falen (nooit throwen). */
export async function sendSignInvite(input: SignInviteInput): Promise<SendResult> {
  if (!mailerConfigured()) {
    return { ok: false, error: "Mail niet geconfigureerd (Graph- of SMTP-variabelen ontbreken)." };
  }
  const from = senderAddress();
  const aanhef = input.toName ? `Beste ${input.toName.split(" ")[0]}` : "Beste";
  const subject = `Ter ondertekening: ${input.documentTitle}`;
  const html =
    `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:560px">` +
    `<p>${aanhef},</p>` +
    `<p>U ontvangt hierbij de <strong>${input.documentTitle}</strong> van Lease Estate ter digitale ondertekening.</p>` +
    `<p style="margin:26px 0"><a href="${input.signUrl}" style="background:#00C362;color:#000;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px;display:inline-block">Document bekijken &amp; ondertekenen</a></p>` +
    `<p style="font-size:13px;color:#575757">Het document opent in uw browser; u kan alle onderdelen rustig nalezen (klik op &laquo;meer details&raquo; voor extra toelichting) en onderaan digitaal ondertekenen. Werkt de knop niet, kopieer dan deze link: <br><a href="${input.signUrl}">${input.signUrl}</a></p>` +
    `<p style="margin-top:30px">Met vriendelijke groeten,<br><strong>Lease Estate NV</strong><br>Coupure 88, 9000 Gent<br>info@lease-estate.com</p>` +
    `</div>`;

  try {
    if (graphConfigured()) {
      await sendViaGraph(input.to, subject, html);
      return { ok: true };
    }
    await transporter().sendMail({
      from: `Lease Estate <${from}>`,
      to: input.to,
      subject,
      text:
        `${aanhef},\n\n` +
        `U ontvangt hierbij de ${input.documentTitle} van Lease Estate ter digitale ondertekening.\n\n` +
        `Bekijk en onderteken het document via deze beveiligde link:\n${input.signUrl}\n\n` +
        `Met vriendelijke groeten,\nLease Estate NV\nCoupure 88, 9000 Gent\ninfo@lease-estate.com`,
      html,
    });
    return { ok: true };
  } catch (e) {
    const msg = (e as Error).message?.slice(0, 300) ?? "Onbekende mailfout";
    // Serverside meelezen in de Vercel-logs (bevat geen geheimen).
    console.error("[mailer] uitnodiging versturen mislukt:", msg);
    return { ok: false, error: msg };
  }
}
