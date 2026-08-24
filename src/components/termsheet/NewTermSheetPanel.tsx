"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { TermSheetRecord } from "@/lib/termsheet";

/**
 * "Nieuwe term sheet"-paneel op /ondertekenen: blanco template, of een upload
 * (leaserapport-PDF / comitérapport-HTML) die door Claude wordt uitgelezen.
 * Vanuit een dossier aanmaken gaat via de knop "Ter ondertekening" in het
 * rapport zelf.
 */
export function NewTermSheetPanel() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const vrijRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"blank" | "upload" | "vrij" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createBlank = async () => {
    setBusy("blank");
    setError(null);
    try {
      const res = await fetch("/api/termsheets", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = (await res.json()) as { error?: string; termSheet?: TermSheetRecord };
      if (!res.ok || !data.termSheet) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.push(`/ondertekenen/${data.termSheet.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  const upload = async (file: File) => {
    setBusy("upload");
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/termsheets/from-upload", { method: "POST", body: form });
      const data = (await res.json()) as { error?: string; termSheet?: TermSheetRecord };
      if (!res.ok || !data.termSheet) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.push(`/ondertekenen/${data.termSheet.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const uploadVrij = async (file: File) => {
    setBusy("vrij");
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/termsheets/vrij", { method: "POST", body: form });
      const data = (await res.json()) as { error?: string; termSheet?: TermSheetRecord };
      if (!res.ok || !data.termSheet) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.push(`/ondertekenen/vrij/${data.termSheet.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    } finally {
      if (vrijRef.current) vrijRef.current.value = "";
    }
  };

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.html,.htm,application/pdf,text/html"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      <input
        ref={vrijRef}
        type="file"
        accept=".pdf,application/pdf"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void uploadVrij(f);
        }}
      />
      <button className="dz-cta" type="button" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
        {busy === "upload" ? "Uitlezen met AI…" : "+ Vanuit PDF of HTML"}
      </button>
      <button
        className="dz-cta"
        type="button"
        disabled={busy !== null}
        title="Willekeurige PDF uploaden en zelf velden (naam, datum, handtekening) op het document plaatsen"
        onClick={() => vrijRef.current?.click()}
      >
        {busy === "vrij" ? "Aanmaken…" : "+ Vrij document (PDF)"}
      </button>
      <button className="dz-navlink" type="button" disabled={busy !== null} onClick={() => void createBlank()}>
        {busy === "blank" ? "Aanmaken…" : "Blanco term sheet"}
      </button>
      {error ? <span style={{ color: "#c0392b", fontSize: 13 }}>{error}</span> : null}
    </div>
  );
}
