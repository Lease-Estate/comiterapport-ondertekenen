/**
 * Structuurdiagram van de term sheet (sectie 03) — data + pure renderfuncties.
 *
 * Gebaseerd op de editable-flow-diagram-skill: een vast logisch canvas
 * (TSD_CANVAS), nodes als absoluut gepositioneerde divs, pijlen als
 * kwadratische beziers (M p1 Q c p2) met per pijl een versleepbaar buigpunt
 * `c` en een losse labelpositie `l`. De HTML wordt hier als string gebouwd
 * zodat de interactieve editor (TermSheetDiagram.tsx) en de statische export
 * naar DocuSeal (termsheet.ts) exact dezelfde markup delen.
 */

export interface TsdLayout {
  nodes: Record<string, [number, number]>;
  edges: Record<string, { c: [number, number]; l: [number, number] }>;
}

export const TSD_CANVAS = { w: 900, h: 560 };
const NODE_R = 56;

interface TsdNode {
  name: string;
  sub: string;
  /** Hoofdpartij (Lease Estate) krijgt het vierkant + blauwe rand. */
  main?: boolean;
}

interface TsdEdge {
  from: string;
  to: string;
  color: string;
  dash?: boolean;
  lbl: string;
}

export const TSD_NODES: Record<string, TsdNode> = {
  eigenaar: { name: "Eigenaar", sub: "verkoper · erfpachtgever" },
  le: { name: "Lease Estate", sub: "erfpachter · leasinggever", main: true },
  trefoncier: { name: "Tréfoncier", sub: "blote eigendom" },
  lessee: { name: "Leasingnemer", sub: "leasevergoedingen · aankoopoptie" },
};

export const TSD_EDGES: Record<string, TsdEdge> = {
  s1: {
    from: "eigenaar",
    to: "le",
    color: "#00C362",
    lbl: '<b style="color:#00C362">1.</b> Vestiging erfpachtrecht 35 j<br>upfront canon <span class="mono">97,5% (+5% RR)</span>',
  },
  s2: {
    from: "eigenaar",
    to: "trefoncier",
    color: "#E0A92E",
    lbl: '<b style="color:#E0A92E">2.</b> Verkoop tréfonds<br><span class="mono">2,5% (+12% RR)</span>',
  },
  s3: {
    from: "le",
    to: "lessee",
    color: "#c0392b",
    lbl: '<b style="color:#c0392b">3.</b> Extra vergoeding tot het<br>totale investeringsbedrag',
  },
  s4: {
    from: "le",
    to: "lessee",
    color: "#00C362",
    lbl: '<b style="color:#00C362">4.</b> Off-balance financieringshuur<br><span class="mono">15 j · 180× vooraf</span>',
  },
  s5: {
    from: "lessee",
    to: "le",
    color: "#0051FF",
    dash: true,
    lbl: '<b style="color:#0051FF">5.</b> Einde: aankoopoptie <span class="mono">25%</span> ·<br>verderhuur · teruggave',
  },
};

export const TSD_DEFAULT_LAYOUT: TsdLayout = {
  nodes: {
    eigenaar: [165, 100],
    le: [640, 100],
    trefoncier: [165, 420],
    lessee: [640, 420],
  },
  edges: {
    s1: { c: [402, 100], l: [402, 52] },
    s2: { c: [165, 260], l: [286, 260] },
    s3: { c: [560, 260], l: [462, 262] },
    s4: { c: [762, 260], l: [780, 190] },
    s5: { c: [720, 320], l: [772, 356] },
  },
};

function anchor(layout: TsdLayout, nodeId: string, towards: [number, number]): [number, number] {
  const [cx, cy] = layout.nodes[nodeId];
  const dx = towards[0] - cx;
  const dy = towards[1] - cy;
  const len = Math.hypot(dx, dy) || 1;
  const r = NODE_R + 8;
  return [cx + (dx / len) * r, cy + (dy / len) * r];
}

