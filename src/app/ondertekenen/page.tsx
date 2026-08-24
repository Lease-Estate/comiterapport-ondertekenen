import Link from "next/link";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/data";
import { getCurrentUser, canEdit } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { DzNav } from "@/components/DzNav";
import { NewTermSheetPanel } from "@/components/termsheet/NewTermSheetPanel";
import { DeleteTermSheetButton } from "@/components/termsheet/DeleteTermSheetButton";

export const dynamic = "force-dynamic";

/** /ondertekenen — overzicht van term sheets (digitaal ondertekenen). */
export default async function OndertekenenPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canEdit(user.role)) redirect("/dossiers");

  const termSheets = await getStore().listTermSheets();

  return (
    <div className="dz">
      <DzNav>
        <Link className="dz-navlink" href="/dossiers">
          Dossiers
        </Link>
        <Link className="dz-navlink" href="/account">
          Account
        </Link>
        <form action={logout} style={{ display: "inline-flex" }}>
          <button className="dz-navlink" type="submit">
            Uitloggen
          </button>
        </form>
      </DzNav>

      <section className="dz-hero">
        <div className="dz-glow" aria-hidden="true" />
        <div className="dz-hero-main">
          <p className="dz-label">Digitaal ondertekenen</p>
          <h1 className="dz-h1">Term sheets</h1>
        </div>
        <p className="dz-mono dz-hero-user">
          {user.email} · {user.role}
        </p>
      </section>

      <section className="dz-panel">
        <div className="dz-panel-top">
          <p className="dz-label">Nieuwe term sheet</p>
        </div>
        <p style={{ fontSize: 13.5, color: "#575757", margin: "0 0 14px" }}>
          Start vanuit een geüpload Indicatief Leaserapport (PDF) of een geëxporteerd comitérapport (HTML) — de
          velden worden automatisch uitgelezen — of vanuit een dossier via de knop &laquo;Ter ondertekening&raquo; in
          het rapport. Daarna is alles nog handmatig aanpasbaar vóór verzending via DocuSeal.
        </p>
        <NewTermSheetPanel />
      </section>

      <section className="dz-panel">
        <div className="dz-panel-top">
          <p className="dz-label">Term sheets</p>
          <span className="dz-mono">
            {termSheets.length} {termSheets.length === 1 ? "document" : "documenten"}
          </span>
        </div>

        {termSheets.length === 0 ? (
          <div className="dz-empty">Nog geen term sheets.</div>
        ) : (
          <div className="dz-grid">
            {termSheets.map((t) => (
              <div className="dz-card" key={t.id}>
                <Link className="dz-card-main" href={t.payload.vrij ? `/ondertekenen/vrij/${t.id}` : `/ondertekenen/${t.id}`}>
                  <p className="dz-clabel">{t.payload.vrij ? "Vrij document" : "Term sheet"}</p>
                  <p className="dz-ctitle">{t.title}</p>
                  <p className="dz-mono dz-ckbo">
                    {t.dossierSlug ? `dossier ${t.dossierSlug} · ` : ""}
                    {new Date(t.updatedAt).toLocaleDateString("nl-BE")}
                  </p>
                </Link>
                <div className="dz-card-foot">
                  <span className={`dz-badge dz-badge-${t.status === "sent" ? "frozen" : "draft"}`}>
                    {t.status === "sent" ? "Verzonden" : "Draft"}
                  </span>
                  <DeleteTermSheetButton id={t.id} title={t.title} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
