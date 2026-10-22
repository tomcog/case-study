// ─── The project builder (edit mode) ───────────────────────────────
// Rail, canvas, inspector. The canvas is the stage itself, so what you author
// is what plays: selecting a step puts the stage into the state that step
// describes.
//
// The apps are edited in one place, from the toolbar, because the pool is
// shared by every project — a step only ever picks which app it runs.
//
// The inspector offers a step only what that step can actually use, which is
// decided by what it displays. On a running app, marks are picked by clicking
// the product: it is same-origin, so the builder can read what was clicked and
// say when an element has no data-walkthrough id to point at yet. An embed or
// an image can't be read, so the author drags a rectangle instead. A slide
// covers the stage and carries its own copy, so the panel fields, the overlays
// drawn over the stage and the choice of what advances it all go away — on a
// slide they would be controls whose effect the reader never sees.

import { useEffect, useMemo, useState } from "react";
import { Reorder } from "motion/react";
import { ChevronDown, ChevronUp, Copy, Crosshair, Image as ImageIcon, LayoutGrid, Layers, Play, Plus, Square, Trash2, X } from "lucide-react";
import { ACCENT } from "../core.js";
import type { Screen } from "../core.js";
import { SlideFields, SlideView, newScreen } from "../slide.js";
import { Field, ImageField, PreviewCardSettings, inputStyle } from "../editors.js";
import { Button, ButtonRound, Segment, SegmentedControl } from "@tomcoggia/ui";
import { WalkthroughPlayer, marksOf } from "./WalkthroughPlayer.js";
import { AreaDraw, Callouts, HoverOutline, STAGE_BG, Spotlight, StageNotice, StageStill, areaBox, toBox, useApp } from "./stage.js";
import type { Box } from "./stage.js";
import type { PickHit } from "./driver.js";
import { appRuns, bootsApp, contentOf, stepLabel, stepMarks } from "./types.js";
import type { Area, Callout, StepAction, StepAdvance, StepContent, WalkthroughContent, WalkthroughStep } from "./types.js";
import type { IngestedApp } from "../project.js";

const ADVANCE_KINDS: { value: StepAdvance["on"]; label: string; hint: string }[] = [
  { value: "manual", label: "A button", hint: "The reader presses Next in the panel." },
  { value: "click", label: "A click", hint: "The reader clicks a marked element in the app." },
  { value: "path", label: "A route", hint: "The app navigates to a hash route." },
  { value: "signal", label: "A signal", hint: "The app fires wt:signal with this name." },
  { value: "any", label: "Any of…", hint: "Whichever of these happens first." },
];

const CONTENT_KINDS: { value: StepContent["kind"]; label: string; hint: string }[] = [
  { value: "app", label: "The app", hint: "The app this step is running. The reader uses it, and the step can watch what they do." },
  { value: "embed", label: "A URL", hint: "Any page in a frame — a Figma prototype, a live site. The reader can click inside it; nothing out here can see them do it." },
  { value: "image", label: "An image", hint: "A still. Whatever the step is running keeps running behind it." },
  { value: "slide", label: "A slide", hint: "A composed slide, full screen. It carries its own copy, so the panel steps aside for it." },
];

