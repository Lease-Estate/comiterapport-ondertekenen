/**
 * CSS van het term sheet-document, als string zodat dezelfde stijl op twee
 * plaatsen gebruikt wordt: (1) de editor op /ondertekenen (in een <style> in de
 * client-component) en (2) de standalone HTML die naar DocuSeal gaat
 * (termsheet.ts / buildSignHtml). Alles is gescoped onder .tsdoc zodat de
 * app-stijlen niet botsen. Bron: term-sheet-onroerende-leasing (huisstijl).
 */
export const TERMSHEET_CSS = `
.tsdoc{
  --le-ink:#000000; --le-paper:#FFFFFF;
  --le-blue:#0051FF; --le-green:#00C362; --le-lilac:#B392FF; --le-yellow:#FFE300;
  --le-blue-soft:#E5EDFF; --le-green-soft:#E0F8EC; --le-lilac-soft:#F2ECFF; --le-yellow-soft:#FFFBDB;
  --le-green-deep:#008A45; --le-lilac-deep:#7A4EE0; --le-yellow-deep:#8A7A00;
  --le-grey-900:#1A1A1A; --le-grey-600:#575757; --le-grey-400:#9B9B9B; --le-grey-200:#DEDEDE; --le-grey-100:#F2F2F2;
  --fl-amber:#E0A92E; --fl-red:#c0392b;
  --le-font:'Degular','Helvetica Neue',Helvetica,Arial,sans-serif;
  --le-mono:'JetBrains Mono','Courier New',monospace;
  --le-radius-sm:4px; --le-radius-md:8px; --le-radius-pill:999px;
  --le-tracking-caps:.08em; --le-tracking-display:-0.02em;
  --le-shadow-card:0 1px 2px rgba(0,0,0,.05),0 8px 24px rgba(0,0,0,.06);
  font-family:var(--le-font);
  color:var(--le-ink);
  font-size:14px;line-height:1.55;
  -webkit-font-smoothing:antialiased;
}
.tsdoc *,.tsdoc *::before,.tsdoc *::after{box-sizing:border-box;margin:0;padding:0}
.tsdoc .mono{font-family:var(--le-mono)}
.tsdoc .ts-page{
  position:relative;
  max-width:840px;margin:0 auto;
  background:var(--le-paper);
  padding:60px 68px 0;
  box-shadow:var(--le-shadow-card);
  border-radius:var(--le-radius-md);
  overflow:hidden;
}
.tsdoc .bg-mark{position:absolute;top:-140px;right:-140px;width:480px;height:480px;opacity:.05;pointer-events:none;fill:var(--le-ink)}

/* ===== masthead ===== */
.tsdoc .masthead{
  display:flex;justify-content:space-between;align-items:flex-start;
  padding-bottom:22px;margin-bottom:26px;
  border-bottom:2px solid var(--le-ink);
  position:relative;z-index:1;
}
.tsdoc .ts-logo{height:30px;display:block;fill:var(--le-ink)}
.tsdoc .doc-meta{text-align:right;font-size:12.5px;color:var(--le-grey-600);line-height:1.7}
.tsdoc .doc-meta strong{color:var(--le-ink);font-weight:600}
.tsdoc .tagrow{display:flex;gap:8px;margin:0 0 22px;position:relative;z-index:1}
.tsdoc .le-tag{
  display:inline-block;font-size:11.5px;font-weight:600;
  padding:.32rem .8rem;border-radius:var(--le-radius-pill);
  background:var(--le-grey-100);color:var(--le-grey-600);
}
.tsdoc .le-tag--blue{background:var(--le-blue-soft);color:var(--le-blue)}
.tsdoc .le-tag--yellow{background:var(--le-yellow-soft);color:var(--le-yellow-deep)}
.tsdoc .eyebrow{
  font-size:12px;font-weight:600;letter-spacing:var(--le-tracking-caps);
  text-transform:uppercase;color:var(--le-grey-600);
}
.tsdoc h1{
  font-weight:500;font-size:clamp(34px,5vw,46px);line-height:1.05;
  letter-spacing:var(--le-tracking-display);
  margin:6px 0 14px;position:relative;z-index:1;
}
.tsdoc h1 .accent{color:var(--le-blue)}
.tsdoc .subtitle{font-size:16px;color:var(--le-grey-600);max-width:620px;margin-bottom:40px;position:relative;z-index:1}

/* ===== invulbare velden ===== */
.tsdoc .fill{
  display:inline-block;min-width:170px;padding:0 4px 1px;
  border-bottom:1.5px dashed var(--le-grey-400);
  color:var(--le-blue);font-weight:600;outline:none;
}
.tsdoc .fill:empty::before{content:attr(data-ph);color:var(--le-grey-400);font-weight:400}
.tsdoc .fill:focus{border-bottom-color:var(--le-blue);background:var(--le-blue-soft)}
.tsdoc .fill--wide{min-width:320px}
.tsdoc .fill.ts-flash{background:var(--le-yellow-soft);border-bottom-color:var(--le-yellow-deep);transition:background .3s}

/* ===== sections ===== */
.tsdoc section{margin-bottom:42px;position:relative;z-index:1}
.tsdoc .sec-head{display:flex;align-items:baseline;gap:14px;margin-bottom:16px;border-bottom:1.5px solid var(--le-ink);padding-bottom:8px}
.tsdoc .sec-head .num{font-size:12px;font-weight:700;color:var(--le-blue);letter-spacing:var(--le-tracking-caps)}
.tsdoc h2{font-weight:600;font-size:20px;letter-spacing:var(--le-tracking-display);line-height:1.2}
.tsdoc h3{font-size:12.5px;font-weight:600;letter-spacing:var(--le-tracking-caps);text-transform:uppercase;color:var(--le-grey-600);margin:0 0 10px}
.tsdoc p{margin-bottom:10px}
.tsdoc .small{font-size:12.5px;color:var(--le-grey-600)}
.tsdoc ul:not(.dash){margin:0 0 10px 20px}

/* ===== tables ===== */
.tsdoc table{width:100%;border-collapse:collapse;margin-bottom:6px}
.tsdoc th,.tsdoc td{text-align:left;vertical-align:top;padding:8px 14px;font-size:13.5px;border-bottom:1px solid var(--le-grey-200)}
.tsdoc th{width:33%;font-weight:600;background:var(--le-grey-100);color:var(--le-ink)}
.tsdoc td strong{font-weight:600}
.tsdoc td .fig{font-weight:700;color:var(--le-blue)}

/* ===== clause lists ===== */
.tsdoc ol.clauses{margin:0;padding:0;counter-reset:cl;list-style:none}
.tsdoc ol.clauses>li{
  counter-increment:cl;position:relative;
  padding:8px 0 8px 42px;border-bottom:1px solid var(--le-grey-200);font-size:13.5px;
}
.tsdoc ol.clauses>li:last-child{border-bottom:none}
.tsdoc ol.clauses>li::before{
  content:counter(cl,decimal-leading-zero);
  position:absolute;left:0;top:9px;
  font-size:11.5px;font-weight:700;color:var(--le-blue);
  font-variant-numeric:tabular-nums;letter-spacing:var(--le-tracking-caps);
}
.tsdoc ol.clauses.steps>li::before{content:counter(cl);color:var(--le-paper);background:var(--le-green);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;top:8px;font-size:10.5px}
.tsdoc ol.clauses.steps>li{padding-left:40px}
.tsdoc ol.clauses.steps>li:nth-child(2)::before{background:var(--fl-amber)}
.tsdoc ol.clauses.steps>li:nth-child(3)::before{background:var(--fl-red)}
.tsdoc ol.clauses.steps>li:nth-child(4)::before{background:var(--le-green)}
.tsdoc ol.clauses.steps>li:nth-child(5)::before{background:var(--le-blue)}
.tsdoc ul.dash{list-style:none}
.tsdoc ul.dash li{padding:4px 0 4px 18px;position:relative;font-size:13.5px}
.tsdoc ul.dash li::before{content:"—";position:absolute;left:0;color:var(--le-blue);font-weight:600}

/* ===== detail-toelichtingen ("Meer details") ===== */
.tsdoc .ts-detail{display:none !important}
.tsdoc sup.ts-ref{color:var(--le-blue);font-weight:700;font-size:10px;margin-left:2px}
.tsdoc .ts-annex-item{margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--le-grey-200)}
.tsdoc .ts-annex-item:last-child{border-bottom:none}
.tsdoc .ts-annex-item h4{font-size:12.5px;font-weight:700;letter-spacing:.04em;margin:0 0 6px}
.tsdoc .ts-annex-item h4 .num{color:var(--le-blue)}
.tsdoc .ts-annex-item p{font-size:13px;margin-bottom:8px}

/* ===== boete card ===== */
.tsdoc .clause-card{border-radius:var(--le-radius-md);padding:18px 20px;margin-bottom:12px}
.tsdoc .clause-card.yellow{background:var(--le-yellow-soft)}
.tsdoc .clause-card h4{font-size:11.5px;font-weight:700;letter-spacing:var(--le-tracking-caps);text-transform:uppercase;margin-bottom:8px}
.tsdoc .clause-card.yellow h4{color:var(--le-yellow-deep)}
.tsdoc .clause-card p{font-size:13px;margin-bottom:0}

/* ===== signature ===== */
.tsdoc .sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:44px;margin-top:28px}
.tsdoc .sig .line{border-bottom:1.5px solid var(--le-ink);height:64px}
.tsdoc .sig .who{font-size:12.5px;margin-top:10px;color:var(--le-grey-600);line-height:1.8}
.tsdoc .sig .who strong{color:var(--le-ink);font-weight:600}
.tsdoc .sig .who .fill{min-width:130px}

/* ===== disclaimer + LE footer ===== */
.tsdoc .disclaimer{
  font-size:10px;color:var(--le-grey-600);line-height:1.6;text-align:justify;
  background:var(--le-grey-100);border-radius:var(--le-radius-sm);
  padding:14px 16px;margin:10px 0 44px;
}
.tsdoc .le-footer{
  margin:0 -68px;
  background:var(--le-grey-100);
  border-top:1px solid var(--le-grey-200);
  padding:26px 68px;
  display:flex;align-items:center;gap:36px;flex-wrap:wrap;
  position:relative;z-index:1;
}
.tsdoc .le-footer .ts-logo{height:24px}
.tsdoc .le-footer .cols{display:flex;gap:36px;flex-wrap:wrap;font-size:11px;color:var(--le-grey-600);line-height:1.7}
.tsdoc .le-footer .tagline{font-size:11px;color:var(--le-ink)}
.tsdoc .le-footer .tagline em{font-style:italic;color:var(--le-grey-600)}

/* ===== structuurdiagram (editable-flow-diagram, tsd-prefix) ===== */
.tsdoc .tsd-box{position:relative;margin:18px 0 10px;width:100%;aspect-ratio:900/560}
.tsdoc .tsd-scale{position:absolute;top:0;left:0;width:900px;height:560px;transform-origin:top left}
.tsdoc .tsd-stage{position:relative;width:900px;height:560px}
.tsdoc .tsd-stage svg,.tsdoc .tsd-static svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.tsdoc .tsd-node{
  position:absolute;width:112px;height:112px;border-radius:50%;
  border:2.5px solid var(--le-grey-400);background:var(--le-blue-soft);
  display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;
  font-weight:600;font-size:13.5px;line-height:1.25;color:var(--le-grey-900);
  transform:translate(-50%,-50%);user-select:none;z-index:3;padding:6px;
}
.tsdoc .tsd-node--main{border-color:var(--le-blue)}
.tsdoc .tsd-sub{display:block;font-size:9px;font-weight:600;color:var(--le-grey-600);margin-top:4px;line-height:1.3}
.tsdoc .tsd-path{fill:none;stroke-width:2.5}
.tsdoc .tsd-path.dash{stroke-dasharray:6 6}
.tsdoc .tsd-lbl{
  position:absolute;transform:translate(-50%,-50%);text-align:center;
  font-size:11px;line-height:1.45;color:#333;
  background:rgba(255,255,255,.94);padding:5px 9px;border-radius:6px;
  border:1px solid var(--le-grey-200);
  white-space:nowrap;z-index:2;user-select:none;
}
.tsdoc .tsd-lbl b{font-size:13px;font-weight:700}
.tsdoc .tsd-lbl .mono{font-family:var(--le-mono);font-size:10.5px;font-weight:700}
.tsdoc .tsd-tools{position:absolute;top:6px;right:6px;z-index:6;display:flex;gap:8px}
.tsdoc .tsd-tools button{
  all:unset;cursor:pointer;font-family:var(--le-font);
  font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
  padding:7px 12px;border-radius:6px;background:rgba(0,0,0,.05);color:rgba(0,0,0,.55);transition:.15s;
}
.tsdoc .tsd-tools button:hover{background:rgba(0,0,0,.1);color:#000}
.tsdoc .tsd-tools button.on{background:var(--le-green);color:#000}
.tsdoc .tsd-stage.editing .tsd-node{cursor:move;outline:2px dashed rgba(0,85,255,.5);outline-offset:3px}
.tsdoc .tsd-stage.editing .tsd-lbl{cursor:move;outline:1.5px dashed rgba(180,150,255,.7)}
.tsdoc .tsd-handle{
  position:absolute;width:14px;height:14px;border-radius:50%;
  background:var(--le-blue);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);
  transform:translate(-50%,-50%);cursor:move;z-index:5;display:none;
}
.tsdoc .tsd-stage.editing .tsd-handle{display:block}
.tsdoc .tsd-hint{font-size:11.5px;color:var(--le-grey-600);opacity:.7;margin:2px 0 10px;display:none}
.tsdoc .tsd-box.editing+.tsd-hint{display:block}

@media (max-width:680px){
  .tsdoc .ts-page{padding:36px 22px 0}
  .tsdoc .le-footer{margin:0 -22px;padding:22px}
  .tsdoc .sig-grid{grid-template-columns:1fr}
  .tsdoc .fill--wide{min-width:200px}
}
@media print{
  .tsdoc .ts-page{box-shadow:none;max-width:none;border-radius:0;padding:14mm 16mm 0}
  .tsdoc .le-footer{margin:0 -16mm;padding:8mm 16mm}
  .tsdoc .fill{border-bottom-color:var(--le-grey-600)}
  .tsdoc .tsd-tools,.tsdoc .tsd-hint{display:none !important}
}
`;
