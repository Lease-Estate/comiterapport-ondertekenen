"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { TERMSHEET_CSS } from "@/lib/termsheet-css";
import { TS_CLAUSE_PRESETS, TS_STEP_DETAILS } from "@/lib/termsheet";
import type { TermSheetRecord, TermSheetSigners } from "@/lib/termsheet";
import type { TsdLayout } from "@/lib/termsheet-diagram";
import { TermSheetDiagram } from "./TermSheetDiagram";

/**
 * Editor voor één term sheet (/ondertekenen/[id]).
 * - De documentinhoud (payload.bodyHtml) rendert één keer en wordt daarna als
 *   vrij DOM behandeld (uncontrolled): invulvelden zijn altijd bewerkbaar, de
 *   knop "Bewerken" zet het HELE document in bewerkmodus met een opmaakbalk
 *   (vet/cursief/onderstrepen/opsomming).
 * - Het structuurdiagram leeft in het [data-diagram-slot] (portal) en wordt
 *   met de editable-flow-diagram-editor versleept; de layout gaat mee in de
 *   autosave en wordt bij verzending statisch in de PDF gebakken.
 * - "Controleer & verstuur" toont eerst welke invulvelden nog op hun
 *   placeholder staan (zodat er geen placeholder-data naar de klant gaat) en
 *   verstuurt daarna via DocuSeal naar beide ondertekenaars.
 */

const CHROME_CSS = `
.ts-chrome{position:sticky;top:0;z-index:40;background:#fff;border-bottom:1px solid #e5e5e5;
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 16px;font-family:'Degular','Helvetica Neue',Arial,sans-serif}
.ts-chrome .sp{flex:1}
.ts-btn{all:unset;cursor:pointer;font-size:12.5px;font-weight:600;padding:8px 14px;border-radius:6px;
  background:#f2f2f2;color:#1a1a1a;transition:.15s;white-space:nowrap}
.ts-btn:hover{background:#e6e6e6}
.ts-btn.p{background:#00C362;color:#000}
.ts-btn.p:hover{background:#00a854}
.ts-btn.on{background:#0051FF;color:#fff}
.ts-btn:disabled{opacity:.5;cursor:default}
.ts-fmt{display:flex;gap:4px}
.ts-fmt .ts-btn{padding:8px 11px;font-size:13px}
.ts-title{font-size:14px;font-weight:600;border:1px solid transparent;border-radius:6px;padding:6px 8px;min-width:280px}
.ts-title:hover,.ts-title:focus{border-color:#dedede;outline:none}
.ts-savestate{font-size:11.5px;color:#575757}
.ts-shell{background:#F2F2F2;min-height:100vh;padding:28px 12px 80px}
.ts-banner{max-width:840px;margin:0 auto 16px;background:#E5EDFF;border:1px solid #0051FF33;color:#1a1a1a;
  border-radius:8px;padding:12px 16px;font-size:13px;font-family:'Degular','Helvetica Neue',Arial,sans-serif}
.ts-banner a{color:#0051FF;font-weight:600}
.ts-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:60;display:flex;align-items:center;justify-content:center;padding:20px}
.ts-modal{background:#fff;border-radius:12px;max-width:560px;width:100%;max-height:86vh;overflow:auto;padding:26px 28px;
  font-family:'Degular','Helvetica Neue',Arial,sans-serif}
.ts-modal h3{margin:0 0 6px;font-size:19px}
.ts-modal .sub{font-size:13px;color:#575757;margin-bottom:16px}
.ts-warn{background:#FFFBDB;border:1px solid #E0A92E55;border-radius:8px;padding:12px 14px;margin-bottom:16px}
.ts-warn .t{font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8A7A00;margin-bottom:8px}
.ts-warn ul{margin:0;padding:0;list-style:none;display:grid;gap:4px}
.ts-warn li{font-size:13px}
.ts-warn button{all:unset;cursor:pointer;color:#0051FF;font-weight:600}
.ts-ok{background:#E0F8EC;border:1px solid #00C36255;border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:13px}
.ts-field{display:grid;gap:4px;margin-bottom:12px}
.ts-field label{font-size:11.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#575757}
.ts-field input{border:1px solid #dedede;border-radius:6px;padding:9px 11px;font-size:13.5px;font-family:inherit}
.ts-field input:focus{outline:none;border-color:#0051FF}
.ts-2col{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ts-modal .row{display:flex;gap:10px;justify-content:flex-end;margin-top:18px}
.ts-err{background:#fdecea;border:1px solid #c0392b55;color:#c0392b;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:14px}
@media(max-width:640px){.ts-2col{grid-template-columns:1fr}}

/* ── clausulebeheer (secties 06/07) — alleen editor-chrome, data-noexport ── */
.tsdoc ol.clauses>li{padding-right:30px}
.tsdoc .ts-clause-del{
  all:unset;position:absolute;right:0;top:6px;cursor:pointer;
  width:22px;height:22px;border-radius:50%;text-align:center;line-height:22px;
  font-size:14px;font-weight:700;color:#c0392b;background:#fdecea;
  opacity:0;transition:opacity .15s;
}
.tsdoc ol.clauses>li:hover .ts-clause-del{opacity:1}
.tsdoc .ts-clause-add{
  all:unset;cursor:pointer;display:inline-block;margin-top:10px;
  font-size:12px;font-weight:600;letter-spacing:.04em;
  padding:7px 13px;border-radius:6px;border:1.5px dashed #9B9B9B;color:#575757;transition:.15s;
}
.tsdoc .ts-clause-add:hover{border-color:#0051FF;color:#0051FF;background:#E5EDFF}
.ts-preset{display:grid;gap:6px;margin-bottom:14px}
.ts-preset button{
  all:unset;cursor:pointer;font-size:13px;line-height:1.5;padding:9px 12px;border-radius:8px;
  border:1px solid #dedede;transition:.15s;
}
.ts-preset button:hover:not(:disabled){border-color:#00C362;background:#E0F8EC}
.ts-preset button:disabled{opacity:.45;cursor:default}
.ts-preset button .al{color:#008A45;font-weight:600;font-size:11.5px;margin-left:6px}
.ts-custom{display:flex;gap:8px}
.ts-custom input{flex:1;border:1px solid #dedede;border-radius:6px;padding:9px 11px;font-size:13.5px;font-family:inherit}
.ts-custom input:focus{outline:none;border-color:#0051FF}

/* ── "Meer details"-chip + pop-up-editor (editor-chrome, data-noexport) ── */
.tsdoc .ts-detail-chip{
  all:unset;cursor:pointer;display:inline-block;margin-left:8px;vertical-align:baseline;
  font-size:10.5px;font-weight:600;letter-spacing:.04em;
  padding:2px 8px;border-radius:999px;border:1px dashed #9B9B9B;color:#575757;transition:.15s;
  white-space:nowrap;
}
.tsdoc .ts-detail-chip:hover{border-color:#0051FF;color:#0051FF;background:#E5EDFF}
.tsdoc .ts-detail-chip.filled{border-style:solid;border-color:#00C36288;color:#008A45;background:#E0F8EC}
.ts-detail-edit{
  border:1px solid #dedede;border-radius:8px;padding:12px 14px;min-height:150px;max-height:44vh;overflow:auto;
  font-size:13.5px;line-height:1.6;outline:none;margin-bottom:14px;
}
.ts-detail-edit:focus{border-color:#0051FF}
.ts-detail-edit:empty::before{content:"Typ hier de extra toelichting…";color:#9B9B9B}
.ts-detail-edit p{margin:0 0 8px}
`;