const uid = () => `step-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;

const newStep = (): WalkthroughStep => ({
  id: uid(),
  eyebrow: "Step",
  title: "New step",
  body: "What should the reader do here?",
  advance: { on: "manual" },
});

const appName = (apps: IngestedApp[], id?: string | null) =>
  !id ? "No app" : (apps.find((a) => a.id === id)?.label ?? id);

/** Which field a picked mark or a drawn area should land in. */
type Slot =
  | { field: "spotlight" }
  | { field: "advance" }
  | { field: "any"; at: number }
  | { field: "callout"; at: number }
  | { field: "action"; at: number };

export function WalkthroughBuilder({ content, setContent, apps = [], projectName, onClose }: {
  content: WalkthroughContent;
  setContent: (u: (prev: WalkthroughContent) => WalkthroughContent) => void;
  /** The shared pool of ingested apps a step can run. The builder only picks
   * from it: the pool is shared by every project, so ingesting, renaming,
   * resizing, hiding and deleting belong to whoever owns it, not to one
   * project's editor. Hidden apps aren't offered, but a step already running
   * one keeps running it and still says so. */
  apps?: IngestedApp[];
  projectName?: string;
  /** Adds a "Done" button to the toolbar (e.g. back to a project list). */
  onClose?: () => void;
}) {
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showThumb, setShowThumb] = useState(false);
  const [picking, setPicking] = useState<Slot | null>(null);
  const [drawing, setDrawing] = useState<Slot | null>(null);
  const [hover, setHover] = useState<PickHit | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const steps = content.steps;
  const index = Math.min(selected, Math.max(0, steps.length - 1));
  const step = steps[index];

  const markIds = useMemo(() => stepMarks(step), [step]);
  const spotMarks = useMemo(() => marksOf(step?.spotlight?.mark), [step]);
  // The app the selected step runs, and what it displays over it.
  const app = useMemo(() => apps.find((a) => a.id === step?.app), [apps, step?.app]);
  // What the picker offers: the pool minus the hidden ones, plus whichever app
  // this step already runs. Hiding retires an app from new use without
  // rewriting the steps that found it first.
  const offered = useMemo(() => apps.filter((a) => !a.hidden || a.id === step?.app), [apps, step?.app]);
  const shown = contentOf(step);
  const demo = useApp(app?.src, markIds, app);
  const { driver } = demo;
  const runs = useMemo(() => appRuns(steps), [steps]);
  const runStarts = useMemo(() => new Map(runs.map((r) => [r.from, r])), [runs]);
  const boots = bootsApp(steps, index);

  // What is on screen decides what can be pointed at, and there are three
  // answers rather than two. A running app can be read into, so a mark follows
  // its element as the app reflows. An embed or an image can't be read but can
  // still be pointed at, by a rectangle drawn over the stage. A slide covers
  // the stage outright and carries its own copy, so nothing is drawn over it
  // and the panel has nothing to say — the inspector drops those fields rather
  // than offering controls whose effect the reader would never see.
  const driveable = demo.live && !!driver && shown.kind === "app";
  const framed = shown.kind === "embed" || shown.kind === "image";
  const isSlide = shown.kind === "slide";

  const update = (patch: Partial<WalkthroughStep>) =>
    setContent((prev) => ({ ...prev, steps: prev.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)) }));

  // ── The pool ──
  // Ingesting and renaming reach the filesystem, so they are the host's to do;
  // the panel only collects what they need and reports what went wrong.

  // ── Steps ──
  const patchCallout = (at: number, patch: Partial<Callout>) =>
    update({ callouts: (step.callouts ?? []).map((c, i) => (i === at ? { ...c, ...patch } : c)) });

  /** Edit the slide this step displays, if it displays one. */
  const patchSlide = (patch: Partial<Screen>) =>
    update({ content: shown.kind === "slide" ? { kind: "slide", screen: { ...shown.screen, ...patch } } : shown });

  const patchAction = (at: number, action: StepAction) =>
    update({ actions: (step.actions ?? []).map((a, i) => (i === at ? action : a)) });

  const addCallout = () =>
    update({ callouts: [...(step.callouts ?? []), { text: "Describe this element." }] });

  const removeCallout = (at: number) => update({ callouts: (step.callouts ?? []).filter((_, i) => i !== at) });

  const addStep = () => {
    setContent((prev) => {
      const next = [...prev.steps];
      next.splice(index + 1, 0, newStep());
      return { ...prev, steps: next };
    });
    setSelected(index + 1);
  };

  const duplicateStep = () => {
    setContent((prev) => {
      const next = [...prev.steps];
      next.splice(index + 1, 0, { ...prev.steps[index], id: uid() });
      return { ...prev, steps: next };
    });
    setSelected(index + 1);
  };

  const deleteStep = () => {
    if (steps.length <= 1) return;
    setContent((prev) => ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) }));
    setSelected(Math.max(0, index - 1));
  };

  const move = (delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= steps.length) return;
    setContent((prev) => {
      const next = [...prev.steps];
      const [s] = next.splice(index, 1);
      next.splice(to, 0, s);
      return { ...prev, steps: next };
    });
    setSelected(to);
  };

  // A starting screen is a hash route inside the app: "#/orders". An address
  // pasted here still applies — as a hash on the app the step is already
  // running — so nothing throws and the app never changes. Catch the shapes an
  // address takes: a file, a full URL, or a hash that isn't rooted at "/".
  const start = step?.start ?? "";
  const route = start.replace(/^#/, "");
  const misroute = !!start && (!route.startsWith("/") || route.includes(".html") || start.includes("://"));

  // Selecting a step shows it the way a reader arriving at it would: booted at
  // its starting screen, with its actions performed. Editing the step's copy
  // must not reload the app, so this watches the app and the screen only.
  const actionKey = JSON.stringify(step?.actions ?? []);
  useEffect(() => {
    if (!driver || !step) return;
    let live = true;
    const timers: number[] = [];
    void (async () => {
      await driver.open(step.start, { reload: true });
      if (!live) return;
      for (const action of step.actions ?? []) {
        if (!live) return;
        if (action.do === "wait") await new Promise((r) => setTimeout(r, action.ms));
        else if (action.do === "click") driver.click(action.mark);
        else driver.type(action.mark, action.text);
      }
      if (!live) return;
      const first = marksOf(step.spotlight?.mark)[0];
      if (first) driver.reveal(first);
      demo.measure();
      timers.push(window.setTimeout(demo.measure, 160), window.setTimeout(demo.measure, 480));
    })();
    return () => {
      live = false;
      timers.forEach((t) => clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver, index, start, actionKey]);

  const applyMark = (slot: Slot, mark: string) => {
    if (slot.field === "spotlight") {
      update({ spotlight: { ...(step.spotlight ?? {}), mark, area: undefined } });
      return;
    }
    if (slot.field === "callout") {
      update({ callouts: (step.callouts ?? []).map((c, i) => (i === slot.at ? { ...c, mark, area: undefined } : c)) });
      return;
    }
    if (slot.field === "advance") {
      update({ advance: { on: "click", mark } });
      return;
    }
    if (slot.field === "action") {
      const action = step.actions?.[slot.at];
      if (action && action.do !== "wait") patchAction(slot.at, { ...action, mark });
      return;
    }
    const advance = step.advance;
    if (advance.on !== "any") return;
    update({ advance: { ...advance, of: advance.of.map((a, i) => (i === slot.at ? { on: "click", mark } : a)) } });
  };

  const applyArea = (slot: Slot, area: Area) => {
    if (slot.field === "spotlight") update({ spotlight: { ...(step.spotlight ?? {}), area, mark: undefined } });
    if (slot.field === "callout") {
      update({ callouts: (step.callouts ?? []).map((c, i) => (i === slot.at ? { ...c, area, mark: undefined } : c)) });
    }
  };

  // Pick mode: the driver swallows the demo's own interactions and reports
  // what was pointed at instead.
  useEffect(() => {
    if (!driver) return;
    driver.setPicking(!!picking);
    if (!picking) return;
    const offPick = driver.onPick((hit) => {
      if (!hit.mark) {
        setWarning(`That ${hit.label} has no data-walkthrough id. Add one in the app, then pick it again.`);
        return;
      }
      applyMark(picking, hit.mark);
      setWarning(null);
      setPicking(null);
    });
    const offHover = driver.onHover(setHover);
    return () => {
      offPick();
      offHover();
      driver.setPicking(false);
      setHover(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver, picking, step]);

  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPicking(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picking]);

  const box = useMemo(() => {
    const spot = step?.spotlight;
    if (!spot) return null;
    if (spot.area) return areaBox(spot.area, demo.bounds);
    return toBox(spotMarks.map((id) => demo.rects[id]).filter(Boolean), spot.pad ?? 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo.rects, spotMarks.join("|"), demo.bounds, step]);

  const calloutBox = (callout: Callout): Box | null => {
    if (callout.area) return areaBox(callout.area, demo.bounds);
    const rect = callout.mark ? demo.rects[callout.mark] : undefined;
    return rect ? toBox([rect], 0) : null;
  };

  // The pick reports its rect in the app's pixels, which the centering margin
  // moves along before it is a stage pixel, as `useApp` does for the marks.
  const hoverBox = hover && toBox([{ ...hover.rect, x: hover.rect.x + demo.offsetX }], 2);
  const overlaid = !!picking || !!drawing;

  if (playing) {
    return <WalkthroughPlayer content={content} apps={apps} startIndex={index} onExit={() => setPlaying(false)} />;
  }

  if (!step) {
    return (
      <div style={shell}>
        <div style={{ margin: "auto", textAlign: "center", color: "#5a554e" }}>
          <p style={{ marginBottom: 14 }}>This walkthrough has no steps yet.</p>
          <Button variant="primary" icon={<Plus size={16} />} onClick={addStep} style={{ margin: "0 auto" }}>
            Add the first step
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={shell}>
      {/* Toolbar */}
      <div style={toolbar}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600, fontSize: 15 }}>
          <LayoutGrid size={18} style={{ color: ACCENT }} /> Walkthrough Builder
          {projectName && (
            <>
              <span style={{ color: "#cfcbc4", fontWeight: 400 }}>/</span>
              <span style={{ color: "#5a554e", fontWeight: 600 }}>{projectName}</span>
            </>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
          <Button variant="tertiary" icon={<ImageIcon size={16} />} onClick={() => setShowThumb((v) => !v)} title="Projects page preview card">
            Project settings
          </Button>
          <Button variant="primary" icon={<Play size={16} />} onClick={() => setPlaying(true)}>
            Preview
          </Button>
          {onClose && <Button variant="secondary" onClick={onClose}>Done</Button>}
          {showThumb && (
            <PreviewCardSettings
              preview={content.preview ?? {}}
              onChange={(patch) => setContent((prev) => ({ ...prev, preview: { ...prev.preview, ...patch } }))}
              onClose={() => setShowThumb(false)}
            />
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Step rail, banded by the runs that share a stage */}
        <div style={rail}>
          <Reorder.Group
            axis="y"
            values={steps}
            onReorder={(next) => {
              const id = steps[index]?.id;
              setContent((prev) => ({ ...prev, steps: next }));
              const ni = next.findIndex((s) => s.id === id);
              if (ni >= 0) setSelected(ni);
            }}
            style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}
          >
            {steps.map((s, i) => {
              const run = runStarts.get(i);
              const label = stepLabel(s);
              return (
                <Reorder.Item
                  key={s.id}
                  value={s}
                  onClick={() => setSelected(i)}
                  whileDrag={{ scale: 1.04, boxShadow: "0 10px 24px rgba(0,0,0,0.22)", cursor: "grabbing" }}
                  style={{ cursor: "grab" }}
                >
                  {run && (runs.length > 1 || !!run.app) && (
                    <div style={runBand}>
                      <Layers size={11} style={{ flex: "none", opacity: 0.7 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {appName(apps, run.app)}
                      </span>
                      <span style={{ marginLeft: "auto", opacity: 0.6 }}>{run.to - run.from + 1}</span>
                    </div>
                  )}
                  <div
                    style={{
                      position: "relative", textAlign: "left", borderRadius: 8, padding: 10, minHeight: 58,
                      border: i === index ? `2px solid ${ACCENT}` : "1px solid #dcd8d2", background: "#fff", color: "#1a1a1a", overflow: "hidden",
                    }}
                  >
                    <div style={{ fontSize: 10, opacity: 0.5, position: "absolute", top: 6, right: 8 }}>{i + 1}</div>
                    <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: ACCENT, marginBottom: 4 }}>
                      {label.eyebrow}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {label.title || s.id}
                    </div>
                  </div>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
          <Button variant="ghost" size="sm" icon={<Plus size={16} />} onClick={addStep} style={{ ...fill, marginTop: 4 }}>
            Add step
          </Button>
        </div>

        {/* The frame */}
        <div style={{ flex: 1, minWidth: 0, position: "relative", overflow: "hidden", display: "flex", background: demo.live || framed || isSlide ? STAGE_BG : "#e9e7e3" }}>
          {demo.live || framed || isSlide ? (
            <div ref={demo.stageRef} style={{ flex: 1, position: "relative", overflowX: "auto", overflowY: "hidden" }}>
              {/* The app runs underneath whatever the step displays, so an
                  image or a URL hides it without stopping it. */}
              {demo.live && app && <iframe key={app.src} ref={demo.frameRef} title={app.label} style={demo.frameStyle} />}

              {shown.kind === "slide" && (
                <div style={{ position: "absolute", inset: 0, background: "#f4f3f1" }}>
                  {/* No entrance here: the slide is being edited, not arrived at. */}
                  <SlideView
                    screen={shown.screen}
                    reduced
                    logoSrc={content.preview?.logo}
                    onAnnotationMove={(id, x, y) =>
                      patchSlide({ items: (shown.screen.items ?? []).map((it) => (it.id === id ? { ...it, x, y } : it)) })}
                  />
                </div>
              )}
              {shown.kind === "image" && <StageStill image={shown} />}
              {shown.kind === "embed" && (
                <iframe
                  key={shown.url}
                  src={shown.url}
                  title="Embedded page"
                  allowFullScreen
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
                />
              )}

              {!overlaid && <Spotlight box={box} shape={step.spotlight?.shape} dim={step.spotlight?.dim} lock={false} stageW={demo.contentW} />}
              {!overlaid && step.callouts?.length ? <Callouts items={step.callouts} boxFor={calloutBox} bounds={demo.bounds} /> : null}
              {picking && <HoverOutline box={hoverBox} ok={!!hover?.mark} />}
              {drawing && (
                <AreaDraw
                  bounds={demo.bounds}
                  onDone={(area) => {
                    applyArea(drawing, area);
                    setDrawing(null);
                  }}
                  onCancel={() => setDrawing(null)}
                />
              )}
              {(picking || drawing) && (
                <div style={pickBanner}>
                  {picking ? <Crosshair size={15} /> : <Square size={15} />}
                  {picking ? "Click the element to mark" : "Drag the area to point at"}
                  <button onClick={() => (picking ? setPicking(null) : setDrawing(null))} style={pickCancel} title="Cancel (Esc)">
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <StageNotice blocked={demo.blocked!} src={app?.src} />
          )}
        </div>

        {/* Inspector */}
        <div style={inspector}>
          <Field label="App" collapsible>
            <select
              value={step.app ?? ""}
              onChange={(e) => update({ app: e.target.value || undefined })}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="">None — no app running</option>
              {offered.map((a) => (
                <option key={a.id} value={a.id}>{a.label}{a.hidden ? " (hidden)" : ""}</option>
              ))}
            </select>
            {!apps.length && (
              <p style={hint}>
                No apps in the pool yet — ingest one on the Apps screen and every project can run it.
              </p>
            )}
            {!!step.app && (
              <p style={hint}>
                {boots
                  ? `Boots ${appName(apps, step.app)}. The steps after it keep it running, so whatever the reader does carries forward.`
                  : `${appName(apps, step.app)} is already running from the step before, and keeps whatever the reader did.`}
              </p>
            )}
            {!step.app && <p style={hint}>Nothing runs behind this step. It can still display a URL or an image.</p>}

            {/* Only the step that boots the app decides where it opens. On the
                rest it is already open and the reader may have moved around in
                it; sending them back would undo their work. */}
            {boots && (
              <>
                <label style={{ ...hint, display: "block", marginTop: 12 }}>Starting screen</label>
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <input
                    value={step.start ?? ""}
                    onChange={(e) => update({ start: e.target.value || undefined })}
                    placeholder="#/orders"
                    style={inputStyle}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => driver && update({ start: driver.currentPath() || undefined })}
                    disabled={!driver}
                    style={nowrap}
                    title="Use the screen the app is showing"
                  >
                    Use current
                  </Button>
                </div>
                {misroute && (
                  <div style={warn}>
                    <span>
                      That isn't a screen — it's an address. A screen is a route <strong>inside</strong> {appName(apps, step.app)},
                      like <code>#/orders</code>. To show something else, change the app above or this step's Display.
                    </span>
                  </div>
                )}
                <p style={hint}>Where the app opens. Navigate it on the left and press Use current rather than typing one.</p>
              </>
            )}
          </Field>

          <Field label="Display" collapsible>
            <SegmentedControl size="md" aria-label="What this step displays" style={track}>
              {CONTENT_KINDS.map((k) => (
                <Segment
                  key={k.value}
                  selected={shown.kind === k.value}
                  onClick={() =>
                    update({
                      content: k.value === "app" ? undefined : blankContent(k.value, shown),
                      // Nothing can be seen through a URL or an image, so a
                      // step showing one can only be left by its button.
                      advance: k.value === "app" || step.advance.on === "manual" ? step.advance : { on: "manual" },
                    })
                  }
                >
                  {k.label}
                </Segment>
              ))}
            </SegmentedControl>
            <p style={hint}>{CONTENT_KINDS.find((k) => k.value === shown.kind)?.hint}</p>

            {shown.kind === "embed" && (
              <>
                <input
                  value={shown.url}
                  onChange={(e) => update({ content: { ...shown, url: e.target.value } })}
                  placeholder="https://embed.figma.com/…"
                  style={{ ...inputStyle, marginTop: 8 }}
                />
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <label style={{ ...hint, flex: 1 }}>
                    Width
                    <input
                      type="number"
                      value={shown.width ?? ""}
                      onChange={(e) => update({ content: { ...shown, width: e.target.value ? Number(e.target.value) : undefined } })}
                      style={inputStyle}
                    />
                  </label>
                  <label style={{ ...hint, flex: 1 }}>
                    Min width
                    <input
                      type="number"
                      value={shown.minWidth ?? ""}
                      onChange={(e) => update({ content: { ...shown, minWidth: e.target.value ? Number(e.target.value) : undefined } })}
                      style={inputStyle}
                    />
                  </label>
                </div>
              </>
            )}

            {shown.kind === "slide" && (
              <div style={{ marginTop: 12 }}>
                <SlideFields screen={shown.screen} update={patchSlide} logoSrc={content.preview?.logo} />
              </div>
            )}

            {shown.kind === "image" && (
              <>
                <div style={{ marginTop: 10 }}>
                  <ImageField value={shown.src} onChange={(v) => update({ content: { ...shown, src: v } })} label="Image" />
                </div>
                <SegmentedControl size="md" aria-label="How the image fits" style={{ ...track, marginTop: 8 }}>
                  {(["center", "fill"] as const).map((fit) => (
                    <Segment key={fit} selected={(shown.fit ?? "center") === fit} onClick={() => update({ content: { ...shown, fit } })}>
                      {fit === "center" ? "Centered" : "Fill"}
                    </Segment>
                  ))}
                </SegmentedControl>
              </>
            )}
          </Field>

          <Field label="Does" collapsible>
            {(step.actions ?? []).map((action, at) => (
              <div key={at} style={{ border: "1px solid #e3e0db", borderRadius: 8, padding: 10, marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <SegmentedControl size="md" aria-label="What this does" style={track}>
                    {(["click", "type", "wait"] as const).map((kind) => (
                      <Segment key={kind} selected={action.do === kind} onClick={() => patchAction(at, blankAction(kind, action))}>
                        {kind}
                      </Segment>
                    ))}
                  </SegmentedControl>
                  <ButtonRound
                    size="sm"
                    variant="tertiary"
                    tone="danger"
                    icon={<X size={13} />}
                    onClick={() => update({ actions: (step.actions ?? []).filter((_, i) => i !== at) })}
                    title="Remove"
                    aria-label="Remove this action"
                    style={{ marginLeft: "auto" }}
                  />
                </div>
                {action.do === "wait" ? (
                  <input
                    type="number"
                    value={action.ms}
                    onChange={(e) => patchAction(at, { do: "wait", ms: Number(e.target.value) || 0 })}
                    placeholder="400"
                    style={{ ...inputStyle, marginTop: 6 }}
                  />
                ) : (
                  <div style={{ marginTop: 6 }}>
                    <Anchor
                      mark={action.mark}
                      byArea={false}
                      onMark={(mark) => patchAction(at, { ...action, mark })}
                      onPick={() => setPicking({ field: "action", at })}
                      onDraw={() => {}}
                      busy={picking?.field === "action" && picking.at === at}
                      disabled={!driveable}
                    />
                    {action.do === "type" && (
                      <input
                        value={action.text}
                        onChange={(e) => patchAction(at, { do: "type", mark: action.mark, text: e.target.value })}
                        placeholder="Simpson"
                        style={{ ...inputStyle, marginTop: 6 }}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              icon={<Plus size={15} />}
              onClick={() => update({ actions: [...(step.actions ?? []), { do: "click", mark: "" }] })}
              disabled={!step.app}
            >
              Add an action
            </Button>
            <p style={hint}>
              {step.app
                ? "Done to the running app as the step opens, in order. A wait is for the gap a click opens — a menu's options don't exist until the menu does."
                : "A step with no app running has nothing to act on."}
            </p>
          </Field>

          <div style={{ display: "flex", gap: 6, margin: "18px 0" }}>
            <ButtonRound variant="tertiary" icon={<ChevronUp size={16} />} onClick={() => move(-1)} disabled={index === 0} title="Move up" aria-label="Move up" />
            <ButtonRound variant="tertiary" icon={<ChevronDown size={16} />} onClick={() => move(1)} disabled={index === steps.length - 1} title="Move down" aria-label="Move down" />
            <ButtonRound variant="tertiary" icon={<Copy size={16} />} onClick={duplicateStep} title="Duplicate" aria-label="Duplicate" />
            <ButtonRound variant="tertiary" tone="danger" icon={<Trash2 size={16} />} onClick={deleteStep} disabled={steps.length <= 1} title="Delete" aria-label="Delete" />
          </div>

          {/* The panel's copy. A slide has none: it covers the panel and
              carries its own, which Display edits a few fields up. Two sets of
              Eyebrow / Title / Body in one inspector, only one of them ever
              read, is the thing worth not having. */}
          {!isSlide && (
            <>
              <Field label="Eyebrow">
                <textarea value={step.eyebrow ?? ""} onChange={(e) => update({ eyebrow: e.target.value })} rows={1} style={{ ...inputStyle, resize: "vertical" }} />
              </Field>

              <Field label="Title">
                <textarea value={step.title ?? ""} onChange={(e) => update({ title: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
              </Field>

              <Field label="Body">
                <textarea value={step.body ?? ""} onChange={(e) => update({ body: e.target.value })} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
              </Field>

              <Field label="Panel image" collapsible>
                <ImageField value={step.imageUrl ?? ""} onChange={(v) => update({ imageUrl: v || undefined })} label="Panel image" />
              </Field>
            </>
          )}

          {/* Everything drawn over the stage, and the rule for leaving the
              step. A slide covers the stage, so a spotlight or a callout
              under it is never seen; and with no panel there is no button to
              label, so a slide is clicked through like a deck. Offering any
              of it here would be offering settings with no effect. */}
          {!isSlide && (
            <>
            <Field label="Spotlight" collapsible>
              {step.spotlight ? (
                <>
                  <Anchor
                    mark={marksOf(step.spotlight.mark).join(", ")}
                    area={step.spotlight.area}
                    byArea={framed}
                    onMark={(v) => {
                      const list = v.split(",").map((m) => m.trim()).filter(Boolean);
                      update({ spotlight: { ...step.spotlight!, mark: list.length === 1 ? list[0] : list } });
                    }}
                    onPick={() => setPicking({ field: "spotlight" })}
                    onDraw={() => setDrawing({ field: "spotlight" })}
                    busy={picking?.field === "spotlight" || drawing?.field === "spotlight"}
                    disabled={!framed && !driveable}
                  />
                  <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
                    <SegmentedControl size="md" aria-label="Spotlight shape" style={track}>
                      {(["rect", "pill"] as const).map((shape) => (
                        <Segment
                          key={shape}
                          selected={(step.spotlight!.shape ?? "rect") === shape}
                          onClick={() => update({ spotlight: { ...step.spotlight!, shape } })}
                        >
                          {shape === "rect" ? "Rounded" : "Pill"}
                        </Segment>
                      ))}
                    </SegmentedControl>
                    {!framed && (
                      <input
                        type="number"
                        value={step.spotlight.pad ?? ""}
                        onChange={(e) => update({ spotlight: { ...step.spotlight!, pad: e.target.value ? Number(e.target.value) : undefined } })}
                        placeholder="Pad"
                        style={{ ...inputStyle, width: 70 }}
                      />
                    )}
                  </div>
                  <label style={{ ...hint, display: "flex", alignItems: "center", gap: 7, marginTop: 10 }}>
                    <input
                      type="checkbox"
                      checked={step.spotlight.dim !== false}
                      onChange={(e) => update({ spotlight: { ...step.spotlight!, dim: e.target.checked ? undefined : false } })}
                    />
                    Dim the rest of the stage
                  </label>
                  <label style={{ ...hint, display: "flex", alignItems: "center", gap: 7, marginTop: 6 }}>
                    <input
                      type="checkbox"
                      checked={!!step.spotlight.lock}
                      onChange={(e) => update({ spotlight: { ...step.spotlight!, lock: e.target.checked || undefined } })}
                    />
                    Block clicks everywhere else
                  </label>
                  <Button variant="ghost" size="sm" tone="danger" onClick={() => update({ spotlight: undefined })} style={{ marginTop: 10 }}>Remove spotlight</Button>
                </>
              ) : (
                <Button variant="ghost" size="sm" icon={<Plus size={15} />} onClick={() => update({ spotlight: {} })}>
                  Add a spotlight
                </Button>
              )}
            </Field>

            <Field label="Callouts" collapsible>
              {(step.callouts ?? []).map((callout, at) => (
                <div key={at} style={{ border: "1px solid #e3e0db", borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <Anchor
                    mark={callout.mark ?? ""}
                    area={callout.area}
                    byArea={framed}
                    onMark={(v) => patchCallout(at, { mark: v })}
                    onPick={() => setPicking({ field: "callout", at })}
                    onDraw={() => setDrawing({ field: "callout", at })}
                    busy={(picking?.field === "callout" && picking.at === at) || (drawing?.field === "callout" && drawing.at === at)}
                    disabled={!framed && !driveable}
                  />
                  <textarea
                    value={callout.text}
                    onChange={(e) => patchCallout(at, { text: e.target.value })}
                    rows={2}
                    placeholder="What this element is for"
                    style={{ ...inputStyle, resize: "vertical", marginTop: 6 }}
                  />
                  <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                    <SegmentedControl size="md" aria-label="Which side the callout sits on" style={track}>
                      {(["auto", "top", "right", "bottom", "left"] as const).map((side) => (
                        <Segment
                          key={side}
                          selected={(callout.placement ?? "auto") === side}
                          onClick={() => patchCallout(at, { placement: side === "auto" ? undefined : side })}
                        >
                          {side}
                        </Segment>
                      ))}
                    </SegmentedControl>
                    <ButtonRound
                      size="sm"
                      variant="tertiary"
                      tone="danger"
                      icon={<X size={13} />}
                      onClick={() => removeCallout(at)}
                      title="Remove"
                      aria-label="Remove callout"
                      style={{ marginLeft: "auto" }}
                    />
                  </div>
                </div>
              ))}
              <Button variant="ghost" size="sm" icon={<Plus size={15} />} onClick={addCallout}>
                Add a callout
              </Button>
              <p style={hint}>
                {framed
                  ? "Anchored to an area of the stage, which an embed or a mock-up can't move out from under them."
                  : "Anchored to a mark, so they follow the element as the app reflows."}
              </p>
            </Field>

            <Field label="Advances on" collapsible>
              <SegmentedControl size="md" aria-label="What advances this step" style={track}>
                {ADVANCE_KINDS.filter((k) => !framed || k.value === "manual").map((k) => (
                  <Segment key={k.value} selected={step.advance.on === k.value} onClick={() => update({ advance: blankAdvance(k.value, step.advance) })}>
                    {k.label}
                  </Segment>
                ))}
              </SegmentedControl>
              <p style={hint}>
                {framed
                  ? "Nothing can be observed inside an embed or a mock-up, so a step on one is left with the panel's button."
                  : ADVANCE_KINDS.find((k) => k.value === step.advance.on)?.hint}
              </p>

              {step.advance.on === "manual" && (
                <input
                  value={step.advance.label ?? ""}
                  onChange={(e) => update({ advance: { on: "manual", label: e.target.value || undefined } })}
                  placeholder="Button label (Next)"
                  style={inputStyle}
                />
              )}

              {framed && step.advance.on !== "manual" && (
                <div style={warn}>
                  This step waits for something inside the stage, which can't be seen from here. The player will show its button instead.
                </div>
              )}

              {!framed && (step.advance.on === "click" || step.advance.on === "path" || step.advance.on === "signal") && (
                <SimpleAdvance
                  advance={step.advance}
                  onChange={(a) => update({ advance: a })}
                  onPick={() => setPicking({ field: "advance" })}
                  picking={picking?.field === "advance"}
                  canPick={driveable}
                  currentPath={driver?.currentPath()}
                />
              )}

              {!framed && step.advance.on === "any" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {step.advance.of.map((a, at) => (
                    <div key={at} style={{ border: "1px solid #e3e0db", borderRadius: 8, padding: 10 }}>
                      <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
                        <SegmentedControl size="md" aria-label="What this way waits for" style={track}>
                          {(["click", "path", "signal"] as const).map((on) => (
                            <Segment
                              key={on}
                              selected={a.on === on}
                              onClick={() => updateAny(step.advance as Extract<StepAdvance, { on: "any" }>, at, blankAdvance(on, a), update)}
                            >
                              {on}
                            </Segment>
                          ))}
                        </SegmentedControl>
                        <ButtonRound
                          size="sm"
                          variant="tertiary"
                          tone="danger"
                          icon={<X size={13} />}
                          onClick={() => {
                            const any = step.advance as Extract<StepAdvance, { on: "any" }>;
                            update({ advance: { ...any, of: any.of.filter((_, i) => i !== at) } });
                          }}
                          title="Remove"
                          aria-label="Remove this way"
                          style={{ marginLeft: "auto" }}
                        />
                      </div>
                      <SimpleAdvance
                        advance={a}
                        onChange={(next) => updateAny(step.advance as Extract<StepAdvance, { on: "any" }>, at, next, update)}
                        onPick={() => setPicking({ field: "any", at })}
                        picking={picking?.field === "any" && picking.at === at}
                        canPick={driveable}
                        currentPath={driver?.currentPath()}
                      />
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Plus size={15} />}
                    onClick={() => {
                      const any = step.advance as Extract<StepAdvance, { on: "any" }>;
                      update({ advance: { ...any, of: [...any.of, { on: "click", mark: "" }] } });
                    }}
                    style={undefined}
                  >
                    Add a way
                  </Button>
                </div>
              )}
            </Field>
            </>
          )}

          {warning && (
            <div style={warn}>
              {warning}
              <ButtonRound size="sm" variant="tertiary" icon={<X size={13} />} onClick={() => setWarning(null)} aria-label="Dismiss" style={{ flex: "none" }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** A fresh content of the given kind, keeping anything the old one can lend. */
function blankContent(kind: StepContent["kind"], from: StepContent): StepContent {
  if (kind === "app") return { kind: "app" };
  if (kind === "embed") return { kind: "embed", url: from.kind === "embed" ? from.url : "" };
  if (kind === "slide") return { kind: "slide", screen: from.kind === "slide" ? from.screen : newScreen() };
  return { kind: "image", src: from.kind === "image" ? from.src : "", fit: from.kind === "image" ? from.fit : undefined };
}

/** A fresh action of the given kind, keeping the mark the old one was on. */
function blankAction(kind: StepAction["do"], from: StepAction): StepAction {
  const mark = from.do === "wait" ? "" : from.mark;
  if (kind === "wait") return { do: "wait", ms: 400 };
  if (kind === "click") return { do: "click", mark };
  return { do: "type", mark, text: from.do === "type" ? from.text : "" };
}

/** Where a spotlight or a callout points: a mark on a driveable stage, an area
 * on one that can only be shown. The same field, because it is the same idea —
 * only the way of naming the spot differs. */
function Anchor({ mark, area, byArea, onMark, onPick, onDraw, busy, disabled }: {
  mark: string;
  area?: Area;
  /** Point at a rectangle on the stage rather than at a mark in a live app. */
  byArea: boolean;
  onMark: (v: string) => void;
  onPick: () => void;
  onDraw: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  if (byArea) {
    const at = area ? `${Math.round(area.x * 100)}%, ${Math.round(area.y * 100)}% · ${Math.round(area.w * 100)}×${Math.round(area.h * 100)}` : "Nothing yet";
    return (
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ ...inputStyle, display: "flex", alignItems: "center", color: area ? "#1a1a1a" : "#8a857d", fontSize: 12 }}>{at}</span>
        <Button
          size="sm"
          variant={busy ? "primary" : "ghost"}
          icon={<Square size={14} />}
          onClick={onDraw}
          disabled={disabled}
          title={disabled ? "Needs the stage" : "Drag the area on the stage"}
          style={nowrap}
        >
          Draw
        </Button>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <input value={mark} onChange={(e) => onMark(e.target.value)} placeholder="data-walkthrough id" style={inputStyle} />
      <Button
        size="sm"
        variant={busy ? "primary" : "ghost"}
        icon={<Crosshair size={14} />}
        onClick={onPick}
        disabled={disabled}
        title={disabled ? "Needs a code stage" : "Pick it by clicking the app"}
        style={nowrap}
      >
        Pick
      </Button>
    </div>
  );
}

/** Replace one branch of an "any" advance. */
function updateAny(
  any: Extract<StepAdvance, { on: "any" }>,
  at: number,
  next: StepAdvance,
  update: (patch: Partial<WalkthroughStep>) => void,
) {
  update({ advance: { ...any, of: any.of.map((a, i) => (i === at ? next : a)) } });
}

/** A fresh advance of the given kind, keeping anything the old one can lend. */
function blankAdvance(on: StepAdvance["on"], from?: StepAdvance): StepAdvance {
  const mark = from && "mark" in from ? from.mark : "";
  switch (on) {
    case "manual":
      return { on: "manual" };
    case "click":
      return { on: "click", mark };
    case "path":
      return { on: "path", path: "" };
    case "signal":
      return { on: "signal", name: "" };
    case "any":
      return { on: "any", of: [from && from.on !== "any" && from.on !== "manual" ? from : { on: "click", mark }] };
  }
}

function SimpleAdvance({ advance, onChange, onPick, picking, canPick, currentPath }: {
  advance: StepAdvance;
  onChange: (a: StepAdvance) => void;
  onPick: () => void;
  picking: boolean;
  canPick: boolean;
  currentPath?: string;
}) {
  if (advance.on === "click") {
    return (
      <Anchor
        mark={advance.mark}
        byArea={false}
        onMark={(mark) => onChange({ on: "click", mark })}
        onPick={onPick}
        onDraw={() => {}}
        busy={picking}
        disabled={!canPick}
      />
    );
  }
  if (advance.on === "path") {
    return (
      <div style={{ display: "flex", gap: 6 }}>
        <input value={advance.path} onChange={(e) => onChange({ on: "path", path: e.target.value })} placeholder="#/settings" style={inputStyle} />
        <Button variant="ghost" size="sm" onClick={() => currentPath && onChange({ on: "path", path: currentPath })} disabled={!currentPath} style={nowrap}>
          Use current
        </Button>
      </div>
    );
  }
  if (advance.on === "signal") {
    return <input value={advance.name} onChange={(e) => onChange({ on: "signal", name: e.target.value })} placeholder="settings-saved" style={inputStyle} />;
  }
  return null;
}

const shell: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 55, background: "#e9e7e3", color: "#1a1a1a", display: "flex", flexDirection: "column",
};

const toolbar: React.CSSProperties = {
  height: 60, flexShrink: 0, background: "#fff", borderBottom: "1px solid #e3e0db",
  display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px",
};

const rail: React.CSSProperties = {
  width: 184, flexShrink: 0, background: "#f3f1ed", borderRight: "1px solid #e3e0db",
  overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8,
};

const inspector: React.CSSProperties = {
  width: 360, flexShrink: 0, background: "#fff", borderLeft: "1px solid #e3e0db", overflowY: "auto", padding: 18, paddingBottom: 104,
};

/** A segmented control holds as many options as the walkthrough has, and a
 * walkthrough that crosses four apps has a row the panel can't fit. Scrolling
 * the track keeps that row inside the inspector instead of pushing the whole
 * panel sideways; the thumb is positioned within the track, so it travels with
 * it. */
const track: React.CSSProperties = { maxWidth: "100%", overflowX: "auto" };

/** The band that opens each run of steps sharing a stage. Derived from the
 * steps, so dragging one into another run simply moves the band. */
const runBand: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 5, margin: "2px 0 6px",
  fontSize: 9.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#8a857d",
};

const hint: React.CSSProperties = { fontSize: 11, color: "#8a857d", margin: "7px 0 0", lineHeight: 1.5 };

const warn: React.CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, lineHeight: 1.5,
  background: "#fff8e6", border: "1px solid #f0dca8", color: "#6b5516", borderRadius: 8, padding: 10, marginTop: 8,
};

const pickBanner: React.CSSProperties = {
  position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
  display: "flex", alignItems: "center", gap: 8, background: "#fff", border: `1px solid ${ACCENT}`,
  borderRadius: 999, padding: "7px 8px 7px 14px", fontSize: 13, fontWeight: 600, color: "#1a1a1a",
  boxShadow: "0 8px 24px rgba(0,0,0,0.25)", zIndex: 5,
};

const pickCancel: React.CSSProperties = {
  width: 24, height: 24, borderRadius: "50%", border: "none", background: "#f0eeea",
  color: "#5a554e", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
};

/** A button that spans the list it ends, and one that must not wrap beside a
 * field. Everything else about these comes from the variant. */
const fill: React.CSSProperties = { width: "100%", justifyContent: "center" };
const nowrap: React.CSSProperties = { whiteSpace: "nowrap", flex: "none" };
