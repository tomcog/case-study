// ─── Walkthrough player ────────────────────────────────────────────
// Full-viewport, two panes: stepped copy beside whatever the step is about.
// A driveable stage is an iframe reached through a Driver, and the spotlight is
// drawn here in the parent from the boxes the driver reports, so the highlight
// keeps this package's look rather than the product's. An opaque stage reports
// nothing, so it is shown, its overlays are positioned by Area, and the reader
// moves on with the panel's button. The stage itself (frame, scaling, overlay)
// is shared with the builder — see stage.tsx.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { INK, RED } from "../theme.js";
import { renderStyledText } from "../ui/renderStyledText.js";
import { Callouts, Spotlight, StageNotice, StageStill, areaBox, toBox, useApp } from "./stage.js";
import type { Box } from "./stage.js";
import type { Driver } from "./driver.js";
import { bootsApp, contentOf, stepMarks } from "./types.js";
import type { Callout, StepAction, StepAdvance, WalkthroughContent } from "./types.js";
import type { IngestedApp } from "../project.js";

const PANEL_W = 400;
const LINE = "#e6e4e1";
const MUTED = "#6f6a66";

const norm = (path: string) => `#${path.replace(/^#\/?/, "").replace(/\/$/, "")}`;

/** The marks a step points at, as a list. */
export const marksOf = (mark?: string | string[]) => (!mark ? [] : Array.isArray(mark) ? mark : [mark]);

/** Listen for whatever completes this step. Returns an unsubscribe. */
function watch(driver: Driver, advance: StepAdvance, done: () => void): () => void {
  switch (advance.on) {
    case "click":
      return driver.onClick((mark) => mark === advance.mark && done());
    case "path":
      return driver.onPath((path) => norm(path) === norm(advance.path) && done());
    case "signal":
      return driver.onSignal((name) => name === advance.name && done());
    case "any": {
      const offs = advance.of.map((a) => watch(driver, a, done));
      return () => offs.forEach((off) => off());
    }
    default:
      return () => {};
  }
}

/** Run the step's actions in order, stopping if the step moves on under us. */
async function perform(driver: Driver, actions: StepAction[], live: () => boolean) {
  for (const action of actions) {
    if (!live()) return;
    if (action.do === "wait") await new Promise((r) => setTimeout(r, action.ms));
    else if (action.do === "click") driver.click(action.mark);
    else driver.type(action.mark, action.text);
  }
}