export function tsdEdgePath(layout: TsdLayout, id: string): string {
  const e = TSD_EDGES[id];
  const c = layout.edges[id].c;
  const p1 = anchor(layout, e.from, c);
  const p2 = anchor(layout, e.to, c);
  return `M ${p1[0]} ${p1[1]} Q ${c[0]} ${c[1]} ${p2[0]} ${p2[1]}`;
}

/** Vul een (mogelijk oudere/gedeeltelijke) layout aan tot alle nodes/edges bestaan. */
export function tsdNormalizeLayout(raw: unknown): TsdLayout {
  const base: TsdLayout = JSON.parse(JSON.stringify(TSD_DEFAULT_LAYOUT));
  if (raw && typeof raw === "object") {
    const cand = raw as Partial<TsdLayout>;
    for (const id of Object.keys(base.nodes)) {
      const n = cand.nodes?.[id];
      if (Array.isArray(n) && n.length === 2) base.nodes[id] = [Number(n[0]), Number(n[1])];
    }
    for (const id of Object.keys(base.edges)) {
      const e = cand.edges?.[id];
      if (e?.c && e?.l) base.edges[id] = { c: [Number(e.c[0]), Number(e.c[1])], l: [Number(e.l[0]), Number(e.l[1])] };
    }
  }
  return base;
}

/**
 * De volledige stage-markup (svg + nodes + labels + optionele sleep-handles)
 * in canvascoördinaten. De interactieve component zet dit in een geschaalde
 * wrapper en verplaatst elementen daarna imperatief tijdens het slepen.
 */
export function tsdStageHtml(layout: TsdLayout, opts?: { handles?: boolean }): string {
  const markers = Object.entries(TSD_EDGES)
    .map(
      ([id, e]) =>
        `<marker id="tsdArr-${id}" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill="${e.color}"/></marker>`,
    )
    .join("");
  const paths = Object.entries(TSD_EDGES)
    .map(
      ([id, e]) =>
        `<path data-id="${id}" class="tsd-path${e.dash ? " dash" : ""}" stroke="${e.color}" marker-end="url(#tsdArr-${id})" d="${tsdEdgePath(layout, id)}"/>`,
    )
    .join("");
  const nodes = Object.entries(TSD_NODES)
    .map(([id, n]) => {
      const [x, y] = layout.nodes[id];
      return `<div class="tsd-node${n.main ? " tsd-node--main" : ""}" data-id="${id}" style="left:${x}px;top:${y}px">${n.name}<span class="tsd-sub">${n.sub}</span></div>`;
    })
    .join("");
  const lbls = Object.entries(TSD_EDGES)
    .map(([id, e]) => {
      const [x, y] = layout.edges[id].l;
      return `<div class="tsd-lbl" data-id="${id}" style="left:${x}px;top:${y}px">${e.lbl}</div>`;
    })
    .join("");
  const handles = opts?.handles
    ? Object.keys(TSD_EDGES)
        .map((id) => {
          const [x, y] = layout.edges[id].c;
          return `<div class="tsd-handle" data-id="${id}" style="left:${x}px;top:${y}px"></div>`;
        })
        .join("")
    : "";
  return (
    `<svg viewBox="0 0 ${TSD_CANVAS.w} ${TSD_CANVAS.h}"><defs>${markers}</defs>${paths}</svg>` +
    nodes +
    lbls +
    handles
  );
}

/**
 * Statische weergave voor de export (DocuSeal / afdruk): de stage op een vaste
 * schaal in een wrapper met de juiste hoogte, zonder editor-chrome.
 */
export function tsdStaticHtml(layout: TsdLayout, widthPx: number): string {
  const scale = widthPx / TSD_CANVAS.w;
  const h = Math.round(TSD_CANVAS.h * scale);
  return (
    `<div class="tsd-static" style="position:relative;width:100%;height:${h}px;overflow:hidden">` +
    `<div class="tsd-stage" style="position:absolute;top:0;left:0;width:${TSD_CANVAS.w}px;height:${TSD_CANVAS.h}px;transform:scale(${scale});transform-origin:top left">` +
    tsdStageHtml(layout) +
    `</div></div>`
  );
}
