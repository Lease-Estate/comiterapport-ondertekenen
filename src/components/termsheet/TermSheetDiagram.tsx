"use client";

import { useEffect, useRef, useState } from "react";
import {
  TSD_CANVAS,
  TSD_EDGES,
  tsdEdgePath,
  tsdNormalizeLayout,
  tsdStageHtml,
  type TsdLayout,
} from "@/lib/termsheet-diagram";

/**
 * Interactief structuurdiagram (sectie 03) volgens de editable-flow-diagram-
 * skill: uniforme schaal via transform (geen scrollbar), en in bewerkmodus
 * versleepbare nodes (blauw gestippeld), pijl-buigpunten (blauwe handles) en
 * labels (lila gestippeld). De layout wordt via onLayoutChange bewaard in de
 * term sheet-payload; de statische export (termsheet.ts) rendert exact
 * dezelfde markup via tsdStageHtml.
 */
export function TermSheetDiagram({
  layout: initialLayout,
  onLayoutChange,
  readOnly,
}: {
  layout: TsdLayout | null | undefined;
  onLayoutChange: (layout: TsdLayout) => void;
  /** Leesweergave (publieke ondertekenpagina): geen editorknoppen of slepen. */
  readOnly?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<TsdLayout>(tsdNormalizeLayout(initialLayout ?? undefined));
  const scaleFactor = useRef(1);
  const [editing, setEditing] = useState(false);
  const editingRef = useRef(false);
  editingRef.current = editing;

  useEffect(() => {
    const box = boxRef.current;
    const scaleWrap = scaleRef.current;
    const stage = stageRef.current;
    if (!box || !scaleWrap || !stage) return;

    stage.innerHTML = tsdStageHtml(layoutRef.current, { handles: true });

    const q = <T extends Element>(sel: string) => Array.from(stage.querySelectorAll<T>(sel));
    const nodeEls = new Map(q<HTMLElement>(".tsd-node").map((el) => [el.dataset.id!, el]));
    const lblEls = new Map(q<HTMLElement>(".tsd-lbl").map((el) => [el.dataset.id!, el]));
    const handleEls = new Map(q<HTMLElement>(".tsd-handle").map((el) => [el.dataset.id!, el]));
    const pathEls = new Map(q<SVGPathElement>(".tsd-path").map((el) => [el.dataset.id!, el]));

    function render() {
      const layout = layoutRef.current;
      nodeEls.forEach((el, id) => {
        el.style.left = layout.nodes[id][0] + "px";
        el.style.top = layout.nodes[id][1] + "px";
      });
      Object.keys(TSD_EDGES).forEach((id) => {
        pathEls.get(id)?.setAttribute("d", tsdEdgePath(layout, id));
        const l = layout.edges[id].l;
        const c = layout.edges[id].c;
        const lbl = lblEls.get(id);
        if (lbl) {
          lbl.style.left = l[0] + "px";
          lbl.style.top = l[1] + "px";
        }
        const hd = handleEls.get(id);
        if (hd) {
          hd.style.left = c[0] + "px";
          hd.style.top = c[1] + "px";
        }
      });
    }

    function applyScale() {
      const w = box!.clientWidth || TSD_CANVAS.w;
      scaleFactor.current = w / TSD_CANVAS.w;
      scaleWrap!.style.transform = `scale(${scaleFactor.current})`;
    }
    const ro = new ResizeObserver(applyScale);
    ro.observe(box);
    applyScale();
    render();

    /* ── slepen (alleen in bewerkmodus) ── */
    let drag: { kind: "node" | "c" | "l"; id: string } | null = null;

    function pos(ev: PointerEvent): [number, number] {
      const r = stage!.getBoundingClientRect();
      return [
        Math.round((ev.clientX - r.left) / scaleFactor.current),
        Math.round((ev.clientY - r.top) / scaleFactor.current),
      ];
    }
    function onDown(ev: PointerEvent) {
      if (!editingRef.current) return;
      const t = (ev.target as Element).closest<HTMLElement>(".tsd-node, .tsd-handle, .tsd-lbl");
      if (!t || !t.dataset.id) return;
      ev.preventDefault();
      drag = t.classList.contains("tsd-node")
        ? { kind: "node", id: t.dataset.id }
        : t.classList.contains("tsd-handle")
          ? { kind: "c", id: t.dataset.id }
          : { kind: "l", id: t.dataset.id };
      stage!.setPointerCapture?.(ev.pointerId);
    }
    function onMove(ev: PointerEvent) {
      if (!drag) return;
      const [x, y] = pos(ev);
      if (drag.kind === "node") layoutRef.current.nodes[drag.id] = [x, y];
      else layoutRef.current.edges[drag.id][drag.kind] = [x, y];
      render();
    }
    function onUp() {
      if (!drag) return;
      drag = null;
      onLayoutChange(JSON.parse(JSON.stringify(layoutRef.current)) as TsdLayout);
    }
    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerup", onUp);
    stage.addEventListener("pointercancel", onUp);
    return () => {
      ro.disconnect();
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", onUp);
      stage.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => {
    layoutRef.current = tsdNormalizeLayout(undefined);
    const stage = stageRef.current;
    if (stage) stage.innerHTML = tsdStageHtml(layoutRef.current, { handles: true });
    onLayoutChange(JSON.parse(JSON.stringify(layoutRef.current)) as TsdLayout);
    // Na innerHTML-reset zijn de element-referenties in de effect-closure stuk;
    // simpelste betrouwbare route: bewerkmodus sluiten en heropenen via key-remount.
    setRemount((n) => n + 1);
    setEditing(false);
  };
  const [remountKey, setRemount] = useState(0);

  return (
    <div key={remountKey} style={{ position: "relative" }}>
      <div className={`tsd-box${editing ? " editing" : ""}`} ref={boxRef}>
        <div className="tsd-scale" ref={scaleRef}>
          <div className={`tsd-stage${editing ? " editing" : ""}`} ref={stageRef} />
        </div>
        {readOnly ? null : (
          <div className="tsd-tools" data-noexport>
            <button type="button" className={editing ? "on" : ""} onClick={() => setEditing((e) => !e)}>
              {editing ? "Klaar" : "Layout aanpassen"}
            </button>
            {editing ? (
              <button type="button" onClick={reset}>
                Reset
              </button>
            ) : null}
          </div>
        )}
      </div>
      {readOnly ? null : (
        <div className="tsd-hint">
          Sleep partijen (blauw gestippeld), pijl-buigpunten (blauwe punten) en labels (lila gestippeld). De layout wordt
          automatisch bewaard.
        </div>
      )}
    </div>
  );
}
