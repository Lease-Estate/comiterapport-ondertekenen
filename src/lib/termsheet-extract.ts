import Anthropic from "@anthropic-ai/sdk";
import type { TermSheetFills } from "./termsheet";
import { eurFmt } from "./termsheet";

/**
 * AI-extractie voor de term sheet: leest een Indicatief Leaserapport (PDF) of
 * een geëxporteerd comitérapport (HTML) en vult de invulvelden van de template
 * (TS_FILLS). Zelfde conventies als src/lib/extract.ts: PDF als native
 * document-input, structured output via JSON-schema, null bij twijfel.
 */

const MODEL = "claude-opus-4-8";

const SYSTEM = `Je bent een extractie-assistent voor Lease Estate. Je leest een leaserapport of comitérapport (onroerende leasing) en haalt er de gegevens uit voor een term sheet.

Strikte regels:
- Vul een veld alleen in als je het met redelijke zekerheid in het document vindt. Bij twijfel of afwezigheid: null. Verzin nooit waarden.
- Bedragen zijn getallen in euro zonder opmaak: "€ 1.486.875" → 1486875.
- Antwoord uitsluitend volgens het opgegeven JSON-schema.`;

const strN = { anyOf: [{ type: "string" }, { type: "null" }] };
const numN = { anyOf: [{ type: "number" }, { type: "null" }] };

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    klantNaam: strN,
    kbo: strN,
    zetel: strN,
    vertegenwoordiger: strN,
    adresVastgoed: strN,
    typeVastgoed: strN,
    verkoopprijs: numN,
    geschatteWaarde: numN,
    schatter: strN,
    schattingsdatum: strN,
    belastingregime: strN,
    investeringsbedrag: numN,
    restwaardeBedrag: numN,
    verhoogdeEersteHuur: numN,
    maandvergoeding: numN,
    aantalMaandtermijnen: numN,
  },
  required: [
    "klantNaam",
    "kbo",
    "zetel",
    "vertegenwoordiger",
    "adresVastgoed",
    "typeVastgoed",
    "verkoopprijs",
    "geschatteWaarde",
    "schatter",
    "schattingsdatum",
    "belastingregime",
    "investeringsbedrag",
    "restwaardeBedrag",
    "verhoogdeEersteHuur",
    "maandvergoeding",
    "aantalMaandtermijnen",
  ],
};

const INSTRUCTION = `Haal uit dit document de gegevens voor een term sheet onroerende leasing:
- klantNaam: naam van de klant/leasingnemer-vennootschap
- kbo: ondernemingsnummer (formaat "BE 0xxx.xxx.xxx" indien zichtbaar)
- zetel: adres van de maatschappelijke zetel van de leasingnemer
- vertegenwoordiger: wie de vennootschap vertegenwoordigt (naam + hoedanigheid, bv. "Jan Peeters, zaakvoerder")
- adresVastgoed: adres van het onroerend goed
- typeVastgoed: korte typering (bv. "kantoor + magazijn + parkeerplaatsen")
- verkoopprijs: verkoop-/aankoopprijs van het goed (€)
- geschatteWaarde: geschatte waarde (€), schatter: naam schatter, schattingsdatum
- belastingregime: "Registratierechten" of "btw"
- investeringsbedrag: totaal investerings-/financieringsbedrag (€)
- restwaardeBedrag: restwaarde/aankoopoptie in euro
- verhoogdeEersteHuur: verhoogde eerste huur (€), indien vermeld
- maandvergoeding: maandelijkse leasevergoeding (€)
- aantalMaandtermijnen: aantal maandelijkse termijnen (bv. 180)

Laat onbekende velden null.`;

interface Extracted {
  klantNaam: string | null;
  kbo: string | null;
  zetel: string | null;
  vertegenwoordiger: string | null;
  adresVastgoed: string | null;
  typeVastgoed: string | null;
  verkoopprijs: number | null;
  geschatteWaarde: number | null;
  schatter: string | null;
  schattingsdatum: string | null;
  belastingregime: string | null;
  investeringsbedrag: number | null;
  restwaardeBedrag: number | null;
  verhoogdeEersteHuur: number | null;
  maandvergoeding: number | null;
  aantalMaandtermijnen: number | null;
}

function toFills(r: Extracted): TermSheetFills {
  const f: TermSheetFills = {
    datum: new Date().toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" }),
    lnNaam: r.klantNaam,
    lnKbo: r.kbo,
    lnZetel: r.zetel,
    lnVertegenwoordiger: r.vertegenwoordiger,
    vgAdres: r.adresVastgoed,
    vgType: r.typeVastgoed,
    vgRegime: r.belastingregime,
  };
  if (r.verkoopprijs != null) f.vgVerkoopprijs = eurFmt(r.verkoopprijs);
  if (r.geschatteWaarde != null) f.vgWaarde = eurFmt(r.geschatteWaarde);
  if (r.schatter) f.vgSchatter = [r.schatter, r.schattingsdatum].filter(Boolean).join(", ");
  if (r.investeringsbedrag != null) {
    f.finBedrag = eurFmt(r.investeringsbedrag);
    f.finRestwaarde = eurFmt(r.restwaardeBedrag ?? r.investeringsbedrag * 0.25);
  } else if (r.restwaardeBedrag != null) {
    f.finRestwaarde = eurFmt(r.restwaardeBedrag);
  }
  if (r.verhoogdeEersteHuur != null) f.finVerhoogdeHuur = `1 × ${eurFmt(r.verhoogdeEersteHuur)} (verhoogde huur)`;
  if (r.maandvergoeding != null) {
    const n = r.aantalMaandtermijnen ?? 180;
    const rest = r.verhoogdeEersteHuur != null ? n - 1 : n;
    f.finMaandHuur = `${rest} × ${eurFmt(r.maandvergoeding)} per maand`;
  }
  return f;
}

/**
 * Comitérapport-HTML → platte tekst voor het model: styles/scripts/base64 weg,
 * tags naar spaties, whitespace samengevouwen, afgekapt op ~150k tekens.
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/data:[a-z/+;=]+base64,[A-Za-z0-9+/=]+/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .slice(0, 150_000);
}

export async function extractTermSheetFills(
  input: { kind: "pdf"; base64: string } | { kind: "html"; html: string },
): Promise<TermSheetFills> {
  const client = new Anthropic();
  const content =
    input.kind === "pdf"
      ? [
          { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: input.base64 } },
          { type: "text" as const, text: INSTRUCTION },
        ]
      : [
          { type: "text" as const, text: "Documenttekst (geëxtraheerd uit HTML):\n\n" + htmlToPlainText(input.html) },
          { type: "text" as const, text: INSTRUCTION },
        ];
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });
  const block = resp.content.find((b) => b.type === "text");
  const r = JSON.parse(block && block.type === "text" ? block.text : "{}") as Extracted;
  return toFills(r);
}