interface MissingFill {
  key: string;
  ph: string;
  section: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Genormaliseerde tekst van een clausule (voor "al opgenomen"-detectie). */
function clauseText(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Marker die bij het serialiseren de plaats van het diagram aanduidt. */
const SLOT_MARKER = '<div data-diagram-slot contenteditable="false"></div>';
const SLOT_RE = /<div[^>]*data-diagram-slot[^>]*>[\s\S]*?<\/div>/;

export function TermSheetEditor({ record: recordProp }: { record: TermSheetRecord }) {
  // Uncontrolled editor: de documentinhoud leeft na de eerste render in het
  // DOM. Bevries daarom de initiële record — een latere prop-update (bv. een
  // RSC-refetch van de route) zou anders de dangerouslySetInnerHTML-waarde
  // wijzigen en React de DOM laten terugzetten, wat lopende bewerkingen wist.
  const record = useRef(recordProp).current;
  const docRef = useRef<HTMLDivElement>(null);
  const beforeRef = useRef<HTMLDivElement>(null);
  const afterRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(record.title);
  const [status, setStatus] = useState(record.status);
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [modalOpen, setModalOpen] = useState(false);
  const [missing, setMissing] = useState<MissingFill[]>([]);
  const [signers, setSigners] = useState<TermSheetSigners>(record.payload.signers ?? {});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sentUrl, setSentUrl] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<string | null>(record.payload.docuseal?.sentAt ?? null);
  const [signLinks, setSignLinks] = useState<
    { role: string; email: string; url: string; mailed: boolean; mailError?: string | null }[]
  >(
    () =>
      record.payload.docuseal?.submitters?.map((s) => ({
        role: s.role,
        email: s.email,
        url: `${typeof window !== "undefined" ? window.location.origin : ""}/ondertekenen/t/${s.token}`,
        mailed: s.mailed,
      })) ?? [],
  );

  const layoutRef = useRef<TsdLayout | null>(record.payload.diagramLayout ?? null);
  const signersRef = useRef(signers);
  signersRef.current = signers;
  const docusealRef = useRef(record.payload.docuseal);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── documentinhoud in twee delen rond het diagram-slot ──
     Het diagram is een React-kind tussen de twee dangerouslySetInnerHTML-
     wrappers (display:contents), zodat er geen portal in door dev-remounts
     vervangen DOM nodig is. Bij het serialiseren komt de slot-marker terug
     op zijn plaats. */
  // BELANGRIJK: de {__html}-objecten zelf memoizen (niet enkel de strings).
  // Next's React-canary vergelijkt dangerouslySetInnerHTML op OBJECT-identiteit;
  // een nieuw object per render zou de innerHTML elke re-render opnieuw zetten
  // en daarmee alle lopende (contenteditable-)bewerkingen wissen.
  const [beforeObj, afterObj] = useMemo(() => {
    const body = record.payload.bodyHtml;
    const m = SLOT_RE.exec(body);
    if (!m) return [{ __html: body }, { __html: "" }] as const;
    return [
      { __html: body.slice(0, m.index) },
      { __html: body.slice(m.index + m[0].length) },
    ] as const;
  }, [record.payload.bodyHtml]);

  /* ── serialiseren + opslaan ── */
  const serializeBody = useCallback((): string => {
    const before = beforeRef.current;
    const after = afterRef.current;
    if (!before || !after) return record.payload.bodyHtml;
    const clean = (el: HTMLElement) => {
      const clone = el.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("[data-noexport]").forEach((n) => n.remove());
      return clone.innerHTML;
    };
    return clean(before) + SLOT_MARKER + clean(after);
  }, [record.payload.bodyHtml]);

  /* ── undo/redo: snapshot per autosave-burst ──
     Elke opgeslagen toestand (bodyHtml + diagramlayout) is een herstelpunt.
     Dat dekt ook structurele wijzigingen (clausules toevoegen/verwijderen,
     diagram verslepen) die buiten de native browser-undo vallen; daarom
     onderscheppen we Ctrl+Z/Ctrl+Y binnen het document. Max 50 stappen. */
  const historyRef = useRef<string[]>([]);
  const redoRef = useRef<string[]>([]);
  const [, bumpHistory] = useState(0);
  const [diagramKey, setDiagramKey] = useState(0);

  const snapState = useCallback(
    (): string => JSON.stringify({ b: serializeBody(), l: layoutRef.current }),
    [serializeBody],
  );

  const save = useCallback(async () => {
    setSaveState("saving");
    const bodyHtml = serializeBody();
    // Herstelpunt SYNCHROON vastleggen, vóór de netwerkcall: een trage PATCH
    // (bv. route-compilatie in dev) zou anders na een tussentijdse undo alsnog
    // zijn verouderde snapshot bovenop de stack pushen.
    const cur = JSON.stringify({ b: bodyHtml, l: layoutRef.current });
    const hist = historyRef.current;
    if (hist[hist.length - 1] !== cur) {
      hist.push(cur);
      if (hist.length > 50) hist.shift();
      redoRef.current = [];
      bumpHistory((v) => v + 1);
    }
    try {
      const res = await fetch(`/api/termsheets/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          payload: {
            bodyHtml,
            diagramLayout: layoutRef.current,
            signers: signersRef.current,
            docuseal: docusealRef.current,
          },
        }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? `HTTP ${res.status}`);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [record.id, title, serializeBody]);

  const scheduleSave = useCallback(() => {
    setSaveState("dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void save(), 1200);
  }, [save]);

  useEffect(() => {
    const doc = docRef.current;
    if (!doc) return;
    const onInput = () => scheduleSave();
    doc.addEventListener("input", onInput);
    return () => doc.removeEventListener("input", onInput);
  }, [scheduleSave]);

  const onLayoutChange = useCallback(
    (layout: TsdLayout) => {
      layoutRef.current = layout;
      scheduleSave();
    },
    [scheduleSave],
  );

  /* ── clausulebeheer: secties 06 (Waarborgen) en 07 (Opschortende voorwaarden) ──
     Editor-knoppen (× per regel, "+ Toevoegen" onder de lijst) worden als
     data-noexport-elementen in het document geïnjecteerd; de serialisatie en
     de DocuSeal-export strippen ze automatisch. De ol.clauses-nummering loopt
     via CSS-counters en hernummert dus vanzelf bij toevoegen/verwijderen. */
  const [clausePicker, setClausePicker] = useState<"waarborgen" | "voorwaarden" | null>(null);
  const [customClause, setCustomClause] = useState("");

  const ensureClauseChrome = useCallback(() => {
    const doc = docRef.current;
    if (!doc) return;
    doc.querySelectorAll<HTMLElement>("section").forEach((sec) => {
      const title = sec.querySelector("h2")?.textContent?.trim().toLowerCase() ?? "";
      const kind =
        title === "waarborgen" ? "waarborgen" : title === "opschortende voorwaarden" ? "voorwaarden" : null;
      if (!kind) return;
      const ol = sec.querySelector<HTMLElement>("ol.clauses");
      if (!ol) return;
      ol.dataset.clauseList = kind;
      ol.querySelectorAll<HTMLElement>(":scope > li").forEach((li) => {
        if (li.querySelector(".ts-clause-del")) return;
        const del = document.createElement("button");
        del.type = "button";
        del.className = "ts-clause-del";
        del.setAttribute("data-noexport", "");
        del.setAttribute("contenteditable", "false");
        del.title = "Verwijder deze regel";
        del.textContent = "×";
        li.appendChild(del);
      });
      if (!sec.querySelector(".ts-clause-add")) {
        const add = document.createElement("button");
        add.type = "button";
        add.className = "ts-clause-add";
        add.setAttribute("data-noexport", "");
        add.setAttribute("contenteditable", "false");
        add.dataset.kind = kind;
        add.textContent = kind === "waarborgen" ? "+ Waarborg toevoegen" : "+ Voorwaarde toevoegen";
        ol.after(add);
      }
    });
    // "Meer details"-chip op elke regel van de genummerde lijsten (verrichtings-
    // stappen + waarborgen + voorwaarden). Het label toont of er al een
    // toelichting is ingevuld; de inhoud zelf zit als verborgen .ts-detail-div
    // in de regel en gaat dus mee in autosave, undo en de PDF-bijlage.
    doc.querySelectorAll<HTMLElement>("ol.clauses > li").forEach((li) => {
      let chip = li.querySelector<HTMLElement>(":scope > .ts-detail-chip");
      if (!chip) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ts-detail-chip";
        btn.setAttribute("data-noexport", "");
        btn.setAttribute("contenteditable", "false");
        btn.title = "Extra toelichting bekijken of bewerken (komt als bijlage in de PDF)";
        li.appendChild(btn);
        chip = btn;
      }
      const detail = li.querySelector(":scope > .ts-detail");
      const filled = !!detail && (detail.textContent?.trim().length ?? 0) > 0;
      chip.textContent = filled ? "ⓘ meer details" : "+ details";
      chip.classList.toggle("filled", filled);
    });
  }, []);

  useEffect(() => {
    ensureClauseChrome();
    const doc = docRef.current;
    if (!doc) return;
    const onClick = (ev: MouseEvent) => {
      const t = ev.target as Element;
      const del = t.closest(".ts-clause-del");
      if (del) {
        ev.preventDefault();
        del.closest("li")?.remove();
        scheduleSave();
        return;
      }
      const chip = t.closest(".ts-detail-chip");
      if (chip) {
        ev.preventDefault();
        const li = chip.closest("li");
        if (li) {
          detailLiRef.current = li as HTMLElement;
          setDetailInitial(li.querySelector(":scope > .ts-detail")?.innerHTML ?? "");
          setDetailOpen(true);
        }
        return;
      }
      const add = t.closest<HTMLElement>(".ts-clause-add");
      if (add?.dataset.kind) {
        ev.preventDefault();
        setCustomClause("");
        setClausePicker(add.dataset.kind as "waarborgen" | "voorwaarden");
      }
    };
    doc.addEventListener("click", onClick);
    return () => doc.removeEventListener("click", onClick);
  }, [ensureClauseChrome, scheduleSave]);

  /** Welke presets staan al in de lijst (genormaliseerd, zonder editor-knoppen)? */
  const presentClauses = (): Set<string> => {
    const set = new Set<string>();
    if (!clausePicker) return set;
    docRef.current?.querySelectorAll(`ol[data-clause-list="${clausePicker}"] > li`).forEach((li) => {
      const clone = li.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("[data-noexport]").forEach((n) => n.remove());
      set.add(clauseText(clone.innerHTML));
    });
    return set;
  };

  const insertClause = (html: string) => {
    if (!clausePicker) return;
    const ol = docRef.current?.querySelector(`ol[data-clause-list="${clausePicker}"]`);
    if (!ol) return;
    const li = document.createElement("li");
    li.innerHTML = html;
    // Preset met een standaardtoelichting (bv. de verderzetverbintenis) krijgt
    // die meteen mee als verborgen detailblok — daarna vrij bewerkbaar via de
    // "meer details"-chip.
    const lead = li.querySelector("strong")?.textContent?.replace(/\.\s*$/, "").trim();
    if (lead && TS_STEP_DETAILS[lead] && !li.querySelector(".ts-detail")) {
      const det = document.createElement("div");
      det.className = "ts-detail";
      det.hidden = true;
      det.innerHTML = TS_STEP_DETAILS[lead];
      li.appendChild(det);
    }
    ol.appendChild(li);
    ensureClauseChrome();
    scheduleSave();
  };

  /* ── "Meer details"-pop-up ── */
  const detailLiRef = useRef<HTMLElement | null>(null);
  const detailEditRef = useRef<HTMLDivElement>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailInitial, setDetailInitial] = useState("");
  // Object-identiteit stabiel houden (zelfde dangerouslySetInnerHTML-valkuil
  // als bij het document zelf): anders wist elke re-render de pop-up-inhoud.
  const detailInitialObj = useMemo(() => ({ __html: detailInitial }), [detailInitial]);

  /** Voorzet-tekst als deze regel een bekende verrichtingsstap is. */
  const detailPreset = (): string | null => {
    const strong = detailLiRef.current?.querySelector("strong")?.textContent?.replace(/\.\s*$/, "").trim();
    return strong && TS_STEP_DETAILS[strong] ? TS_STEP_DETAILS[strong] : null;
  };

  const saveDetail = () => {
    const li = detailLiRef.current;
    const edit = detailEditRef.current;
    if (!li || !edit) return;
    const html = edit.innerHTML;
    const isEmpty = !edit.textContent?.trim();
    let d = li.querySelector<HTMLElement>(":scope > .ts-detail");
    if (isEmpty) {
      d?.remove();
    } else {
      if (!d) {
        d = document.createElement("div");
        d.className = "ts-detail";
        d.setAttribute("hidden", "");
        li.appendChild(d);
      }
      d.innerHTML = html;
    }
    ensureClauseChrome();
    scheduleSave();
    setDetailOpen(false);
  };

  /* ── undo/redo-uitvoering ── */

  // Eerste herstelpunt: de toestand waarmee de editor opende.
  useEffect(() => {
    if (historyRef.current.length === 0) historyRef.current = [snapState()];
  }, [snapState]);

  const restoreState = useCallback(
    (stateStr: string) => {
      const st = JSON.parse(stateStr) as { b: string; l: TsdLayout | null };
      const m = SLOT_RE.exec(st.b);
      const before = m ? st.b.slice(0, m.index) : st.b;
      const after = m ? st.b.slice(m.index + m[0].length) : "";
      if (beforeRef.current) beforeRef.current.innerHTML = before;
      if (afterRef.current) afterRef.current.innerHTML = after;
      layoutRef.current = st.l ?? null;
      // Diagram leest zijn layout één keer bij mount → remount forceren.
      setDiagramKey((k) => k + 1);
      ensureClauseChrome();
      // Normaliseer het zonet herstelde herstelpunt naar de DOM-serialisatie:
      // de browser herschrijft HTML bij het parsen (attribuutvormen, entiteiten),
      // waardoor een tekstuele vergelijking met de opgeslagen string anders
      // vals-negatief wordt en de undo-stack in de war raakt.
      const hist = historyRef.current;
      if (hist.length > 0) hist[hist.length - 1] = snapState();
      scheduleSave();
    },
    [ensureClauseChrome, scheduleSave, snapState],
  );

  const undo = useCallback(() => {
    const hist = historyRef.current;
    const cur = snapState();
    const top = hist[hist.length - 1];
    if (top !== undefined && cur !== top) {
      // Nog niet opgeslagen wijzigingen = één ongedaan te maken stap.
      redoRef.current.push(cur);
      restoreState(top);
    } else if (hist.length >= 2) {
      redoRef.current.push(hist.pop()!);
      restoreState(hist[hist.length - 1]);
    }
    bumpHistory((v) => v + 1);
  }, [snapState, restoreState]);

  const redo = useCallback(() => {
    const next = redoRef.current.pop();
    if (next === undefined) return;
    const hist = historyRef.current;
    if (hist[hist.length - 1] !== next) hist.push(next);
    restoreState(next);
    bumpHistory((v) => v + 1);
  }, [restoreState]);

  const canUndo = historyRef.current.length >= 2 || saveState === "dirty" || saveState === "saving";
  const canRedo = redoRef.current.length > 0;

  // Ctrl+Z / Ctrl+Y (of Ctrl+Shift+Z) binnen het document → onze stack, zodat
  // ook clausule- en diagramwijzigingen consequent teruggedraaid worden.
  useEffect(() => {
    const doc = docRef.current;
    if (!doc) return;
    const onKey = (ev: KeyboardEvent) => {
      if (!(ev.ctrlKey || ev.metaKey)) return;
      const k = ev.key.toLowerCase();
      if (k === "z" && !ev.shiftKey) {
        ev.preventDefault();
        undo();
      } else if (k === "y" || (k === "z" && ev.shiftKey)) {
        ev.preventDefault();
        redo();
      }
    };
    doc.addEventListener("keydown", onKey);
    return () => doc.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  /* ── opmaakbalk ── */
  const fmt = (cmd: string) => {
    document.execCommand(cmd);
    scheduleSave();
  };

  /* ── placeholder-controle + verzenden ── */
  const openSendModal = async () => {
    const doc = docRef.current;
    const found: MissingFill[] = [];
    doc?.querySelectorAll<HTMLElement>(".fill").forEach((el) => {
      if (el.textContent?.trim()) return;
      const sec = el.closest("section");
      let section = sec?.querySelector("h2")?.textContent ?? "";
      if (!section) {
        if (el.closest(".doc-meta")) section = "Referentie & datum";
        else if (sec?.querySelector(".sig-grid")) section = "Handtekeningen";
        else section = "Document";
      }
      found.push({ key: el.dataset.key ?? "", ph: el.dataset.ph ?? "", section });
    });
    setMissing(found);
    setSendError(null);
    setModalOpen(true);
    await save();
  };

  const jumpTo = (key: string) => {
    const el = docRef.current?.querySelector<HTMLElement>(`.fill[data-key="${key}"]`);
    if (!el) return;
    setModalOpen(false);
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ts-flash");
    setTimeout(() => el.classList.remove("ts-flash"), 2600);
  };

  const send = async () => {
    setSending(true);
    setSendError(null);
    try {
      await save();
      const res = await fetch(`/api/termsheets/${record.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signers: signersRef.current }),
      });
      const data = (await res.json()) as {
        error?: string;
        docusealUrl?: string | null;
        termSheet?: TermSheetRecord;
        signLinks?: { role: string; email: string; url: string; mailed: boolean; mailError?: string | null }[];
      };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setStatus("sent");
      setSentAt(new Date().toISOString());
      setSentUrl(data.docusealUrl ?? null);
      setSignLinks(data.signLinks ?? []);
      docusealRef.current = data.termSheet?.payload.docuseal;
      setModalOpen(false);
    } catch (e) {
      setSendError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const saveLabel =
    saveState === "saving"
      ? "Opslaan…"
      : saveState === "saved"
        ? "Opgeslagen"
        : saveState === "dirty"
          ? "Niet opgeslagen"
          : saveState === "error"
            ? "Opslaan mislukt — probeer opnieuw"
            : "";

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: TERMSHEET_CSS + CHROME_CSS }} />

