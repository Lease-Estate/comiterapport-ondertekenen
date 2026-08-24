import { describe, expect, it } from "vitest";
import { buildSignHtml, findDetailBlocks, initialTermSheetHtml } from "./termsheet";
import type { TermSheetRecord } from "./termsheet";

function recordWith(bodyHtml: string): TermSheetRecord {
  return {
    id: "t1",
    dossierSlug: null,
    title: "Term sheet — test",
    payload: { bodyHtml, diagramLayout: null },
    status: "draft",
    createdBy: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

describe("findDetailBlocks", () => {
  it("vindt gebalanceerde detailblokken, ook met geneste divs", () => {
    const html =
      '<li>Stap één.<div class="ts-detail" hidden><p>Uitleg <b>vet</b></p><div>genest</div></div></li>' +
      '<li>Stap twee.<div class="ts-detail" hidden><p>Tweede</p></div></li>';
    const blocks = findDetailBlocks(html);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].inner).toContain("genest");
    expect(blocks[0].inner).toContain("<p>Uitleg <b>vet</b></p>");
    expect(blocks[1].inner).toBe("<p>Tweede</p>");
  });

  it("geeft niets terug zonder detailblokken", () => {
    expect(findDetailBlocks("<li>gewoon</li>")).toHaveLength(0);
  });
});

describe("buildSignHtml — toelichting-bijlage", () => {
  it("bundelt gevulde details achteraan met verwijsnummers", () => {
    let body = initialTermSheetHtml({});
    // Injecteer een toelichting in de eerste verrichtingsstap.
    body = body.replace(
      "<li><strong>Vestiging erfpachtrecht.</strong>",
      '<li><strong>Vestiging erfpachtrecht.</strong><div class="ts-detail" hidden><p>Extra uitleg over de canon.</p></div>',
    );
    const html = buildSignHtml(recordWith(body), "https://example.com");
    expect(html).toContain('<sup class="ts-ref">(1)</sup>');
    expect(html).toContain("<h2>Toelichting</h2>");
    expect(html).toContain("Extra uitleg over de canon.");
    expect(html).toContain("Vestiging erfpachtrecht");
    // De bijlage staat vóór het handtekeningblok.
    expect(html.indexOf("<h2>Toelichting</h2>")).toBeLessThan(html.indexOf("Opgemaakt in tweevoud"));
    // Handtekeningvelden blijven aanwezig.
    expect(html).toContain('role="Leasinggever"');
    expect(html).toContain('role="Leasingnemer"');
  });

  it("teksttag-variant zet {{...}}-tags op de handtekeninglijnen i.p.v. API-velden", () => {
    const html = buildSignHtml(recordWith(initialTermSheetHtml({})), "https://example.com", {
      fields: "texttags",
      autoPrint: true,
    });
    expect(html).toContain("{{Handtekening Lease Estate;role=Leasinggever;type=signature}}");
    expect(html).toContain("{{Handtekening leasingnemer;role=Leasingnemer;type=signature}}");
    expect(html).not.toContain("<signature-field");
    expect(html).toContain("window.print()");
  });

  it("laat lege details weg en bouwt geen bijlage zonder inhoud", () => {
    let body = initialTermSheetHtml({});
    // Strip de standaardtoelichtingen zodat alleen een leeg detailblok overblijft.
    for (const b of findDetailBlocks(body).reverse()) body = body.slice(0, b.start) + body.slice(b.end);
    body = body.replace(
      "<li><strong>Verkoop tréfonds.</strong>",
      '<li><strong>Verkoop tréfonds.</strong><div class="ts-detail" hidden>   </div>',
    );
    const html = buildSignHtml(recordWith(body), "https://example.com");
    expect(html).not.toContain("<h2>Toelichting</h2>");
    expect(html).not.toContain('<sup class="ts-ref">');
  });

  it("nieuwe term sheets bevatten standaard de toelichtingen bij de vijf verrichtingsstappen", () => {
    const body = initialTermSheetHtml({});
    expect(findDetailBlocks(body)).toHaveLength(5);
    const html = buildSignHtml(recordWith(body), "https://example.com");
    expect(html).toContain("<h2>Toelichting</h2>");
    expect(html).toContain('<sup class="ts-ref">(5)</sup>');
    expect(html).toContain("erfpachtrecht");
    expect(html).toContain("verderhuuroptie");
  });
});
