"use client";

import { useEffect, useMemo, useRef } from "react";
import Script from "next/script";
import { TERMSHEET_CSS } from "@/lib/termsheet-css";
import type { TsdLayout } from "@/lib/termsheet-diagram";
import { TermSheetDiagram } from "./TermSheetDiagram";

/**
 * Publieke leesweergave + ondertekening van een term sheet (/ondertekenen/t/…).
 * - Het document is NIET bewerkbaar; de "meer details"-toelichtingen worden
 *   openklapbare blokjes (dicht tot de lezer erop klikt) in plaats van de
 *   PDF-bijlage — de HTML-ervaring die de klant te zien krijgt.
 * - Onderaan staat het DocuSeal-ondertekenformulier ingebed (Pro embedding),
 *   zodat lezen én tekenen op één pagina gebeuren. De juridisch ondertekende
 *   PDF (mét toelichting-bijlage) blijft het bewijsstuk in DocuSeal.
 */

const SIGNVIEW_CSS = `
body{background:#F2F2F2}
.sv-top{background:#fff;border-bottom:1px solid #e5e5e5;padding:14px 18px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;
  font-family:'Degular','Helvetica Neue',Arial,sans-serif}
.sv-top .t{font-weight:600;font-size:15px}
.sv-top .sub{font-size:12.5px;color:#575757}
.sv-shell{padding:26px 12px 60px}
.sv-signcard{max-width:840px;margin:26px auto 0;background:#fff;border-radius:8px;
  box-shadow:0 1px 2px rgba(0,0,0,.05),0 8px 24px rgba(0,0,0,.06);padding:28px 30px;
  font-family:'Degular','Helvetica Neue',Arial,sans-serif}
.sv-signcard h2{font-size:19px;margin:0 0 6px}
.sv-signcard .sub{font-size:13px;color:#575757;margin-bottom:16px}
.sv-note{max-width:840px;margin:14px auto 0;font-size:12px;color:#575757;text-align:center;
  font-family:'Degular','Helvetica Neue',Arial,sans-serif}

/* openklapbare details */
.tsdoc .ts-sv-toggle{
  all:unset;cursor:pointer;display:inline-block;margin-left:8px;vertical-align:baseline;
  font-size:10.5px;font-weight:600;letter-spacing:.04em;
  padding:2px 9px;border-radius:999px;border:1px solid #00C36288;color:#008A45;background:#E0F8EC;transition:.15s;
  white-space:nowrap;
}
.tsdoc .ts-sv-toggle:hover{background:#00C362;color:#000}
.tsdoc .ts-sv-detailbox{
  display:none;margin:10px 0 4px;padding:12px 16px;border-left:3px solid #00C362;
  background:#F7FDF9;border-radius:0 8px 8px 0;font-size:13px;line-height:1.6;
}
.tsdoc .ts-sv-detailbox.open{display:block}
.tsdoc .ts-sv-detailbox p{margin:0 0 8px}
.tsdoc .ts-sv-detailbox p:last-child{margin-bottom:0}
`;

export function TermSheetSignView({
  title,
  bodyHtml,
  diagramLayout,
  submitterName,
  submitterRole,
  signSrc,
  embedScriptSrc,
}: {
  title: string;
  bodyHtml: string;
  diagramLayout: TsdLayout | null;
  submitterName?: string;
  submitterRole: string;
  signSrc: string | null;
  embedScriptSrc: string | null;
}) {
  const docRef = useRef<HTMLDivElement>(null);

  const SLOT_RE = /<div[^>]*data-diagram-slot[^>]*>[\s\S]*?<\/div>/;
  const [beforeObj, afterObj] = useMemo(() => {
    const m = SLOT_RE.exec(bodyHtml);
    if (!m) return [{ __html: bodyHtml }, { __html: "" }] as const;
    return [{ __html: bodyHtml.slice(0, m.index) }, { __html: bodyHtml.slice(m.index + m[0].length) }] as const;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyHtml]);

  const embedObj = useMemo(
    () => (signSrc ? { __html: `<docuseal-form data-src="${signSrc}" data-with-title="false" data-logo=""></docuseal-form>` } : null),
    [signSrc],
  );

  /* Leesmodus + openklapbare details. */
  useEffect(() => {
    const doc = docRef.current;
    if (!doc) return;
    // Geen enkel element bewerkbaar in de leesweergave.
    doc.querySelectorAll("[contenteditable]").forEach((el) => el.removeAttribute("contenteditable"));
    // Elke regel met een (gevulde) toelichting krijgt een toggle + inklapbox.
    doc.querySelectorAll<HTMLElement>("ol.clauses > li").forEach((li) => {
      const detail = li.querySelector(":scope > .ts-detail");
      if (!detail || !(detail.textContent?.trim().length ?? 0)) return;
      if (li.querySelector(".ts-sv-toggle")) return;
      const box = document.createElement("div");
      box.className = "ts-sv-detailbox";
      box.innerHTML = detail.innerHTML;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ts-sv-toggle";
      btn.textContent = "ⓘ meer details";
      btn.addEventListener("click", () => {
        const open = box.classList.toggle("open");
        btn.textContent = open ? "− verberg details" : "ⓘ meer details";
      });
      li.appendChild(btn);
      li.appendChild(box);
    });
  }, []);

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: TERMSHEET_CSS + SIGNVIEW_CSS }} />

      <div className="sv-top">
        <span className="t">{title}</span>
        <span className="sub">
          Ter ondertekening {submitterName ? `door ${submitterName}` : ""} ({submitterRole}) — lees het document rustig
          na en onderteken onderaan de pagina.
        </span>
      </div>

      <div className="sv-shell">
        {bodyHtml ? (
          <div className="tsdoc">
            <div className="ts-page" ref={docRef}>
              <div style={{ display: "contents" }} dangerouslySetInnerHTML={beforeObj} />
              <div>
                <TermSheetDiagram layout={diagramLayout} onLayoutChange={() => undefined} readOnly />
              </div>
              <div style={{ display: "contents" }} dangerouslySetInnerHTML={afterObj} />
            </div>
          </div>
        ) : null}

        <div className="sv-signcard" id="onderteken">
          <h2>Digitaal ondertekenen</h2>
          <p className="sub">
            Controleer uw gegevens en plaats uw handtekening. Na ondertekening door beide partijen ontvangt u het
            ondertekende exemplaar (PDF, met volledige toelichting en audit trail) per e-mail.
          </p>
          {embedObj ? (
            <div dangerouslySetInnerHTML={embedObj} />
          ) : (
            <p className="sub">
              Het ondertekenformulier kon niet geladen worden. Neem contact op met Lease Estate (info@lease-estate.com)
              — dan bezorgen wij u een nieuwe ondertekenlink.
            </p>
          )}
        </div>

        <p className="sv-note">
          Lease Estate NV · Coupure 88, 9000 Gent · Dit document is strikt vertrouwelijk. Vragen? info@lease-estate.com
        </p>
      </div>

      {embedScriptSrc ? <Script src={embedScriptSrc} strategy="afterInteractive" /> : null}
    </div>
  );
}