export function WalkthroughPlayer({ content, apps = [], startIndex = 0, onExit }: {
  content: WalkthroughContent;
  /** The pool this walkthrough's steps draw from; a step stores an app's id,
   * and where that app is served from is the host's to say. */
  apps?: IngestedApp[];
  startIndex?: number;
  onExit?: () => void;
}) {
  const { steps } = content;
  const reduced = useReducedMotion();

  const [i, setI] = useState(startIndex);
  const [nudge, setNudge] = useState(false);

  const step = steps[i];
  const finished = i >= steps.length;

  // Spotlight and callouts are measured together.
  const markIds = useMemo(() => stepMarks(step), [step]);
  const markKey = markIds.join("|");
  const spotMarks = useMemo(() => marksOf(step?.spotlight?.mark), [step]);

  // The app this step runs, and what it displays over it. Changing the app
  // swaps the document; displaying something else leaves it running underneath.
  const app = useMemo(() => apps.find((a) => a.id === step?.app), [apps, step?.app]);
  const shown = contentOf(step);
  const demo = useApp(app?.src, markIds, app);
  const { driver, measure } = demo;

  const next = useCallback(() => setI((n) => n + 1), []);

  useEffect(() => {
    if (!step) return;
    let live = true;
    setNudge(false);

    const timers: number[] = [];
    let off = () => {};
    if (driver) {
      // A step that names a different app than the one before it boots that
      // app at its starting screen. Within a run nothing reloads, so whatever
      // the reader did on the last step is still there on this one.
      const boots = bootsApp(steps, i);
      void (async () => {
        await driver.open(boots ? step.start : undefined, { reload: boots });
        if (!live) return;
        if (step.actions?.length) await perform(driver, step.actions, () => live);
        if (!live) return;
        if (markIds[0]) driver.reveal(markIds[0]);
        measure();
        // Re-measure while the app's own transitions and the smooth scroll settle.
        timers.push(window.setTimeout(measure, 140), window.setTimeout(measure, 460));
      })();
      off = watch(driver, step.advance, () => live && next());
    }

    const nudgeAt = window.setTimeout(() => live && setNudge(true), step.nudgeAfter ?? 12000);

    return () => {
      live = false;
      off();
      timers.forEach((t) => clearTimeout(t));
      clearTimeout(nudgeAt);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver, i, step, markKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit?.();
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  // A spotlight is anchored either way: to measured marks on a driveable
  // stage, or to a rectangle on one that can only be shown.
  const box = useMemo(() => {
    const spot = step?.spotlight;
    if (!spot) return null;
    if (spot.area) return areaBox(spot.area, demo.bounds);
    return toBox(spotMarks.map((id) => demo.rects[id]).filter(Boolean), demo.scale, spot.pad ?? 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo.rects, spotMarks.join("|"), demo.scale, demo.bounds, step]);

  const calloutBox = (callout: Callout): Box | null => {
    if (callout.area) return areaBox(callout.area, demo.bounds);
    const rect = callout.mark ? demo.rects[callout.mark] : undefined;
    return rect ? toBox([rect], demo.scale, 0) : null;
  };

  const restart = () => setI(0);

  const narrow = demo.blocked === "small";
  // Nothing can be observed through an image or an embed, so a step showing
  // one can only be left by its button, whatever it was authored to wait for.
  const watching = !!driver && shown.kind === "app";
  const manual = !watching || step?.advance.on === "manual";
  const manualLabel = step?.advance.on === "manual" ? (step.advance.label ?? "Next") : "Next";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: content.panelSide === "right" ? "row-reverse" : "row",
        background: "#f4f3f1",
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: narrow ? "100%" : PANEL_W,
          flex: "none",
          background: "#fff",
          borderRight: narrow || content.panelSide === "right" ? undefined : `1px solid ${LINE}`,
          borderLeft: content.panelSide === "right" && !narrow ? `1px solid ${LINE}` : undefined,
          display: "flex",
          flexDirection: "column",
          padding: "26px 28px 22px",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: INK, letterSpacing: "-0.01em" }}>{content.title}</span>
          <span style={{ fontSize: 12, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
            {finished ? `${steps.length} of ${steps.length}` : `${i + 1} of ${steps.length}`}
          </span>
        </div>

        <div style={{ height: 3, background: LINE, borderRadius: 2, margin: "14px 0 26px", overflow: "hidden" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${((finished ? steps.length : i) / Math.max(1, steps.length)) * 100}%` }}
            transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 240, damping: 30 }}
            style={{ height: "100%", background: RED }}
          />
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step?.id ?? "__done"}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: reduced ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {step ? (
                <>
                  {step.eyebrow && (
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: RED, marginBottom: 10 }}>
                      {step.eyebrow}
                    </div>
                  )}
                  {step.title && (
                    <h2 style={{ margin: "0 0 12px", fontSize: 23, lineHeight: 1.2, letterSpacing: "-0.02em", color: INK, fontWeight: 650 }}>
                      {step.title}
                    </h2>
                  )}
                  {step.body && (
                    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "#45413d" }}>{renderStyledText(step.body)}</p>
                  )}
                  {step.imageUrl && (
                    <img src={step.imageUrl} alt="" style={{ display: "block", width: "100%", borderRadius: 10, marginTop: 18, border: `1px solid ${LINE}` }} />
                  )}
                </>
              ) : (
                <>
                  <h2 style={{ margin: "0 0 12px", fontSize: 23, lineHeight: 1.2, letterSpacing: "-0.02em", color: INK, fontWeight: 650 }}>
                    That's the walkthrough.
                  </h2>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "#45413d" }}>
                    The product stays where you left it — keep clicking around, or start again from the top.
                  </p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div style={{ paddingTop: 22 }}>
          {step && manual && (
            <button type="button" onClick={next} style={primary}>
              {manualLabel}
            </button>
          )}

          {step && !manual && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: MUTED, minHeight: 38 }}>
              <motion.span
                animate={reduced ? {} : { opacity: [1, 0.25, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                style={{ width: 7, height: 7, borderRadius: "50%", background: RED, flex: "none" }}
              />
              Your turn — do it in the app
            </div>
          )}

          {!step && (
            <button type="button" onClick={restart} style={primary}>
              Start again
            </button>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14 }}>
            {i > 0 && (
              <button type="button" onClick={() => setI((n) => Math.max(0, n - 1))} style={ghost}>
                Back
              </button>
            )}
            {step && !manual && nudge && (
              <button type="button" onClick={next} style={ghost}>
                Skip this step
              </button>
            )}
            {onExit && (
              <button type="button" onClick={onExit} style={{ ...ghost, marginLeft: "auto" }}>
                Exit
              </button>
            )}
          </div>
        </div>
      </div>

      {(demo.live || shown.kind !== "app") && !narrow && (
        <div ref={demo.stageRef} style={{ flex: 1, position: "relative", overflow: "hidden", background: "#0f1115" }}>
          {/* The app sits underneath whatever the step displays, so it keeps
              running while an image or an embed covers it. Keyed by its src,
              so arriving at a different app is always a fresh document. */}
          {demo.live && app && <iframe key={app.src} ref={demo.frameRef} title={app.label} style={demo.frameStyle} />}

          {shown.kind === "image" && <StageStill image={shown} />}
          {shown.kind === "embed" && (
            <iframe
              key={shown.url}
              src={shown.url}
              title={content.title ?? "Embedded page"}
              allowFullScreen
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
            />
          )}

          <Spotlight box={box} shape={step?.spotlight?.shape} dim={step?.spotlight?.dim} lock={step?.spotlight?.lock} />
          {step?.callouts?.length ? <Callouts items={step.callouts} boxFor={calloutBox} bounds={demo.bounds} /> : null}
        </div>
      )}

      {/* Only a step that means to show its app complains about not having one. */}
      {shown.kind === "app" && !demo.live && !narrow && <StageNotice blocked={demo.blocked!} src={app?.src} />}
    </div>
  );
}

const primary: React.CSSProperties = {
  appearance: "none",
  border: 0,
  background: RED,
  color: "#fff",
  font: "inherit",
  fontSize: 14,
  fontWeight: 600,
  padding: "10px 16px",
  borderRadius: 8,
  cursor: "pointer",
};

const ghost: React.CSSProperties = {
  appearance: "none",
  border: 0,
  background: "none",
  color: MUTED,
  font: "inherit",
  fontSize: 13.5,
  padding: 0,
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: 3,
};
