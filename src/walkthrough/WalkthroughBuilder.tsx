// ─── The walkthrough builder (edit mode) ───────────────────────────
// Same shape as the case-study builder — rail, canvas, inspector — but the
// canvas is the stage rather than a screen, so what you author is what plays.
// Selecting a step puts its stage into the state that step describes.
//
// Stages are edited in one place, from the toolbar, because a stage belongs to
// the walkthrough and not to the step you happen to have selected: several
// steps run in one, and an address typed into a step's inspector would quietly
// move all of them. A step only ever picks which stage it runs in.
//
// On a driveable stage, marks are picked by clicking the product: it is
// same-origin, so the builder can read what was clicked and say when an
// element has no data-walkthrough id to point at yet. On an opaque one there
// is nothing to read, so the author drags the rectangle instead.

import { useEffect, useMemo, useState } from "react";
import { Reorder } from "motion/react";
import { ChevronDown, ChevronUp, Copy, Crosshair, Image as ImageIcon, LayoutGrid, Layers, Play, Plus, Square, Trash2, X } from "lucide-react";
import { ACCENT } from "../core.js";
import { Field, ImageField, PreviewCardSettings, inputStyle } from "../editors.js";
import { Button, ButtonRound, Segment, SegmentedControl } from "@tomcoggia/ui";
import { WalkthroughPlayer, marksOf } from "./WalkthroughPlayer.js";
import { AreaDraw, Callouts, HoverOutline, Spotlight, StageNotice, StageStill, areaBox, toBox, useStage } from "./stage.js";
import type { Box } from "./stage.js";
import type { PickHit } from "./driver.js";
import { isDriveable, stageAt, stageIdAt, stageRuns, stepMarks } from "./types.js";
import type { Area, Callout, Stage, StageKind, StepAdvance, WalkthroughContent, WalkthroughStep } from "./types.js";

const ADVANCE_KINDS: { value: StepAdvance["on"]; label: string; hint: string }[] = [
  { value: "manual", label: "A button", hint: "The reader presses Next in the panel." },
  { value: "click", label: "A click", hint: "The reader clicks a marked element in the app." },
  { value: "path", label: "A route", hint: "The app navigates to a hash route." },
  { value: "signal", label: "A signal", hint: "The app fires wt:signal with this name." },
  { value: "any", label: "Any of…", hint: "Whichever of these happens first." },
];

const STAGE_KINDS: { value: StageKind; label: string; hint: string }[] = [
  { value: "code", label: "Code", hint: "An app you built, served from this site. The reader uses it, and steps can watch what they do." },
  { value: "embed", label: "Embed", hint: "Any other URL in a frame — a Figma prototype, a live site. The reader can click inside it; we can't see them do it." },
  { value: "mock", label: "Mock-up", hint: "A still image, for an app that doesn't exist yet." },
];

