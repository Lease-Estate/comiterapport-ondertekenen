/**
 * Term sheets — het "Digitaal ondertekenen"-document (onroerende leasing).
 *
 * Een term sheet volgt de vaste Lease Estate-template (huisstijl, secties
 * 01–09, invulvelden met data-ph-placeholders, structuurdiagram, handtekening-
 * blokken). De inhoud komt uit een dossier (knop "Ter ondertekening"), een
 * leaserapport-PDF of een comitérapport-HTML (AI-extractie), en blijft daarna
 * volledig handmatig bewerkbaar in /ondertekenen/[id]. payload.bodyHtml is de
 * bewerkte documentinhoud; het structuurdiagram leeft apart als layout-JSON
 * (zie termsheet-diagram.ts) in een slot met [data-diagram-slot].
 */
import type { Dossier } from "./types";
import { TERMSHEET_CSS } from "./termsheet-css";
import { tsdNormalizeLayout, tsdStaticHtml, type TsdLayout } from "./termsheet-diagram";

export type TermSheetStatus = "draft" | "sent";

export interface TermSheetSigners {
  lessorName?: string;
  lessorEmail?: string;
  /** GSM (E.164); ingevuld = SMS-verificatie vereist voor deze ondertekenaar. */
  lessorPhone?: string;
  lesseeName?: string;
  lesseeEmail?: string;
  lesseePhone?: string;
}

/** Eén ondertekenaar zoals aangemaakt in DocuSeal, met onze publieke pagina-token. */
export interface TermSheetSubmitter {
  /** "Leasinggever"/"Leasingnemer" bij term sheets; vrije rolnamen bij vrij-documenten. */
  role: string;
  name?: string;
  email: string;
  /** GSM-nummer (E.164) — indien gezet was SMS-verificatie vereist. */
  phone?: string;
  /** DocuSeal-slug voor het ingebedde ondertekenformulier. */
  slug: string | null;
  /** Token van onze interactieve ondertekenpagina (/ondertekenen/t/[token]). */
  token: string;
  /** Is de eigen uitnodigingsmail succesvol verstuurd? */
  mailed: boolean;
}

export interface TermSheetPayload {
  /** innerHTML van de bewerkbare documentinhoud (het diagram-slot blijft leeg; "" bij vrij-documenten). */
  bodyHtml: string;
  /** Vrij-document-flow: geüploade PDF als DocuSeal-template, velden via de ingebedde editor. */
  vrij?: { templateId: number };
  /** Handmatige layout van het structuurdiagram (null = default). */
  diagramLayout?: TsdLayout | null;
  /** Laatst ingevulde ondertekenaars. */
  signers?: TermSheetSigners;
  /** Gezet na verzending naar DocuSeal. */
  docuseal?: {
    templateId: number;
    submissionId: number | null;
    sentAt: string;
    /** Per ondertekenaar: DocuSeal-slug + token van onze interactieve pagina. */
    submitters?: TermSheetSubmitter[];
  };
}

