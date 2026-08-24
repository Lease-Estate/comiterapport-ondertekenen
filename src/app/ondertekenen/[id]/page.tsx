import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/data";
import { getCurrentUser, canEdit } from "@/lib/auth";
import { TermSheetEditor } from "@/components/termsheet/TermSheetEditor";

export const dynamic = "force-dynamic";

/** /ondertekenen/[id] — de term sheet-editor (bewerken + versturen via DocuSeal). */
export default async function TermSheetPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canEdit(user.role)) redirect("/dossiers");

  const record = await getStore().getTermSheet(params.id);
  if (!record) notFound();

  return <TermSheetEditor record={record} />;
}