      <div className="ts-chrome" data-noexport>
        <Link className="ts-btn" href="/ondertekenen">
          ← Ondertekenen
        </Link>
        <input
          className="ts-title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            scheduleSave();
          }}
          aria-label="Titel"
        />
        <span className="ts-savestate">{saveLabel}</span>
        <span className="sp" />
        <button type="button" className="ts-btn" title="Ongedaan maken (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
          ↶ Ongedaan
        </button>
        <button type="button" className="ts-btn" title="Opnieuw (Ctrl+Y)" onClick={redo} disabled={!canRedo}>
          ↷
        </button>
        {editing ? (
          <div className="ts-fmt">
            <button type="button" className="ts-btn" title="Vet" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt("bold")}>
              <b>B</b>
            </button>
            <button type="button" className="ts-btn" title="Cursief" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt("italic")}>
              <i>I</i>
            </button>
            <button type="button" className="ts-btn" title="Onderstrepen" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt("underline")}>
              <u>U</u>
            </button>
            <button
              type="button"
              className="ts-btn"
              title="Opsomming"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => fmt("insertUnorderedList")}
            >
              • Lijst
            </button>
          </div>
        ) : null}
        <button type="button" className={`ts-btn${editing ? " on" : ""}`} onClick={() => setEditing((e) => !e)}>
          {editing ? "Klaar met bewerken" : "Bewerken"}
        </button>
        <button type="button" className="ts-btn p" onClick={() => void openSendModal()}>
          Controleer &amp; verstuur
        </button>
      </div>

      <div className="ts-shell">
        {status === "sent" ? (
          <div className="ts-banner" data-noexport>
            <div>
              Verzonden ter ondertekening{sentAt ? ` op ${new Date(sentAt).toLocaleString("nl-BE")}` : ""}.{" "}
              {sentUrl ? (
                <a href={sentUrl} target="_blank" rel="noopener">
                  Volg de status in DocuSeal →
                </a>
              ) : null}{" "}
              Je kan het document nog aanpassen en opnieuw versturen.
            </div>
            {signLinks.length > 0 ? (
              <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
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
          </div>
        ) : null}

        <div className="tsdoc">
          <div
            className="ts-page"
            ref={docRef}
            contentEditable={editing}
            suppressContentEditableWarning
            spellCheck={false}
          >
            <div ref={beforeRef} style={{ display: "contents" }} dangerouslySetInnerHTML={beforeObj} />
            <div contentEditable={false}>
              <TermSheetDiagram key={diagramKey} layout={layoutRef.current} onLayoutChange={onLayoutChange} />
            </div>
            <div ref={afterRef} style={{ display: "contents" }} dangerouslySetInnerHTML={afterObj} />
          </div>
        </div>
      </div>

      {detailOpen ? (
        <div className="ts-modal-bg" onClick={() => setDetailOpen(false)}>
          <div className="ts-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Meer details</h3>
            <p className="sub">
              Extra toelichting bij deze regel. In de ondertekende PDF komt ze achteraan terecht in de sectie
              &laquo;Toelichting&raquo;, met een verwijsnummer bij de regel. Opmaak kan met Ctrl+B / Ctrl+I / Ctrl+U.
            </p>
            <div
              className="ts-detail-edit"
              ref={detailEditRef}
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              dangerouslySetInnerHTML={detailInitialObj}
            />
            <div className="row">
              {detailPreset() ? (
                <button
                  type="button"
                  className="ts-btn"
                  title="Vul de standaardtoelichting voor deze verrichtingsstap in"
                  onClick={() => {
                    if (detailEditRef.current) detailEditRef.current.innerHTML = detailPreset() ?? "";
                  }}
                >
                  Voorzet invoegen
                </button>
              ) : null}
              <button
                type="button"
                className="ts-btn"
                onClick={() => {
                  if (detailEditRef.current) detailEditRef.current.innerHTML = "";
                }}
              >
                Wissen
              </button>
              <button type="button" className="ts-btn" onClick={() => setDetailOpen(false)}>
                Annuleren
              </button>
              <button type="button" className="ts-btn p" onClick={saveDetail}>
                Bewaren
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {clausePicker ? (
        <div className="ts-modal-bg" onClick={() => setClausePicker(null)}>
          <div className="ts-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{clausePicker === "waarborgen" ? "Waarborg toevoegen" : "Opschortende voorwaarde toevoegen"}</h3>
            <p className="sub">
              Klik op een regel om ze toe te voegen — de tekst blijft daarna gewoon bewerkbaar in het document (vul
              &laquo;…&raquo; aan waar nodig). Verwijderen kan met de &times; naast elke regel.
            </p>
            {(() => {
              const present = presentClauses();
              return (
                <div className="ts-preset">
                  {TS_CLAUSE_PRESETS[clausePicker].map((p) => {
                    const already = present.has(clauseText(p));
                    return (
                      <button key={p} type="button" disabled={already} onClick={() => insertClause(p)}>
                        <span dangerouslySetInnerHTML={{ __html: p }} />
                        {already ? <span className="al">✓ al opgenomen</span> : null}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
            <div className="ts-custom">
              <input
                value={customClause}
                placeholder="Eigen tekst…"
                onChange={(e) => setCustomClause(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customClause.trim()) {
                    insertClause(escapeHtml(customClause.trim()));
                    setCustomClause("");
                  }
                }}
              />
              <button
                type="button"
                className="ts-btn"
                disabled={!customClause.trim()}
                onClick={() => {
                  insertClause(escapeHtml(customClause.trim()));
                  setCustomClause("");
                }}
              >
                Voeg toe
              </button>
            </div>
            <div className="row">
              <button type="button" className="ts-btn p" onClick={() => setClausePicker(null)}>
                Klaar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalOpen ? (
        <div className="ts-modal-bg" onClick={() => (sending ? null : setModalOpen(false))}>
          <div className="ts-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Controleer &amp; verstuur</h3>
            <p className="sub">Het document gaat via DocuSeal naar beide ondertekenaars, met audit trail.</p>

            {missing.length > 0 ? (
              <div className="ts-warn">
                <div className="t">
                  ⚠ {missing.length} {missing.length === 1 ? "veld staat" : "velden staan"} nog op placeholder-tekst
                </div>
                <ul>
                  {missing.map((m) => (
                    <li key={m.key}>
                      {m.section} —{" "}
                      <button type="button" onClick={() => jumpTo(m.key)} title="Spring naar dit veld">
                        {m.ph}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="ts-ok">✓ Alle invulvelden zijn ingevuld.</div>
            )}

            <div className="ts-2col">
              <div className="ts-field">
                <label>Ondertekenaar Lease Estate — naam</label>
                <input
                  value={signers.lessorName ?? ""}
                  onChange={(e) => setSigners((s) => ({ ...s, lessorName: e.target.value }))}
                />
              </div>
              <div className="ts-field">
                <label>Ondertekenaar Lease Estate — e-mail</label>
                <input
                  type="email"
                  value={signers.lessorEmail ?? ""}
                  onChange={(e) => setSigners((s) => ({ ...s, lessorEmail: e.target.value }))}
                />
              </div>
              <div className="ts-field">
                <label>Leasingnemer — naam</label>
                <input
                  value={signers.lesseeName ?? ""}
                  onChange={(e) => setSigners((s) => ({ ...s, lesseeName: e.target.value }))}
                />
              </div>
              <div className="ts-field">
                <label>Leasingnemer — e-mail</label>
                <input
                  type="email"
                  value={signers.lesseeEmail ?? ""}
                  onChange={(e) => setSigners((s) => ({ ...s, lesseeEmail: e.target.value }))}
                />
              </div>
              <div className="ts-field">
                <label>Lease Estate — GSM (optioneel: SMS-verificatie)</label>
                <input
                  type="tel"
                  placeholder="+32 4xx xx xx xx"
                  value={signers.lessorPhone ?? ""}
                  onChange={(e) => setSigners((s) => ({ ...s, lessorPhone: e.target.value }))}
                />
              </div>
              <div className="ts-field">
                <label>Leasingnemer — GSM (optioneel: SMS-verificatie)</label>
                <input
                  type="tel"
                  placeholder="+32 4xx xx xx xx"
                  value={signers.lesseePhone ?? ""}
                  onChange={(e) => setSigners((s) => ({ ...s, lesseePhone: e.target.value }))}
                />
              </div>
            </div>
            <p className="sub" style={{ marginTop: 4 }}>
              GSM ingevuld = de ondertekenaar moet eerst een sms-code invoeren om het document te openen en te
              ondertekenen (sterkere identiteitscontrole).
            </p>

            {sendError ? (
              <>
                <div className="ts-err">{sendError}</div>
                <div className="ts-ok">
                  <b>Gratis alternatief (zonder Pro-licentie):</b> open de{" "}
                  <a href={`/api/termsheets/${record.id}/print`} target="_blank" rel="noopener">
                    afdrukversie
                  </a>{" "}
                  en kies &laquo;Opslaan als PDF&raquo;. Sleep die PDF daarna in DocuSeal — de handtekeningvelden
                  verschijnen er automatisch dankzij onzichtbare veldmarkeringen — en verstuur daar de uitnodigingen.
                </div>
              </>
            ) : null}

            <div className="row">
              <a
                className="ts-btn"
                href={`/api/termsheets/${record.id}/print`}
                target="_blank"
                rel="noopener"
                title="Afdrukversie met onzichtbare DocuSeal-veldmarkeringen — bewaar als PDF en sleep in DocuSeal"
              >
                PDF voor DocuSeal
              </a>
              <button type="button" className="ts-btn" onClick={() => setModalOpen(false)} disabled={sending}>
                Annuleren
              </button>
              <button type="button" className="ts-btn p" onClick={() => void send()} disabled={sending}>
                {sending
                  ? "Versturen…"
                  : missing.length > 0
                    ? "Toch versturen ter ondertekening"
                    : "Verstuur ter ondertekening"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
