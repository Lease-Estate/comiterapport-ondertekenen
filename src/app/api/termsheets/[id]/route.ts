import { NextResponse } from "next/server";
import { getStore } from "@/lib/data";
import { getCurrentUser, canEdit, isAdmin } from "@/lib/auth";
import type { TermSheetPayload } from "@/lib/termsheet";

export const dynamic = "force-dynamic";

/** GET /api/termsheets/[id] — één term sheet. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || !canEdit(user.role)) return NextResponse.json({ error: "Geen rechten." }, { status: 403 });
  const rec = await getStore().getTermSheet(params.id);
  if (!rec) return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
  return NextResponse.json({ termSheet: rec });
}

/** PATCH /api/termsheets/[id] — autosave: { title?, payload? }. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || !canEdit(user.role)) return NextResponse.json({ error: "Geen rechten." }, { status: 403 });

  let body: { title?: string; payload?: TermSheetPayload };
  try {
    body = (await req.json()) as { title?: string; payload?: TermSheetPayload };
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON." }, { status: 400 });
  }
  if (body.payload && typeof body.payload.bodyHtml !== "string") {
    return NextResponse.json({ error: "payload.bodyHtml ontbreekt." }, { status: 400 });
  }

  const store = getStore();
  const existing = await store.getTermSheet(params.id);
  if (!existing) return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });

  const rec = await store.updateTermSheet(params.id, {
    title: body.title,
    payload: body.payload,
  });
  return NextResponse.json({ termSheet: rec });
}

/** DELETE /api/termsheets/[id]. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || !(canEdit(user.role) || isAdmin(user.role))) {
    return NextResponse.json({ error: "Geen rechten." }, { status: 403 });
  }
  await getStore().deleteTermSheet(params.id);
  return NextResponse.json({ ok: true });
}
