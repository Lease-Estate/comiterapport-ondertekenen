"use client";

import { useMemo, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import type { TermSheetRecord } from "@/lib/termsheet";

/**
 * Vrij-document-editor: de geüploade PDF in de ingebedde DocuSeal-veldeneditor
 * (docuseal-builder; slepen van naam-, datum-, tekst- en handtekeningvelden en
 * het definiëren van de partijen), met daarboven onze verzendbalk. Verzenden
 * gebruikt dezelfde flow als de term sheets: eigen uitnodigingsmails en per
 * ondertekenaar een beveiligde pagina met het ondertekenformulier.
 */

const CSS = `
.vd-chrome{position:sticky;top:0;z-index:40;background:#fff;border-bottom:1px solid #e5e5e5;
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 16px;font-family:'Degular','Helvetica Neue',Arial,sans-serif}
.vd-chrome .t{font-weight:600;font-size:14px}
.vd-chrome .sp{flex:1}
.vd-btn{all:unset;cursor:pointer;font-size:12.5px;font-weight:600;padding:8px 14px;border-radius:6px;
  background:#f2f2f2;color:#1a1a1a;transition:.15s;white-space:nowrap}
.vd-btn:hover{background:#e6e6e6}
.vd-btn.p{background:#00C362;color:#000}
.vd-btn.p:hover{background:#00a854}
.vd-btn:disabled{opacity:.5;cursor:default}
.vd-hint{font-size:12px;color:#575757}
.vd-builder{min-height:calc(100vh - 54px)}
.vd-banner{margin:10px 16px;background:#E5EDFF;border:1px solid #0051FF33;border-radius:8px;padding:12px 16px;
  font-size:13px;font-family:'Degular','Helvetica Neue',Arial,sans-serif;display:grid;gap:4px}
.vd-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:60;display:flex;align-items:center;justify-content:center;padding:20px}
.vd-modal{background:#fff;border-radius:12px;max-width:520px;width:100%;max-height:86vh;overflow:auto;padding:26px 28px;
  font-family:'Degular','Helvetica Neue',Arial,sans-serif}
.vd-modal h3{margin:0 0 6px;font-size:19px}
.vd-modal .sub{font-size:13px;color:#575757;margin-bottom:16px}
.vd-role{border:1px solid #e5e5e5;border-radius:8px;padding:12px 14px;margin-bottom:12px;display:grid;gap:8px}
.vd-role .r{font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#0051FF}
.vd-role input{border:1px solid #dedede;border-radius:6px;padding:9px 11px;font-size:13.5px;font-family:inherit}
.vd-role input:focus{outline:none;border-color:#0051FF}
.vd-err{background:#fdecea;border:1px solid #c0392b55;color:#c0392b;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:14px}
.vd-modal .row{display:flex;gap:10px;justify-content:flex-end;margin-top:14px}
`;

interface SignLink {
  role: string;
  email: string;
  url: string;
  mailed: boolean;
  mailError?: string | null;
}

export function VrijDocEditor({
  record,
  builderJwt,
  builderHost,
}: {
  record: TermSheetRecord;
  builderJwt: string;
  builderHost: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [roles, setRoles] = useState<string[] | null>(null);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, { name: string; email: string; phone?: string }>>({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [signLinks, setSignLinks] = useState<SignLink[]>(
    () =>
      record.payload.docuseal?.submitters?.map((s) => ({
        role: s.role,
        email: s.email,
        url: `${typeof window !== "undefined" ? window.location.origin : ""}/ondertekenen/t/${s.token}`,
        mailed: s.mailed,
      })) ?? [],
  );

  const builderObj = useMemo(
    () => ({
      __html: `<docuseal-builder data-token="${builderJwt}" data-host="${builderHost}" data-with-send-button="false" data-with-sign-yourself-button="false"></docuseal-builder>`,
    }),
    [builderJwt, builderHost],
  );

  const openModal = async () => {
    setModalOpen(true);
    setRoles(null);
    setRolesError(null);
    setSendError(null);
    try {
      const res = await fetch(`/api/termsheets/${record.id}/roles`);
      const data = (await res.json()) as { roles?: string[]; error?: string };
      if (!res.ok || !data.roles) throw new Error(data.error ?? `HTTP ${res.status}`);
      setRoles(data.roles);
      setValues((prev) => {
        const next = { ...prev };
        for (const r of data.roles!) if (!next[r]) next[r] = { name: "", email: "" };
        return next;
      });
    } catch (e) {
      setRolesError((e as Error).message);
    }
  };

  const send = async () => {
    if (!roles) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/termsheets/${record.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signersList: roles.map((r) => ({
            role: r,
            name: values[r]?.name,
            email: values[r]?.email ?? "",
            phone: values[r]?.phone,
          })),
        }),
      });
      const data = (await res.json()) as { error?: string; signLinks?: SignLink[] };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSignLinks(data.signLinks ?? []);
      setModalOpen(false);
    } catch (e) {
      setSendError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="vd-chrome">
        <Link className="vd-btn" href="/ondertekenen">
          ← Ondertekenen
        </Link>
        <span className="t">{record.title}</span>
        <span className="vd-hint">
          Sleep hieronder de velden (handtekening, naam, datum, tekst) op het document en definieer de partijen.
        </span>
        <span className="sp" />
        <button type="button" className="vd-btn p" onClick={() => void openModal()}>
          Verstuur ter ondertekening
        </button>
      </div>

      {signLinks.length > 0 ? (
        <div className="vd-banner">
          <div>
            <b>Verzonden ter ondertekening.</b> Je kan velden nog aanpassen en opnieuw versturen.
          </div>
          {signLinks.map((l) => (
            <div key={l.role} style={{ fontSize: 12.5 }}>
              <b>{l.role}</b> ({l.email}) —{" "}
              {l.mailed ? (
                <span style={{ color: "#008A45", fontWeight: 600 }}>uitnodiging gemaild ✓</span>
              ) : (
                <span style={{ color: "#8A7A00", fontWeight: 600 }} title={l.mailError ?? undefined}>
                  mail niet verstuurd{l.mailError ? ` (${l.mailError})` : ""} — bezorg de link zelf
                </span>
              )}{" "}
              ·{" "}
              <a href={l.url} target="_blank" rel="noopener">
                open ondertekenpagina
              </a>{" "}
              ·{" "}
              <button
                type="button"
                style={{ all: "unset", cursor: "pointer", color: "#0051FF", fontWeight: 600 }}
                onClick={() => void navigator.clipboard.writeText(l.url)}
              >
                kopieer link
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="vd-builder" dangerouslySetInnerHTML={builderObj} />
      {/* Script van de eigen instantie laden: de cdn.docuseal.com-build negeert
          data-host en praat dan met docuseal.com ("user_email doesn't exist");
          de instantie-build op /js/builder.js heeft de juiste host ingebakken. */}
      <Script src={`https://${builderHost}/js/builder.js`} strategy="afterInteractive" />

      {modalOpen ? (
        <div className="vd-modal-bg" onClick={() => (sending ? null : setModalOpen(false))}>
          <div className="vd-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Verstuur ter ondertekening</h3>
            <p className="sub">
              Vul per partij (zoals gedefinieerd in de veldeneditor) naam en e-mailadres in. Elke ondertekenaar krijgt
              een uitnodiging met een beveiligde ondertekenlink.
            </p>
            {rolesError ? <div className="vd-err">{rolesError}</div> : null}
            {!roles && !rolesError ? <p className="sub">Partijen laden…</p> : null}
            {roles?.map((r) => (
              <div className="vd-role" key={r}>
                <div className="r">{r}</div>
                <input
                  placeholder="Naam"
                  value={values[r]?.name ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [r]: { ...v[r], name: e.target.value } }))}
                />
                <input
                  type="email"
                  placeholder="E-mailadres"
                  value={values[r]?.email ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [r]: { ...v[r], email: e.target.value } }))}
                />
                <input
                  type="tel"
                  placeholder="GSM (optioneel — activeert SMS-verificatie), bv. +32 4xx xx xx xx"
                  value={values[r]?.phone ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [r]: { ...v[r], phone: e.target.value } }))}
                />
              </div>
            ))}
            <p className="sub">
              GSM ingevuld = de ondertekenaar moet eerst een sms-code invoeren om het document te openen.
            </p>
            {sendError ? <div className="vd-err">{sendError}</div> : null}
            <div className="row">
              <button type="button" className="vd-btn" onClick={() => setModalOpen(false)} disabled={sending}>
                Annuleren
              </button>
              <button type="button" className="vd-btn p" onClick={() => void send()} disabled={sending || !roles}>
                {sending ? "Versturen…" : "Verstuur ter ondertekening"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
