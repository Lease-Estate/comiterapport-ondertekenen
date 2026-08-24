"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Verwijderknop met bevestiging voor een term sheet (lijst op /ondertekenen). */
export function DeleteTermSheetButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!window.confirm(`Term sheet "${title}" definitief verwijderen?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/termsheets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch {
      setBusy(false);
      window.alert("Verwijderen mislukt — probeer opnieuw.");
    }
  };

  return (
    <button className="dz-open" type="button" onClick={() => void remove()} disabled={busy} style={{ all: "unset", cursor: "pointer", color: "#c0392b", fontSize: 13, fontWeight: 600 }}>
      {busy ? "Verwijderen…" : "Verwijderen"}
    </button>
  );
}