export interface TermSheetRecord {
  id: string;
  /** Gekoppeld dossier (null bij aanmaak vanuit een losse upload). */
  dossierSlug: string | null;
  title: string;
  payload: TermSheetPayload;
  status: TermSheetStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTermSheetInput {
  title: string;
  dossierSlug?: string | null;
  payload: TermSheetPayload;
  createdBy: string | null;
}

export interface TermSheetPatch {
  title?: string;
  payload?: TermSheetPayload;
  status?: TermSheetStatus;
}

/* ───────────────────────── invulvelden ───────────────────────── */

/** Alle invulvelden van de template: key → placeholder + omschrijving (voor de
 *  placeholder-controle vóór verzending en voor de AI-extractie). */
export const TS_FILLS: Record<string, { ph: string; label: string }> = {
  ref: { ph: "TS-2026/…", label: "Referentie" },
  datum: { ph: "… 2026", label: "Datum (masthead)" },
  lnNaam: { ph: "naam vennootschap", label: "Leasingnemer — naam" },
  lnKbo: { ph: "BE 0…", label: "Leasingnemer — KBO" },
  lnZetel: { ph: "adres maatschappelijke zetel", label: "Leasingnemer — zetel" },
  lnVertegenwoordiger: { ph: "naam + hoedanigheid", label: "Leasingnemer — vertegenwoordiger" },
  iban: { ph: "IBAN BE__ ____ ____ ____", label: "Betaalrekening (IBAN)" },
  vgAdres: { ph: "adres onroerend goed", label: "Vastgoed — adres" },
  vgType: { ph: "bv. kantoor + magazijn + parkeerplaatsen", label: "Vastgoed — type" },
  vgVerkoopprijs: { ph: "€ …", label: "Vastgoed — verkoopprijs" },
  vgWaarde: { ph: "€ …", label: "Vastgoed — geschatte waarde" },
  vgSchatter: { ph: "schatter, datum", label: "Vastgoed — schatter + datum" },
  vgRegime: { ph: "Registratierechten / btw", label: "Registratierechten of btw" },
  finBedrag: { ph: "€ …", label: "Investeringsbedrag" },
  finRestwaarde: { ph: "€ …", label: "Restwaarde/aankoopoptie (€)" },
  finVerhoogdeHuur: { ph: "1 × € … (verhoogde huur)", label: "Verhoogde eerste huur" },
  finMaandHuur: { ph: "… × € … per maand", label: "Maandelijkse leasevergoeding" },
  sigDatum: { ph: "… 2026", label: "Datum van ondertekening" },
  sigLgNaam: { ph: "…", label: "Ondertekenaar Lease Estate — naam" },
  sigLgHoedanigheid: { ph: "…", label: "Ondertekenaar Lease Estate — hoedanigheid" },
  sigLnNaam: { ph: "…", label: "Ondertekenaar leasingnemer — naam" },
  sigLnHoedanigheid: { ph: "…", label: "Ondertekenaar leasingnemer — hoedanigheid" },
};

export type TermSheetFills = Partial<Record<keyof typeof TS_FILLS, string | null>>;

/* ───────────────────────── clausule-bibliotheek ───────────────────────── */

/**
 * Veelvoorkomende clausules voor secties 06 (Waarborgen) en 07 (Opschortende
 * voorwaarden). De editor toont deze als keuzelijst bij "+ Toevoegen"; de
 * tekst blijft daarna gewoon bewerkbaar in het document (bv. om een bedrag
 * of naam in te vullen op de "…"-plaatsen).
 */
export const TS_CLAUSE_PRESETS: Record<"waarborgen" | "voorwaarden", string[]> = {
  waarborgen: [
    "<strong>Controlehypotheek</strong> aangevuld met een <strong>mandaat op de blote eigendom</strong>.",
    "<strong>Aankoopoptie en voorkooprecht op de tréfonds</strong> (blote eigendom) bij verbreking van de leasing.",
    "<strong>Verderzetverbintenis</strong> van ….",
    "<strong>Persoonlijke borgstelling</strong> van de zaakvoerder(s), ten belope van € ….",
    "<strong>Hoofdelijke borgstelling</strong> van de verbonden vennootschap ….",
    "<strong>Achterstelling van de rekening-courant</strong> van de aandeelhouders zolang de leasing loopt.",
    "<strong>Verpanding van de handelszaak</strong> in eerste rang.",
    "<strong>Schuldsaldo-/overlijdensverzekering</strong> op het hoofd van de zaakvoerder, met Lease Estate als begunstigde.",
    "<strong>Brandverzekering in nieuwwaarde</strong> met Lease Estate als eerste begunstigde.",
    "<strong>Huurwaarborg</strong> van … maanden leasevergoeding.",
  ],
  voorwaarden: [
    "Acceptatie van het dossier door het kredietcomité.",
    "Effectieve totstandkoming van de verrichting: de vestiging van het erfpachtrecht en de verkoop van de tréfonds, verleden voor de notaris.",
    "Schattingsverslag van het goed, naar vorm en inhoud aanvaardbaar voor Lease Estate.",
    "Voorlegging van de recentste (tussentijdse) cijfers, naar vorm en inhoud aanvaardbaar voor Lease Estate.",
    "Blanco bodemattest (OVAM) zonder opmerkingen, dan wel een voor Lease Estate aanvaardbaar bodemonderzoek.",
    "Stedenbouwkundige conformiteit van het pand, aangetoond aan de hand van de vergunningshistoriek.",
    "Voorlegging van de brandverzekeringspolis (nieuwwaarde) met vermelding van Lease Estate.",
    "Gunstige afronding van het KYC/AML-onderzoek van de leasingnemer en de tréfoncier.",
    "Geen wezenlijke negatieve wijziging in de financiële toestand van de leasingnemer tot aan het verlijden van de akten.",
    "Ondertekening van de leasingovereenkomst en de bijhorende documentatie.",
  ],
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fill(key: string, fills: TermSheetFills, extraStyle?: string, wide?: boolean): string {
  const def = TS_FILLS[key];
  const v = fills[key as keyof typeof TS_FILLS];
  return (
    `<span class="fill${wide ? " fill--wide" : ""}" contenteditable="true" data-key="${key}" data-ph="${esc(def.ph)}"` +
    (extraStyle ? ` style="${extraStyle}"` : "") +
    `>${v ? esc(String(v)) : ""}</span>`
  );
}

export function eurFmt(n: number): string {
  return "€ " + Math.round(n).toLocaleString("nl-BE");
}

function todayNl(): string {
  return new Date().toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" });
}

/* ───────────────────────── detail-toelichtingen ───────────────────────── */

/**
 * Voorzet-teksten voor de "Meer details"-pop-up bij de vijf standaard
 * verrichtingsstappen (sectie 03). De sleutel is de vetgedrukte aanhef van de
 * stap; de editor herkent daarmee de stap en biedt de voorzet aan wanneer er
 * nog geen eigen toelichting is ingevuld. De tekst blijft daarna vrij
 * bewerkbaar en komt (indien ingevuld) als "Toelichting" achteraan de PDF.
 */
export const TS_STEP_DETAILS: Record<string, string> = {
  "Vestiging erfpachtrecht":
    "<p>Een <strong>erfpachtrecht</strong> is een manier om <strong>een gebouw of grond langdurig te gebruiken alsof het van jou is, zonder dat je juridisch de eigenaar van de grond bent</strong>. Het is heel vergelijkbaar met een vruchtgebruik.</p><p>Een eenvoudig voorbeeld: stel dat persoon A eigenaar is van een stuk grond met een gebouw erop. A geeft aan persoon B een erfpachtrecht voor bijvoorbeeld 30 jaar. Vanaf dan mag B het vastgoed gedurende die periode gebruiken, verhuren, verbouwen en er economisch voordeel uit halen, binnen de afspraken van de erfpachtovereenkomst. A blijft ondertussen juridisch eigenaar van de grond.</p><p>Je kunt het dus ongeveer zo bekijken:</p><blockquote><p><strong>De eigenaar heeft de grond op papier. De erfpachter krijgt voor lange tijd het economische gebruik ervan.</strong></p></blockquote><p>Op het einde van de erfpacht <strong>stopt het recht</strong> en krijgt de <strong>eigenaar opnieuw de volledige beschikking over het vastgoed</strong>.</p><p>De looptijd van 35 jaar is bewust langer dan de leaseperiode van 15 jaar: zo behoudt het erfpachtrecht na afloop van de leasing een reële restwaarde, wat essentieel is voor de off-balance kwalificatie en voor de waarde van de aankoopoptie.</p>",
  "Verkoop tréfonds":
    "<p>De <strong>tréfonds</strong> is eenvoudig gezegd de <strong>onderliggende grond waarop het erfpachtrecht wordt gevestigd</strong>.</p><p>De koper van de tréfonds blijft dus de <strong>juridische eigenaar van het goed</strong>, terwijl de erfpachter gedurende de looptijd het recht krijgt om die grond en het vastgoed erop te gebruiken en economisch te exploiteren.</p><p>Binnen een leasetransactie is de koper van de tréfonds meestal de <strong>leasingnemer zelf of een verbonden partij</strong>. Doordat de tréfonds bij (een verbonden vennootschap van) de leasingnemer ligt, komt de volle eigendom na afloop van de erfpacht automatisch in de groep terecht.</p>",
  "Extra vergoeding":
    "<p>De leasinggever kan steeds <strong>extra kosten meefinancieren</strong> of <strong>voordelen toekennen</strong> zonder dat deze bij de canon behoren (waarop registratierechten verschuldigd zijn). Er zijn twee opties:</p><p><strong><u>Optie 1: de leasinggever betaalt de kosten</u></strong><br>De leasinggever betaalt de transactiekosten rechtstreeks en <strong>deze worden mee opgenomen in de totale leasefinanciering</strong>. De leasingnemer betaalt ze dus niet afzonderlijk terug, maar <strong>gespreid via de periodieke leasevergoedingen</strong>, samen met de rest van de financiering.</p><p><strong><u>Optie 2: de leasinggever vergoedt de kosten die op naam van de leasingnemer staan</u></strong><br>De financiële tussenkomst van de leasinggever wordt beschouwd als een huurvoordeel of tegemoetkoming (&laquo;Lease Incentive&raquo;). <strong>Geen onmiddellijke opbrengst:</strong> de leasingnemer kan deze vergoeding niet volledig als opbrengst boeken op het moment dat hij ze ontvangt. <strong>Spreiding over de looptijd:</strong> de tegemoetkoming wordt <strong>gespreid over de looptijd van de leasing</strong> en verwerkt als een vermindering van de periodieke leasekosten. De leasinggever verwerkt deze tegemoetkoming op een gelijkaardige manier gespreid als een vermindering van zijn lease-inkomsten.</p>",
  "Terbeschikkingstelling via leasing":
    "<p>Hoewel Lease Estate juridisch houder is van het erfpachtrecht, wordt het vastgoed gedurende de volledige looptijd ter beschikking gesteld van de leasingnemer via een onopzegbare financieringshuur.</p><p>De leasingnemer gebruikt het vastgoed voor eigen rekening en beschikt zelf, of via een verbonden partij, over de <strong>tréfonds</strong>. Daardoor heeft hij in de praktijk nagenoeg dezelfde economische controle over het vastgoed als een eigenaar.</p><p>Het erfpachtrecht heeft voor Lease Estate dan ook vooral een <strong>juridische zekerheidsfunctie</strong>: het beschermt haar positie zolang de leasing niet volledig is afgelost. Na afloop kan het erfpachtrecht volgens de contractuele afspraken worden overgenomen door de leasingnemer.</p>",
  "Einde leasing":
    "<p>Op het einde van de leasing heeft de leasingnemer drie opties:</p><p>1. Het goed <strong>kosteloos teruggeven</strong> aan de leasinggever.</p><p>2. Het <strong>lichten van de aankoopoptie</strong>; er kunnen zich vervolgens twee scenario's voordoen:<br>&mdash; De <u>leasingnemer is ook de tréfoncier</u>: in dit geval worden erfpachtrecht en naakte eigendom herenigd en wordt de <strong>leasingnemer terug volle eigenaar</strong>.<br>&mdash; <u>De tréfoncier is een andere verbonden partij</u>: in dit geval kan de leasingnemer het goed nog gedurende de duurtijd van het erfpachtrecht gebruiken zoals een eigenaar (en zoals tijdens de leasing). <strong>Eens het erfpachtrecht afloopt wordt de tréfoncier kosteloos volle eigenaar.</strong></p><p>3. Het <strong>lichten van de verderhuuroptie</strong>: de leasingnemer kiest ervoor om de <strong>vergoeding niet in één keer te betalen maar te spreiden over een periode van 3 tot 5 jaar</strong>. Na het betalen van de laatste vergoeding gaat het erfpachtrecht over, of stopt het erfpachtrecht met bestaan en wordt de tréfoncier terug volle eigenaar.</p>",
  // Toelichting bij de gelijknamige waarborg-preset; wordt bij het toevoegen
  // van de clausule automatisch als detailblok meegegeven.
  Verderzetverbintenis:
    "<p>De <strong>verderzettingsverbintenis</strong> geeft de leasingmaatschappij de mogelijkheid om, wanneer de oorspronkelijke leasingnemer zijn verplichtingen niet langer nakomt, de partij die de verbintenis heeft ondertekend te verplichten om de leasingovereenkomst <strong>verder te zetten en de verplichtingen van de leasingnemer over te nemen</strong>.</p><p>Deze structuur biedt voordelen voor alle betrokken partijen:</p><p>&mdash; <strong>Voor de leasinggever:</strong> er is een tweede, vooraf gekende partij die de leasing kan verderzetten wanneer de oorspronkelijke leasingnemer uitvalt. Hierdoor wordt het risico op een onmiddellijke stopzetting van de leasing beperkt.</p><p>&mdash; <strong>Voor de leasingnemer en de verderzettende partij:</strong> bij problemen hoeft de leasingmaatschappij niet onmiddellijk haar zekerheden uit te oefenen en het vastgoed onder tijdsdruk te verkopen, wat vaak tot een lagere verkoopprijs leidt. De verderzettende partij kan de leasing overnemen, het vastgoed blijven gebruiken en samen met de leasingmaatschappij naar de meest geschikte oplossing zoeken.</p><p>Indien een verkoop uiteindelijk toch aangewezen is, kan die daardoor <strong>gecontroleerd en zonder onnodige tijdsdruk worden georganiseerd</strong>, met als doel de waarde van het vastgoed zoveel mogelijk te behouden of te maximaliseren. Dit is in het belang van zowel de leasingnemer, de verderzettende partij als de leasinggever.</p>",
};

/**
 * Zoek gebalanceerde `<div class="ts-detail" …>…</div>`-blokken in de body
 * (diepte-bewust, want de inhoud kan geneste divs bevatten). Geeft per blok
 * de positie, de volledige omvang en de binnen-HTML terug.
 */
export function findDetailBlocks(html: string): { start: number; end: number; inner: string }[] {
  const out: { start: number; end: number; inner: string }[] = [];
  const openRe = /<div[^>]*class="[^"]*ts-detail[^"]*"[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(html))) {
    const contentStart = m.index + m[0].length;
    let depth = 1;
    const tagRe = /<div\b[^>]*>|<\/div>/g;
    tagRe.lastIndex = contentStart;
    let t: RegExpExecArray | null;
    let end = -1;
    while ((t = tagRe.exec(html))) {
      depth += t[0].startsWith("</") ? -1 : 1;
      if (depth === 0) {
        end = t.index + t[0].length;
        break;
      }
    }
    if (end < 0) break;
    out.push({ start: m.index, end, inner: html.slice(contentStart, end - "</div>".length) });
    openRe.lastIndex = end;
  }
  return out;
}

/** Platte tekst van een HTML-fragment (voor labels in de toelichting). */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/* ───────────────────────── voorvullen vanuit een dossier ───────────────────────── */

export function dossierToFills(d: Dossier, slug: string): TermSheetFills {
  const inv = d.request?.totalInvestment || 0;
  const monthly = d.request?.totalMonthly || 0;
  const appraisal = d.property?.buildingScore?.appraisal;
  const f: TermSheetFills = {
    ref: `TS-${new Date().getFullYear()}/${slug}`,
    datum: todayNl(),
    lnNaam: d.company?.name || null,
    lnKbo: d.meta?.kbo || null,
    lnZetel: d.company?.registeredOffice || null,
    lnVertegenwoordiger: d.company?.manager || null,
    vgAdres: d.company?.propertyAddress || null,
    sigLnNaam: d.company?.manager || null,
  };
  if (appraisal?.freeSaleValue) {
    f.vgWaarde = eurFmt(appraisal.freeSaleValue);
    if (appraisal.appraiser) f.vgSchatter = [appraisal.appraiser, appraisal.date].filter(Boolean).join(", ");
  }
  if (inv > 0) {
    f.finBedrag = eurFmt(inv);
    f.finRestwaarde = eurFmt(inv * 0.25);
  }
  if (monthly > 0) f.finMaandHuur = `180 × ${eurFmt(monthly)} per maand`;
  return f;
}

/* ───────────────────────── template ───────────────────────── */

const LOGO_PATHS =
  '<g><path d="M145.65,30.14v113.4c14.51-14.51,23.49-34.56,23.49-56.7s-8.98-42.19-23.49-56.7"/><path d="M88.95,167.03h0c22.14,0,42.19-8.98,56.7-23.49H32.25c14.51,14.51,34.56,23.49,56.7,23.49"/><path d="M8.76,86.84h0c0,22.14,8.98,42.19,23.49,56.7V30.14c-14.51,14.51-23.49,34.56-23.49,56.7"/><path d="M88.95,6.66h0c-22.14,0-42.19,8.98-56.7,23.49h113.4c-14.51-14.51-34.56-23.49-56.7-23.49"/></g><polygon points="814.76 243.23 814.76 226.64 777.96 226.64 762.19 226.64 723.42 226.64 723.42 243.23 760.41 243.23 760.41 341.05 777.96 341.05 777.96 243.23 814.76 243.23"/><polygon points="107.16 291.09 163.03 291.09 163.03 274.69 107.16 274.69 107.16 243.23 168.94 243.23 168.94 226.64 89.62 226.64 89.62 341.05 169.14 341.05 169.14 324.46 107.16 324.46 107.16 291.09"/><path d="M340.01,275.84c-25.93-4.58-31.08-10.87-31.08-19.83,0-10.11,8.39-16.59,22.5-16.59,17.92,0,25.17,9.15,28.79,25.74l17.16-3.43c-4.39-21.17-16.4-37.37-45.19-37.37-26.32,0-40.81,12.77-40.81,32.03,0,16.78,10.11,29.18,41.57,34.33,22.31,3.62,29.75,8.96,29.75,19.64s-8.58,17.54-25.55,17.54c-19.83,0-31.65-11.06-34.7-29.18l-16.97,3.43c2.86,23.26,17.74,41,50.72,41.19,30.32,0,44.24-13.54,44.24-33.75,0-15.83-8.58-28.41-40.43-33.75"/><polygon points="409.61 291.09 465.49 291.09 465.49 274.69 409.61 274.69 409.61 243.23 471.4 243.23 471.4 226.64 392.07 226.64 392.07 341.05 471.59 341.05 471.59 324.46 409.61 324.46 409.61 291.09"/><polygon points="554.46 291.09 610.34 291.09 610.34 274.69 554.46 274.69 554.46 243.23 616.25 243.23 616.25 226.64 536.92 226.64 536.92 341.05 616.44 341.05 616.44 324.46 554.46 324.46 554.46 291.09"/><path d="M678.61,275.84c-25.93-4.58-31.08-10.87-31.08-19.83,0-10.11,8.39-16.59,22.5-16.59,17.92,0,25.17,9.15,28.79,25.74l17.16-3.43c-4.39-21.17-16.4-37.37-45.19-37.37-26.32,0-40.81,12.77-40.81,32.03,0,16.78,10.11,29.18,41.57,34.33,22.31,3.62,29.75,8.96,29.75,19.64s-8.58,17.54-25.55,17.54c-19.83,0-31.65-11.06-34.7-29.18l-16.97,3.43c2.86,23.26,17.74,41,50.72,41.19,30.32,0,44.24-13.54,44.24-33.75,0-15.83-8.58-28.41-40.43-33.75"/><polygon points="900.84 243.23 937.83 243.23 937.83 341.05 955.38 341.05 955.38 243.23 992.18 243.23 992.18 226.64 900.84 226.64 900.84 243.23"/><polygon points="1001.72 226.64 1001.72 341.06 1081.24 341.06 1081.24 324.46 1019.26 324.46 1019.26 291.09 1075.14 291.09 1075.14 274.69 1019.26 274.69 1019.26 243.23 1081.05 243.23 1081.05 226.64 1001.72 226.64"/><polygon points="230.36 226.64 253.1 294.53 207.62 294.53 230.36 226.64 212.05 226.64 173.72 341.06 192.03 341.06 202.74 309.09 257.98 309.09 268.69 341.06 287 341.06 248.67 226.64 230.36 226.64"/><polygon points="857.32 226.64 880.06 294.53 834.57 294.53 857.32 226.64 839.01 226.64 800.68 341.06 818.99 341.06 829.7 309.09 884.94 309.09 895.64 341.06 913.95 341.06 875.62 226.64 857.32 226.64"/><polygon points="8.76 226.64 8.76 341.06 26.31 341.06 79.89 341.06 79.89 324.46 26.31 324.46 26.31 226.64 8.76 226.64"/>';

const LOGO_SVG = `<svg class="ts-logo" viewBox="0 0 1090 350" role="img" aria-label="Lease Estate">${LOGO_PATHS}</svg>`;

/**
 * De bewerkbare documentinhoud (binnen .ts-page, na de masthead). Wordt bij
 * aanmaak één keer gegenereerd met de voorgevulde waarden en daarna als
 * bewerkte HTML in payload.bodyHtml bijgehouden.
 */
export function termSheetBodyHtml(f: TermSheetFills): string {
  return `
  <div class="tagrow">
    <span class="le-tag le-tag--yellow">Strikt vertrouwelijk</span>
    <span class="le-tag le-tag--blue">Bindend voorstel</span>
  </div>

  <div class="eyebrow">Term Sheet</div>
  <h1>Onroerende <span class="accent">leasing</span></h1>
  <p class="subtitle">Financieringsvoorstel voor bedrijfsvastgoed via een 15-jarige off-balance onroerende leasing, opgezet als medeconcessie met vestiging van een 35-jarig erfpachtrecht.</p>

  <section>
    <div class="sec-head"><span class="num">01</span><h2>Partijen</h2></div>
    <table>
      <tr><th>Leasinggever</th><td><strong>Lease Estate NV</strong>, Coupure 88, 9000 Gent — BE 0735.699.666 (de "<strong>Leasinggever</strong>")</td></tr>
      <tr><th>Leasingnemer</th><td>${fill("lnNaam", f, undefined, true)} — KBO ${fill("lnKbo", f)}<br>Zetel: ${fill("lnZetel", f, undefined, true)}<br>Vertegenwoordigd door ${fill("lnVertegenwoordiger", f, undefined, true)} (de "<strong>Leasingnemer</strong>")</td></tr>
      <tr><th>Betaalrekening</th><td>${fill("iban", f, undefined, true)}<br><span class="small">In te vullen door de leasingnemer — rekening waarlangs de leasevergoedingen worden vereffend.</span></td></tr>
      <tr><th>Wet KMO-financiering</th><td>Niet van toepassing</td></tr>
    </table>
  </section>

  <section>
    <div class="sec-head"><span class="num">02</span><h2>Voorwerp van de leasing</h2></div>
    <table>
      <tr><th>Vastgoed</th><td>${fill("vgAdres", f, undefined, true)}</td></tr>
      <tr><th>Type</th><td>${fill("vgType", f, undefined, true)}</td></tr>
      <tr><th>Verkoopprijs</th><td>${fill("vgVerkoopprijs", f)}</td></tr>
      <tr><th>Geschatte waarde</th><td>${fill("vgWaarde", f)} — ${fill("vgSchatter", f)}</td></tr>
      <tr><th>Registratierechten of btw?</th><td>${fill("vgRegime", f)}</td></tr>
    </table>
  </section>

  <section>
    <div class="sec-head"><span class="num">03</span><h2>Structuur van de verrichting</h2></div>
    <p>De verrichting wordt opgezet als een off-balance leasingstructuur op basis van een <strong>medeconcessie</strong>: de eigenaar vestigt een erfpachtrecht van 35 jaar ten gunste van Lease Estate tegen een éénmalige upfront canon en verkoopt de tréfonds (blote eigendom) rechtstreeks aan de tréfoncier. Het erfpachtrecht wordt vervolgens via een onopzegbare onroerende financieringshuur van 15 jaar ter beschikking gesteld van de leasingnemer.</p>

    <div data-diagram-slot contenteditable="false"></div>

    <h3 style="margin-top:22px">Verrichtingsstappen</h3>
    <ol class="clauses steps">
      <li><strong>Vestiging erfpachtrecht.</strong> De eigenaar vestigt een erfpachtrecht van 35 jaar ten gunste van Lease Estate, tegen betaling van een éénmalige upfront vergoeding (canon) van 97,5% van de waarde van het goed. Op deze canon zijn 5,00% registratierechten verschuldigd, ten laste van de leasingnemer.<div class="ts-detail" hidden>${TS_STEP_DETAILS["Vestiging erfpachtrecht"]}</div></li>
      <li><strong>Verkoop tréfonds.</strong> Onmiddellijk aansluitend op de erfpachtvestiging wordt de tréfonds (blote eigendom) voor het saldo van 2,5% verkocht aan de tréfoncier — de leasingnemer of een met haar verbonden vennootschap. Op deze verkoop zijn 12,00% registratierechten verschuldigd, ten laste van de koper van de tréfonds.<div class="ts-detail" hidden>${TS_STEP_DETAILS["Verkoop tréfonds"]}</div></li>
      <li><strong>Extra vergoeding.</strong> In voorkomend geval betaalt Lease Estate in het kader van de leasingtransactie een extra vergoeding om tot het totale investeringsbedrag te komen. De stappen 1 tot en met 4 worden samen voor de notaris verleden en vormen één geheel.<div class="ts-detail" hidden>${TS_STEP_DETAILS["Extra vergoeding"]}</div></li>
      <li><strong>Terbeschikkingstelling via leasing.</strong> Het erfpachtrecht wordt door Lease Estate ter beschikking gesteld van de leasingnemer middels een off-balance financieringshuurovereenkomst met een onopzegbare duur van 15 jaar, 180 maandelijks vooraf betaalbare leasevergoedingen en een restwaarde en aankoopoptie van 25%.<div class="ts-detail" hidden>${TS_STEP_DETAILS["Terbeschikkingstelling via leasing"]}</div></li>
      <li><strong>Einde leasing.</strong> Op het einde van de leaseperiode heeft de leasingnemer 3 mogelijkheden: het lichten van de aankoopoptie (25%), de verderhuuroptie (gespreid over max. 5 jaar), of teruggave van het goed bij niet-lichten van de optie.<div class="ts-detail" hidden>${TS_STEP_DETAILS["Einde leasing"]}</div></li>
    </ol>
    <p class="small" style="margin-top:10px">Er is geen volledige wedersamenstelling van het geïnvesteerde kapitaal in hoofde van de leasinggever naast de rente en de kosten van de verrichting. Dit wordt voor het Belgisch boekhoudrecht als een off-balance lease beschouwd (KB 29/04/2019 m.b.t. de verwerking van leaseverrichtingen in de jaarrekening); de leasingnemer neemt de leasevergoedingen integraal in kosten als huurbetalingen.</p>
  </section>

  <section>
    <div class="sec-head"><span class="num">04</span><h2>Financieringsvoorstel — modaliteiten</h2></div>
    <table>
      <tr><th>Investeringsbedrag</th><td>${fill("finBedrag", f)}</td></tr>
      <tr><th>Looptijd leasing</th><td>15 jaar, onopzegbaar</td></tr>
      <tr><th>Periodiciteit</th><td>180, maandelijks vooraf betaalbaar</td></tr>
      <tr><th>Restwaarde en aankoopoptie</th><td><span class="fig">25%</span> — ${fill("finRestwaarde", f)}</td></tr>
      <tr><th>Leasevergoeding</th><td>${fill("finVerhoogdeHuur", f)}<br>${fill("finMaandHuur", f)}</td></tr>
      <tr><th>Erfpachtrecht</th><td>35 jaar</td></tr>
    </table>
  </section>

  <section>
    <div class="sec-head"><span class="num">05</span><h2>Kosten</h2></div>
    <table>
      <tr><th>Dossierkosten</th><td><span class="fig">€ 3.500</span>, éénmalig, excl. btw. De opdracht van Lease Estate is louter van financiële aard en omvat de opzet van de onroerende leasingtransactie, de documentatie alsook de begeleiding voor notaris.</td></tr>
      <tr><th>Aankoop- en exploitatiekosten</th><td>Ten laste van de leasingnemer</td></tr>
      <tr><th>Registratierechten</th><td>Alle aankoopkosten en registratierechten zijn ten laste van de leasingnemer, en de koper van de tréfonds, tenzij uitdrukkelijk anders vermeld</td></tr>
    </table>
  </section>

  <section>
    <div class="sec-head"><span class="num">06</span><h2>Waarborgen</h2></div>
    <ol class="clauses" data-clause-list="waarborgen">
      <li>${TS_CLAUSE_PRESETS.waarborgen[0]}</li>
      <li>${TS_CLAUSE_PRESETS.waarborgen[1]}</li>
    </ol>
  </section>

  <section>
    <div class="sec-head"><span class="num">07</span><h2>Opschortende voorwaarden</h2></div>
    <ol class="clauses" data-clause-list="voorwaarden">
      <li>${TS_CLAUSE_PRESETS.voorwaarden[0]}</li>
      <li>${TS_CLAUSE_PRESETS.voorwaarden[1]}</li>
      <li>${TS_CLAUSE_PRESETS.voorwaarden[2]}</li>
    </ol>
  </section>

  <section>
    <div class="sec-head"><span class="num">08</span><h2>Boeteclausule</h2></div>
    <div class="clause-card yellow">
      <h4>Verbrekingsvergoeding bij niet-totstandkoming</h4>
      <p>Indien de leasing niet tot stand komt door toedoen van de leasingnemer — waaronder begrepen maar niet beperkt tot het kiezen van een andere financieringspartner — zal door Lease Estate een verbrekingsvergoeding aangerekend worden van <strong>€ 10.000</strong> (excl. btw), onverminderd de reeds verschuldigde dossierkosten.</p>
    </div>
  </section>

  <section>
    <div class="sec-head"><span class="num">09</span><h2>Slotbepalingen</h2></div>
    <ul class="dash">
      <li><strong>Bindend karakter</strong> — Deze term sheet verbindt partijen vanaf ondertekening, onder de opschortende voorwaarden vermeld in art. 7. De verdere uitwerking gebeurt in de leasingovereenkomst en de notariële akten, die de bepalingen van deze term sheet overnemen zonder afbreuk te doen aan het bindende karakter ervan.</li>
      <li><strong>Vertrouwelijkheid</strong> — Dit document en zijn inhoud zijn strikt vertrouwelijk en mogen niet aan derden worden meegedeeld zonder voorafgaand schriftelijk akkoord van Lease Estate.</li>
      <li><strong>Geldigheidsduur</strong> — Dit voorstel vervalt van rechtswege 1 maand na dagtekening, behoudens schriftelijke verlenging.</li>
      <li><strong>Toepasselijk recht en bevoegdheid</strong> — Belgisch recht; exclusieve bevoegdheid van de rechtbanken te Gent.</li>
    </ul>
  </section>

  <section>
    <p>Opgemaakt in tweevoud te Gent, op ${fill("sigDatum", f, "min-width:110px")}.</p>
    <div class="sig-grid">
      <div class="sig">
        <div class="line" data-sig="leasinggever"></div>
        <div class="who"><strong>Voor Lease Estate NV</strong><br>Naam: ${fill("sigLgNaam", f)}<br>Hoedanigheid: ${fill("sigLgHoedanigheid", f)}</div>
      </div>
      <div class="sig">
        <div class="line" data-sig="leasingnemer"></div>
        <div class="who"><strong>Voor de Leasingnemer</strong><br>Naam: ${fill("sigLnNaam", f)}<br>Hoedanigheid: ${fill("sigLnHoedanigheid", f)}</div>
      </div>
    </div>
  </section>

  <div class="disclaimer">
    BELANGRIJK BERICHT — Door ondertekening van dit document verklaren partijen zich gebonden door de erin opgenomen voorwaarden, onder de opschortende voorwaarden vermeld in art. 7. Dit voorstel wordt verder uitgewerkt in een leasingovereenkomst en de bijhorende notariële akten, die de clausules gebruikelijk voor dit soort transacties zullen bevatten, zonder afbreuk te doen aan het bindende karakter van deze term sheet. Dit document en zijn inhoud zijn strikt vertrouwelijk en kunnen niet, geheel of gedeeltelijk, aan derden meegedeeld worden zonder het voorafgaande en schriftelijke akkoord van Lease Estate NV. In geen geval kan Lease Estate NV aansprakelijk worden gesteld tegenover eender welk persoon uit hoofde van enig verlies, nadeel of schade die ten gevolge van dit document zou kunnen ontstaan.
  </div>`;
}

/** De vaste masthead (logo + referentie/datum) — boven de bewerkbare inhoud. */
export function termSheetMastheadHtml(f: TermSheetFills): string {
  return `
  <svg class="bg-mark" viewBox="0 0 176.25 177.21" aria-hidden="true"><path d="M144.82,31.91v113.4c14.51-14.51,23.49-34.56,23.49-56.7s-8.98-42.19-23.49-56.7"/><path d="M88.12,168.79h0c22.14,0,42.19-8.98,56.7-23.49H31.42c14.51,14.51,34.56,23.49,56.7,23.49"/><path d="M7.94,88.61h0c0,22.14,8.98,42.19,23.49,56.7V31.9c-14.51,14.51-23.49,34.56-23.49,56.7"/><path d="M88.12,8.42h0c-22.14,0-42.19,8.98-56.7,23.49h113.4c-14.51-14.51-34.56-23.49-56.7-23.49"/></svg>
  <div class="masthead">
    ${LOGO_SVG}
    <div class="doc-meta">
      Referentie: <strong>${fill("ref", f, "min-width:90px")}</strong><br>
      Datum: <strong>${fill("datum", f, "min-width:90px")}</strong><br>
      Geldigheidsduur: <strong>1 maand</strong>
    </div>
  </div>`;
}

export function termSheetFooterHtml(): string {
  return `
  <div class="le-footer" contenteditable="false">
    ${LOGO_SVG}
    <div class="cols">
      <div class="tagline">financiert bedrijfspanden<br><em>op een nieuwe manier</em></div>
      <div>Coupure 88<br>9000 Gent</div>
      <div>+32 471 29 30 71<br>+32 485 88 20 62</div>
      <div>info@lease-estate.com<br>www.lease-estate.com</div>
    </div>
  </div>`;
}

/** Initiële volledige bewerkbare inhoud (masthead + body + footer). */
export function initialTermSheetHtml(f: TermSheetFills): string {
  return termSheetMastheadHtml(f) + termSheetBodyHtml(f) + termSheetFooterHtml();
}

/* ───────────────────────── export naar DocuSeal ───────────────────────── */

/** Breedte van de inhoud binnen .ts-page (840 − 2×68 padding). */
const CONTENT_W = 704;

export interface BuildSignHtmlOpts {
  /**
   * Hoe de handtekeningvelden worden aangebracht:
   * - "api" (default): <signature-field>-elementen voor de DocuSeal
   *   /templates/html-API (Pro-editie).
   * - "texttags": onzichtbare {{...}}-teksttags op de handtekeninglijnen —
   *   de gratis route: het document wordt via het afdrukvenster als PDF
   *   bewaard en in DocuSeal gesleept, dat de tags herkent en de velden
   *   automatisch plaatst.
   */
  fields?: "api" | "texttags";
  /** Open automatisch het afdrukvenster zodra de pagina geladen is. */
  autoPrint?: boolean;
}

/**
 * Standalone HTML voor DocuSeal: huisstijl-CSS + fonts (absolute URL's naar de
 * app), het bewerkte document met het diagram statisch ingebakken, en
 * DocuSeal-handtekeningvelden in de sig-blokken (role Leasinggever /
 * Leasingnemer). DocuSeal rendert dit server-side naar PDF.
 */
export function buildSignHtml(record: TermSheetRecord, appOrigin: string, opts?: BuildSignHtmlOpts): string {
  const fields = opts?.fields ?? "api";
  const layout = tsdNormalizeLayout(record.payload.diagramLayout ?? undefined);
  let body = record.payload.bodyHtml;

  // Diagram-slot → statische weergave (het slot zelf blijft staan voor de vorm).
  body = body.replace(
    /(<div[^>]*data-diagram-slot[^>]*>)[\s\S]*?(<\/div>)/,
    `$1${tsdStaticHtml(layout, CONTENT_W)}$2`,
  );

  // Handtekeningvelden in de twee sig-lijnen.
  if (fields === "api") {
    body = body.replace(
      /(<div[^>]*data-sig="leasinggever"[^>]*>)/,
      '$1<signature-field name="Handtekening Lease Estate" role="Leasinggever" style="width:240px;height:58px;display:inline-block"></signature-field>',
    );
    body = body.replace(
      /(<div[^>]*data-sig="leasingnemer"[^>]*>)/,
      '$1<signature-field name="Handtekening leasingnemer" role="Leasingnemer" style="width:240px;height:58px;display:inline-block"></signature-field>',
    );
  } else {
    // Onzichtbare (witte) teksttags: blijven in de tekstlaag van de afgedrukte
    // PDF staan, zodat DocuSeal ze bij het uploaden herkent en de velden
    // automatisch op de handtekeninglijnen plaatst.
    body = body.replace(
      /(<div[^>]*data-sig="leasinggever"[^>]*>)/,
      '$1<span class="ts-texttag">{{Handtekening Lease Estate;role=Leasinggever;type=signature}}</span>',
    );
    body = body.replace(
      /(<div[^>]*data-sig="leasingnemer"[^>]*>)/,
      '$1<span class="ts-texttag">{{Handtekening leasingnemer;role=Leasingnemer;type=signature}}</span>',
    );
  }

  // "Meer details"-toelichtingen: elk gevuld detailblok wordt in de tekst
  // vervangen door een verwijsnummer en achteraan gebundeld in een sectie
  // "Toelichting" (vóór het handtekeningblok).
  const blocks = findDetailBlocks(body).filter((b) => stripTags(b.inner).length > 0);
  if (blocks.length > 0) {
    const annexItems: string[] = [];
    let out = "";
    let cursor = 0;
    blocks.forEach((b, i) => {
      const n = i + 1;
      // Label: de vetgedrukte aanhef van de regel waarin het blok staat,
      // anders het begin van de regeltekst.
      const liStart = body.lastIndexOf("<li>", b.start);
      const lead = body.slice(liStart >= 0 ? liStart : Math.max(0, b.start - 300), b.start);
      const strong = /<strong>([\s\S]*?)<\/strong>/.exec(lead);
      const plain = stripTags(lead);
      const label = strong ? stripTags(strong[1]).replace(/\.$/, "") : plain.slice(0, 60) + (plain.length > 60 ? "…" : "");
      annexItems.push(`<div class="ts-annex-item"><h4><span class="num">(${n})</span> ${esc(label)}</h4>${b.inner}</div>`);
      out += body.slice(cursor, b.start) + `<sup class="ts-ref">(${n})</sup>`;
      cursor = b.end;
    });
    out += body.slice(cursor);
    body = out;

    const annex =
      `<section><div class="sec-head"><span class="num">10</span><h2>Toelichting</h2></div>` +
      `<p class="small">De verwijsnummers (1)…(${blocks.length}) in de tekst verwijzen naar onderstaande toelichtingen; zij maken integraal deel uit van deze term sheet.</p>` +
      annexItems.join("") +
      `</section>`;
    // Invoegen vóór de sectie met het handtekeningblok.
    const sigIdx = body.indexOf("Opgemaakt in tweevoud");
    const secIdx = sigIdx >= 0 ? body.lastIndexOf("<section>", sigIdx) : -1;
    body = secIdx >= 0 ? body.slice(0, secIdx) + annex + body.slice(secIdx) : body + annex;
  }

  const fonts = `
  @font-face{font-family:'Degular';src:url('${appOrigin}/fonts/degular-400.woff2') format('woff2');font-weight:400;font-style:normal}
  @font-face{font-family:'Degular';src:url('${appOrigin}/fonts/degular-500.woff2') format('woff2');font-weight:500;font-style:normal}
  @font-face{font-family:'Degular';src:url('${appOrigin}/fonts/degular-600.woff2') format('woff2');font-weight:600 700;font-style:normal}`;

  // Na het (automatisch geopende) afdrukvenster kiest de gebruiker
  // "Opslaan als PDF"; we wachten op de fonts zodat de huisstijl mee print.
  const printScript = opts?.autoPrint
    ? `<script>window.addEventListener("load",function(){(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(function(){setTimeout(function(){window.print()},300)})});</script>`
    : "";

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<title>${esc(record.title)}</title>
<style>${fonts}
@page{size:A4;margin:0}
body{margin:0;padding:0;background:#fff}
${TERMSHEET_CSS}
.tsdoc .ts-page{box-shadow:none;border-radius:0;max-width:none;padding:14mm 16mm 0}
.tsdoc .le-footer{margin:0 -16mm;padding:8mm 16mm}
.tsdoc .ts-texttag{color:#fff;font-size:8px;line-height:1;user-select:none}
/* Nette paginabreuks in de PDF: blokken niet middendoor knippen. */
.tsdoc table, .tsdoc .clause-card, .tsdoc .sig-grid, .tsdoc .ts-annex-item,
.tsdoc ol.clauses>li, .tsdoc ul.dash>li, .tsdoc .tsd-static{break-inside:avoid;page-break-inside:avoid}
.tsdoc .sec-head{break-after:avoid;page-break-after:avoid}
</style>
${printScript}
</head>
<body>
<div class="tsdoc"><div class="ts-page">${body}</div></div>
</body>
</html>`;
}