const uid = () => `step-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;

const newStep = (): WalkthroughStep => ({
  id: uid(),
  eyebrow: "Step",
  title: "New step",
  body: "What should the reader do here?",
  advance: { on: "manual" },
});

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Stage ids are slugs of the name they were created with, and never change —
 * steps point at them, so a rename would have to chase every step that does. */
function newStageId(stages: Stage[], from: string): string {
  const base = slug(from) || "stage";
  let id = base;
  for (let n = 2; stages.some((s) => s.id === id); n++) id = `${base}-${n}`;
  return id;
}

const stageName = (stage?: Stage | null, fallback?: string | null) => stage?.label || stage?.id || fallback || "No stage";

/** Which field a picked mark or a drawn area should land in. */
type Slot = { field: "spotlight" } | { field: "advance" } | { field: "any"; at: number } | { field: "callout"; at: number };

export function WalkthroughBuilder({ content, setContent, projectName, onClose }: {
  content: WalkthroughContent;
  setContent: (u: (prev: WalkthroughContent) => WalkthroughContent) => void;
  projectName?: string;
  /** Adds a "Done" button to the toolbar (e.g. back to a project list). */
  onClose?: () => void;
}) {
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showThumb, setShowThumb] = useState(false);
  const [showStages, setShowStages] = useState(false);
  const [picking, setPicking] = useState<Slot | null>(null);
  const [drawing, setDrawing] = useState<Slot | null>(null);
  const [hover, setHover] = useState<PickHit | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const steps = content.steps;
  const index = Math.min(selected, Math.max(0, steps.length - 1));
  const step = steps[index];

  const markIds = useMemo(() => stepMarks(step), [step]);
  const spotMarks = useMemo(() => marksOf(step?.spotlight?.mark), [step]);
  // The stage the selected step runs in, which is what the canvas shows.
  const stageId = stageIdAt(content, index);
  const stage = useMemo(() => stageAt(content, index), [content, index]);
  const demo = useStage(stage, markIds);
  const { driver } = demo;
  const runs = useMemo(() => stageRuns(content), [content]);
  const runStarts = useMemo(() => new Map(runs.map((r) => [r.from, r])), [runs]);

  // What this stage lets a step do. Opaque stages can't be read into, so they
  // anchor by rectangle and the reader leaves them with the panel's button.
  const driveable = demo.driveable && !!driver;
  const opaque = !!stage && !isDriveable(stage);

  const update = (patch: Partial<WalkthroughStep>) =>
    setContent((prev) => ({ ...prev, steps: prev.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)) }));

  // ── Stages ──
  const patchStage = (id: string, patch: Partial<Stage>) =>
    setContent((prev) => ({ ...prev, stages: prev.stages.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const addStage = () =>
    setContent((prev) => {
      const name = `Stage ${prev.stages.length + 1}`;
      const stage: Stage = { id: newStageId(prev.stages, name), label: name, kind: "code", src: "", width: 1280, minWidth: 900 };
      return { ...prev, stages: [...prev.stages, stage] };
    });

  /** Removing a stage frees the steps that named it rather than deleting them:
   * they fall back to carrying on, and the rail shows where they landed. */
  const removeStage = (id: string) =>
    setContent((prev) => ({
      ...prev,
      stages: prev.stages.filter((s) => s.id !== id),
      steps: prev.steps.map((s) => (s.enter?.stage === id ? { ...s, enter: clean({ ...s.enter, stage: undefined }) } : s)),
    }));

  const moveStage = (id: string, delta: number) =>
    setContent((prev) => {
      const at = prev.stages.findIndex((s) => s.id === id);
      const to = at + delta;
      if (at < 0 || to < 0 || to >= prev.stages.length) return prev;
      const next = [...prev.stages];
      const [s] = next.splice(at, 1);
      next.splice(to, 0, s);
      return { ...prev, stages: next };
    });

  // ── Steps ──
  const patchCallout = (at: number, patch: Partial<Callout>) =>
    update({ callouts: (step.callouts ?? []).map((c, i) => (i === at ? { ...c, ...patch } : c)) });

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

  // Selecting a step shows its state, the same way the reader would arrive at
  // it out of order. Editing the step's copy must not reload the demo, so this
  // watches the stage and the seed only.
  const enterPath = step?.enter?.path ?? "";
  const enterState = step?.enter?.state ?? "";
  // A route is a hash route inside the stage: "#/orders". An address pasted
  // here still applies — as a hash on the stage the step is already on — so
  // nothing throws and the stage never changes. Catch the shapes an address
  // takes: a file, a full URL, or a hash that isn't rooted at "/".
  const route = enterPath.replace(/^#/, "");
  const misroute = !!enterPath && (!route.startsWith("/") || route.includes(".html") || enterPath.includes("://"));

  useEffect(() => {
    if (!driver || !step) return;
    let live = true;
    const timers: number[] = [];
    void (async () => {
      await driver.enter(step, { reseed: true });
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
  }, [driver, index, stageId, enterPath, enterState]);

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
    return toBox(spotMarks.map((id) => demo.rects[id]).filter(Boolean), demo.scale, spot.pad ?? 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo.rects, spotMarks.join("|"), demo.scale, demo.bounds, step]);

  const calloutBox = (callout: Callout): Box | null => {
    if (callout.area) return areaBox(callout.area, demo.bounds);
    const rect = callout.mark ? demo.rects[callout.mark] : undefined;
    return rect ? toBox([rect], demo.scale, 0) : null;
  };

  const hoverBox = hover && toBox([hover.rect], demo.scale, 2);
  const still = step?.still;
  const overlaid = !!picking || !!drawing || !!still;

  if (playing) {
    return <WalkthroughPlayer content={content} startIndex={index} onExit={() => setPlaying(false)} />;
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

  const activeStage = step.enter?.stage ?? (index === 0 ? content.stages[0]?.id : undefined);

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
          <Button variant="tertiary" icon={<Layers size={16} />} onClick={() => setShowStages((v) => !v)} title="The apps, embeds and mock-ups this walkthrough shows">
            Stages <span style={{ opacity: 0.6, fontWeight: 400 }}>{content.stages.length}</span>
          </Button>
          <Button variant="tertiary" icon={<ImageIcon size={16} />} onClick={() => setShowThumb((v) => !v)} title="Projects page preview card">
            Project settings
          </Button>
          <Button variant="primary" icon={<Play size={16} />} onClick={() => setPlaying(true)}>
            Preview
          </Button>
          {onClose && <Button variant="secondary" onClick={onClose}>Done</Button>}
          {showStages && (
            <StagesPanel
              content={content}
              onPatch={patchStage}
              onAdd={addStage}
              onRemove={removeStage}
              onMove={moveStage}
              onClose={() => setShowStages(false)}
            />
          )}
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
              return (
                <Reorder.Item
                  key={s.id}
                  value={s}
                  onClick={() => setSelected(i)}
                  whileDrag={{ scale: 1.04, boxShadow: "0 10px 24px rgba(0,0,0,0.22)", cursor: "grabbing" }}
                  style={{ cursor: "grab" }}
                >
                  {run && (
                    <div style={runBand}>
                      <Layers size={11} style={{ flex: "none", opacity: 0.7 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {stageName(run.stage, run.stageId)}
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
                    <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: ACCENT, marginBottom: 4 }}>{s.eyebrow}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {s.title || s.id}
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

        {/* The stage */}
        <div style={{ flex: 1, minWidth: 0, position: "relative", overflow: "hidden", display: "flex", background: demo.mode === "blocked" ? "#e9e7e3" : "#0f1115" }}>
          {demo.mode !== "blocked" && stage ? (
            <div ref={demo.stageRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
              {demo.mode === "mock" ? (
                <StageStill image={{ src: stage.src, fit: stage.fit }} />
              ) : (
                <iframe
                  key={stage.id}
                  ref={demo.frameRef}
                  title={stageName(stage)}
                  src={demo.mode === "embed" ? stage.src : undefined}
                  allowFullScreen
                  style={demo.frameStyle}
                />
              )}
              {still && <StageStill image={still} />}
              {!overlaid && <Spotlight box={box} shape={step.spotlight?.shape} dim={step.spotlight?.dim} lock={false} />}
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
                  <button
                    onClick={() => (picking ? setPicking(null) : setDrawing(null))}
                    style={pickCancel}
                    title="Cancel (Esc)"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          ) : still ? (
            <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
              <StageStill image={still} />
            </div>
          ) : (
            <StageNotice blocked={demo.blocked!} src={stage?.src ?? ""} stageId={stageId} />
          )}
        </div>

        {/* Inspector */}
        <div style={inspector}>
          <Field label="Runs in" collapsible>
            <SegmentedControl size="md" aria-label="The stage this step runs in" style={track}>
              {index > 0 && (
                <Segment selected={!step.enter?.stage} onClick={() => update({ enter: clean({ ...step.enter, stage: undefined }) })}>
                  Carry on
                </Segment>
              )}
              {content.stages.map((s) => (
                <Segment key={s.id} selected={activeStage === s.id} onClick={() => update({ enter: { ...step.enter, stage: s.id } })}>
                  {stageName(s)}
                </Segment>
              ))}
            </SegmentedControl>
            {!content.stages.length && (
              <p style={hint}>
                No stages yet — <button onClick={() => setShowStages(true)} style={linkBtn}>add one</button> and this step will have
                somewhere to run.
              </p>
            )}
            {!!content.stages.length && (
              <p style={hint}>
                {step.enter?.stage
                  ? `Starts a run here. The steps after it stay in ${stageName(stage, stageId)} until one names another stage.`
                  : index === 0
                    ? `Opens in ${stageName(stage, stageId)}, the first stage.`
                    : `Carries on in ${stageName(stage, stageId)}, from the steps before it.`}
              </p>
            )}

            {driveable && (
              <>
                <label style={{ ...hint, display: "block", marginTop: 12 }}>Route, inside this stage</label>
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <input
                    value={step.enter?.path ?? ""}
                    onChange={(e) => update({ enter: clean({ ...step.enter, path: e.target.value || undefined }) })}
                    placeholder="#/settings"
                    style={inputStyle}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => driver && update({ enter: clean({ ...step.enter, path: driver.currentPath() || undefined }) })}
                    disabled={!driver}
                    style={nowrap}
                    title="Use the route the app is showing"
                  >
                    Use current
                  </Button>
                </div>
                {/* A path that isn't a hash route is almost always an address
                    typed into the wrong field: it gets applied as a hash on the
                    stage the step is already on, so the stage never changes and
                    nothing looks broken. Say so rather than letting it pass. */}
                {misroute && (
                  <div style={warn}>
                    <span>
                      That isn't a route — it's an address. A route moves around <strong>inside</strong> {stageName(stage, stageId)},
                      like <code>#/orders</code>. To show a different app, add it under <strong>Stages</strong> and pick it above.
                    </span>
                  </div>
                )}
                <label style={{ ...hint, display: "block", marginTop: 10 }}>Seed, sent as ?wt=</label>
                <input
                  value={step.enter?.state ?? ""}
                  onChange={(e) => update({ enter: clean({ ...step.enter, state: e.target.value || undefined }) })}
                  placeholder="fresh"
                  style={{ ...inputStyle, marginTop: 4 }}
                />
                <p style={hint}>
                  Applied whenever the document is made — a jump, or arriving in a stage that isn't on screen. Walking forward inside
                  one keeps what the reader did.
                </p>
              </>
            )}
            {opaque && <p style={hint}>An embed or a mock-up can't be routed or seeded from here.</p>}
          </Field>

          <Field label="Display" collapsible>
            <SegmentedControl size="md" aria-label="What this frame displays" style={track}>
              <Segment selected={!still} onClick={() => update({ still: undefined })}>
                What's running
              </Segment>
              <Segment
                selected={!!still}
                onClick={() =>
                  // The image takes the stage's clicks, so only the panel's
                  // button can move the reader on from it.
                  update({ still: { src: "", ...step.still }, advance: step.advance.on === "manual" ? step.advance : { on: "manual" } })
                }
              >
                An image
              </Segment>
            </SegmentedControl>
            {still && (
              <>
                <div style={{ marginTop: 10 }}>
                  <ImageField value={still.src} onChange={(v) => update({ still: { ...still, src: v } })} label="Image" />
                </div>
                <SegmentedControl size="md" aria-label="How the cover fits" style={{ ...track, marginTop: 8 }}>
                  {(["center", "fill"] as const).map((fit) => (
                    <Segment key={fit} selected={(still.fit ?? "center") === fit} onClick={() => update({ still: { ...still, fit } })}>
                      {fit === "center" ? "Centered" : "Fill"}
                    </Segment>
                  ))}
                </SegmentedControl>
                <p style={hint}>Drawn over whatever this step is running, which keeps running underneath — so the next step picks up where the reader left off rather than starting again.</p>
              </>
            )}
          </Field>

          <div style={{ display: "flex", gap: 6, margin: "18px 0" }}>
            <ButtonRound variant="tertiary" icon={<ChevronUp size={16} />} onClick={() => move(-1)} disabled={index === 0} title="Move up" aria-label="Move up" />
            <ButtonRound variant="tertiary" icon={<ChevronDown size={16} />} onClick={() => move(1)} disabled={index === steps.length - 1} title="Move down" aria-label="Move down" />
            <ButtonRound variant="tertiary" icon={<Copy size={16} />} onClick={duplicateStep} title="Duplicate" aria-label="Duplicate" />
            <ButtonRound variant="tertiary" tone="danger" icon={<Trash2 size={16} />} onClick={deleteStep} disabled={steps.length <= 1} title="Delete" aria-label="Delete" />
          </div>

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

          <Field label="Spotlight" collapsible>
            {step.spotlight ? (
              <>
                <Anchor
                  mark={marksOf(step.spotlight.mark).join(", ")}
                  area={step.spotlight.area}
                  opaque={opaque}
                  onMark={(v) => {
                    const list = v.split(",").map((m) => m.trim()).filter(Boolean);
                    update({ spotlight: { ...step.spotlight!, mark: list.length === 1 ? list[0] : list } });
                  }}
                  onPick={() => setPicking({ field: "spotlight" })}
                  onDraw={() => setDrawing({ field: "spotlight" })}
                  busy={picking?.field === "spotlight" || drawing?.field === "spotlight"}
                  disabled={demo.mode === "blocked" || !!still || (!opaque && !driveable)}
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
                  {!opaque && (
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
                  opaque={opaque}
                  onMark={(v) => patchCallout(at, { mark: v })}
                  onPick={() => setPicking({ field: "callout", at })}
                  onDraw={() => setDrawing({ field: "callout", at })}
                  busy={(picking?.field === "callout" && picking.at === at) || (drawing?.field === "callout" && drawing.at === at)}
                  disabled={demo.mode === "blocked" || !!still || (!opaque && !driveable)}
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
              {opaque
                ? "Anchored to an area of the stage, which an embed or a mock-up can't move out from under them."
                : "Anchored to a mark, so they follow the element as the app reflows."}
            </p>
          </Field>

          <Field label="Advances on" collapsible>
            <SegmentedControl size="md" aria-label="What advances this step" style={track}>
              {ADVANCE_KINDS.filter((k) => !opaque || k.value === "manual").map((k) => (
                <Segment key={k.value} selected={step.advance.on === k.value} onClick={() => update({ advance: blankAdvance(k.value, step.advance) })}>
                  {k.label}
                </Segment>
              ))}
            </SegmentedControl>
            <p style={hint}>
              {opaque
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

            {opaque && step.advance.on !== "manual" && (
              <div style={warn}>
                This step waits for something inside the stage, which can't be seen from here. The player will show its button instead.
              </div>
            )}

            {!opaque && (step.advance.on === "click" || step.advance.on === "path" || step.advance.on === "signal") && (
              <SimpleAdvance
                advance={step.advance}
                onChange={(a) => update({ advance: a })}
                onPick={() => setPicking({ field: "advance" })}
                picking={picking?.field === "advance"}
                canPick={driveable && !still}
                currentPath={driver?.currentPath()}
              />
            )}

            {!opaque && step.advance.on === "any" && (
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
                      canPick={driveable && !still}
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

/** Drop an `enter` that no longer says anything, so a step that runs wherever
 * it lands doesn't carry an empty object around. */
function clean(enter: { stage?: string; path?: string; state?: string }) {
  return enter.stage || enter.path || enter.state ? enter : undefined;
}

/** Every stage the walkthrough can show, edited in one place. Addresses live
 * here and nowhere else: a step points at a stage, it doesn't own one. */
function StagesPanel({ content, onPatch, onAdd, onRemove, onMove, onClose }: {
  content: WalkthroughContent;
  onPatch: (id: string, patch: Partial<Stage>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onMove: (id: string, delta: number) => void;
  onClose: () => void;
}) {
  const used = (id: string) => content.steps.filter((_, i) => stageIdAt(content, i) === id).length;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
      <div style={stagesPanel}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Stages</div>
        <div style={{ fontSize: 11, color: "#8c8c8c", marginBottom: 14, lineHeight: 1.5 }}>
          What this walkthrough can put on the stage. Steps name one; changing an address here changes it for every step that does.
        </div>

        {content.stages.map((stage, i) => (
          <div key={stage.id} style={{ border: "1px solid #e3e0db", borderRadius: 9, padding: 11, marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                value={stage.label ?? ""}
                onChange={(e) => onPatch(stage.id, { label: e.target.value })}
                placeholder={stage.id}
                style={inputStyle}
              />
              <ButtonRound size="sm" variant="tertiary" icon={<ChevronUp size={13} />} onClick={() => onMove(stage.id, -1)} disabled={i === 0} title="Move up" aria-label="Move up" />
              <ButtonRound
                size="sm"
                variant="tertiary"
                icon={<ChevronDown size={13} />}
                onClick={() => onMove(stage.id, 1)}
                disabled={i === content.stages.length - 1}
                title="Move down"
                aria-label="Move down"
              />
              <ButtonRound size="sm" variant="tertiary" tone="danger" icon={<X size={13} />} onClick={() => onRemove(stage.id)} title="Remove this stage" aria-label="Remove this stage" />
            </div>

            <SegmentedControl size="md" aria-label="What this stage is" style={{ ...track, marginTop: 8 }}>
              {STAGE_KINDS.map((k) => (
                <Segment key={k.value} selected={stage.kind === k.value} onClick={() => onPatch(stage.id, { kind: k.value })}>
                  {k.label}
                </Segment>
              ))}
            </SegmentedControl>
            <p style={hint}>{STAGE_KINDS.find((k) => k.value === stage.kind)?.hint}</p>

            {stage.kind === "mock" ? (
              <>
                <div style={{ marginTop: 8 }}>
                  <ImageField value={stage.src} onChange={(v) => onPatch(stage.id, { src: v })} label="Mock-up image" />
                </div>
                <SegmentedControl size="md" aria-label="How the mock-up fits" style={{ ...track, marginTop: 8 }}>
                  {(["center", "fill"] as const).map((fit) => (
                    <Segment key={fit} selected={(stage.fit ?? "center") === fit} onClick={() => onPatch(stage.id, { fit })}>
                      {fit === "center" ? "Centered" : "Fill"}
                    </Segment>
                  ))}
                </SegmentedControl>
              </>
            ) : (
              <>
                <input
                  value={stage.src}
                  onChange={(e) => onPatch(stage.id, { src: e.target.value })}
                  placeholder={stage.kind === "code" ? "/projects/<id>/demo/<app>/index.html" : "https://embed.figma.com/…"}
                  style={{ ...inputStyle, marginTop: 8 }}
                />
                <p style={hint}>
                  {stage.kind === "code"
                    ? "An app you built, served from this site so the walkthrough can drive it. Its build goes in the project's own demo/ folder."
                    : "Whatever URL the source gives you to embed. It runs on its own origin, so it's shown rather than driven."}
                </p>
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <label style={{ ...hint, flex: 1 }}>
                    Width
                    <input
                      type="number"
                      value={stage.width ?? ""}
                      onChange={(e) => onPatch(stage.id, { width: e.target.value ? Number(e.target.value) : undefined })}
                      style={inputStyle}
                    />
                  </label>
                  <label style={{ ...hint, flex: 1 }}>
                    Min width
                    <input
                      type="number"
                      value={stage.minWidth ?? ""}
                      onChange={(e) => onPatch(stage.id, { minWidth: e.target.value ? Number(e.target.value) : undefined })}
                      style={inputStyle}
                    />
                  </label>
                </div>
              </>
            )}

            <p style={{ ...hint, display: "flex", justifyContent: "space-between", gap: 8 }}>
              <code style={{ fontSize: 10.5, opacity: 0.75 }}>{stage.id}</code>
              <span>{used(stage.id)} {used(stage.id) === 1 ? "step" : "steps"}</span>
            </p>
          </div>
        ))}

        <Button variant="ghost" size="sm" icon={<Plus size={15} />} onClick={onAdd} style={fill}>
          Add a stage
        </Button>
      </div>
    </>
  );
}

/** Where a spotlight or a callout points: a mark on a driveable stage, an area
 * on one that can only be shown. The same field, because it is the same idea —
 * only the way of naming the spot differs. */
function Anchor({ mark, area, opaque, onMark, onPick, onDraw, busy, disabled }: {
  mark: string;
  area?: Area;
  opaque: boolean;
  onMark: (v: string) => void;
  onPick: () => void;
  onDraw: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  if (opaque) {
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
        opaque={false}
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

const stagesPanel: React.CSSProperties = {
  position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 91, width: 360, maxHeight: "80vh", overflowY: "auto",
  background: "#fff", border: "1px solid #e3e0db", borderRadius: 10, boxShadow: "0 18px 44px rgba(0,0,0,0.16)", padding: 16, textAlign: "left",
};

/** The band that opens each run of steps sharing a stage. Derived from the
 * steps, so dragging one into another run simply moves the band. */
const runBand: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 5, margin: "2px 0 6px",
  fontSize: 9.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#8a857d",
};

const hint: React.CSSProperties = { fontSize: 11, color: "#8a857d", margin: "7px 0 0", lineHeight: 1.5 };

const linkBtn: React.CSSProperties = {
  appearance: "none", border: 0, background: "none", padding: 0, font: "inherit", color: ACCENT,
  cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2,
};

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
