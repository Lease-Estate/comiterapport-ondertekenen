import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/data";
import { getCurrentUser, canEdit } from "@/lib/auth";
import { builderToken, docusealConfigured, docusealHost, getTemplateAuthorEmail } from "@/lib/docuseal";
import { VrijDocEditor } from "@/components/termsheet/VrijDocEditor";

export const dynamic = "force-dynamic";

/**
 * /ondertekenen/vrij/[id] — vrij-document-flow: de geüploade PDF met de
 * ingebedde DocuSeal-veldeneditor (velden slepen: naam, datum, handtekening,
 * …) en daarna versturen met dezelfde uitnodigings- en tokenflow als de term
 * sheets.
 */
export default async function VrijDocPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canEdit(user.role)) redirect("/dossiers");

  const record = await getStore().getTermSheet(params.id);
  if (!record || !record.payload.vrij) notFound();

  if (!docusealConfigured()) {
    return (
      <div style={{ padding: 40, fontFamily: "Degular, Arial, sans-serif" }}>
        DocuSeal is niet gekoppeld (DOCUSEAL_URL / DOCUSEAL_API_TOKEN ontbreken).
      </div>
    );
  }

  // user_email in de builder-JWT moet een bestaand account op de instantie
  // zijn — de auteur van de template (= eigenaar van de API-token) is dat per
  // definitie; opzoeken via de API voorkomt env-giswerk.
  const authorEmail = await getTemplateAuthorEmail(record.payload.vrij.templateId);

  return (
    <VrijDocEditor
      record={record}
      builderJwt={builderToken({ templateId: record.payload.vrij.templateId, userEmail: authorEmail ?? undefined })}
      builderHost={docusealHost()}
    />
  );
}
