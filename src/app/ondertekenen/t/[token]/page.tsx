import { notFound } from "next/navigation";
import { getStore } from "@/lib/data";
import { TermSheetSignView } from "@/components/termsheet/TermSheetSignView";

export const dynamic = "force-dynamic";

/**
 * /ondertekenen/t/[token] — publieke, interactieve ondertekenpagina voor één
 * ondertekenaar (klant of Lease Estate). Toegang via de lange token uit de
 * uitnodigingsmail; geen login. Toont de term sheet als levende HTML-pagina
 * (openklapbare details, diagram) met onderaan het ingebedde
 * DocuSeal-ondertekenformulier.
 */
export default async function SignPage({ params }: { params: { token: string } }) {
  const token = params.token?.trim();
  if (!token || token.length < 20) notFound();

  const all = await getStore().listTermSheets();
  const record = all.find((t) => t.payload.docuseal?.submitters?.some((s) => s.token === token));
  const submitter = record?.payload.docuseal?.submitters?.find((s) => s.token === token);
  if (!record || !submitter) {
    // Diagnose in de serverlogs: hoeveel records/tokens zagen we wél?
    console.error("[sign-page] token niet gevonden", {
      tokenPrefix: token.slice(0, 8),
      records: all.length,
      withSubmitters: all.filter((t) => (t.payload.docuseal?.submitters?.length ?? 0) > 0).length,
      tokenPrefixes: all.flatMap((t) => t.payload.docuseal?.submitters?.map((s) => s.token.slice(0, 8)) ?? []),
    });
    notFound();
  }

  const docusealUrl = process.env.DOCUSEAL_URL?.trim()?.replace(/\/+$/, "") ?? null;

  return (
    <TermSheetSignView
      title={record.title}
      bodyHtml={record.payload.bodyHtml}
      diagramLayout={record.payload.diagramLayout ?? null}
      submitterName={submitter.name}
      submitterRole={submitter.role}
      signSrc={submitter.slug && docusealUrl ? `${docusealUrl}/s/${submitter.slug}` : null}
      embedScriptSrc={docusealUrl ? `${docusealUrl}/js/form.js` : null}
    />
  );
}
