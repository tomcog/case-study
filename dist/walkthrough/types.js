// ─── Walkthrough content ───────────────────────────────────────────
// A walkthrough is the second kind of project: a side panel of stepped copy
// beside whatever that copy is about. That something is a stage, and a
// walkthrough carries a flat list of them — four apps, say, or three apps and
// a Figma mock-up of the fourth, which isn't built yet. None is privileged.
// A step names the stage it runs in; a step that names none stays in whichever
// stage the steps before it named, so a run of steps through one app only has
// to say so once.
//
// Stages differ in what the player can do with them, not in what they are:
//   • demo  — served from this site, so it can be read into and driven. Marks,
//             spotlights that follow a reflowing element, advancing on what the
//             reader actually did.
//   • embed — any other URL in a frame: a Figma prototype, a live site. The
//             reader can click inside it; we just can't see them do it.
//   • mock  — a still image. Nothing to click at all.
// The last two are opaque: no marks, no observed advance, and anchoring by
// rectangle rather than by element.
//
// A demo has to hold up five rules, and adding one means making them true:
//   1. data-walkthrough="<id>" on anything a step references (never selectors)
//   2. hash routes, so `enter.path` is an assignment and a path advance is a hashchange
//   3. boot from ?wt=<state> (sometimes empty), so any step is reachable by
//      reload, and treat the parameter's presence as "I am in a walkthrough"
//   4. fixtures, not network — deterministic for every reader
//   5. built with base "./" into projects/<id>/demo/
/** Whether the player can read into this stage — marks, live geometry, and
 * advancing on what the reader does. Everything else is shown, not driven. */
export const isDriveable = (stage) => stage?.kind === "demo";
/** What a new walkthrough starts as: one step, and no stage to put it on. */
export const DEFAULT_WALKTHROUGH = {
    kind: "walkthrough",
    stages: [],
    steps: [
        {
            id: "step-1",
            eyebrow: "Step one",
            title: "Start here",
            body: "Add a stage for this walkthrough, then describe what the reader should do first.",
            advance: { on: "manual" },
        },
    ],
};
/** Every mark a step points at, spotlight and callouts together, in the order
 * they were authored and without repeats. Empty on an opaque stage, where the
 * same things are anchored by rectangle instead. */
export function stepMarks(step) {
    const mark = step?.spotlight?.mark;
    const ids = !mark ? [] : Array.isArray(mark) ? [...mark] : [mark];
    for (const callout of step?.callouts ?? []) {
        if (callout.mark && !ids.includes(callout.mark))
            ids.push(callout.mark);
    }
    return ids;
}
/** The stage id a step runs in: the nearest `enter.stage` at or before it.
 *
 * Resolving by looking backwards rather than by remembering where the reader
 * has been is what makes jumping straight to step seven land in the same stage
 * as walking there. With no step naming one, it is the first stage — so a
 * walkthrough with a single stage never has to mention it. */
export function stageIdAt(content, index) {
    for (let i = Math.min(index, content.steps.length - 1); i >= 0; i--) {
        const id = content.steps[i]?.enter?.stage;
        if (id)
            return id;
    }
    return content.stages[0]?.id ?? null;
}
/** The stage a step runs in, or null when it names one that no longer exists.
 * A missing stage is reported rather than quietly swapped for another: a step
 * pointed at the wrong app is worse than a step with nothing to show. */
export function stageAt(content, index) {
    const id = stageIdAt(content, index);
    return (id && content.stages.find((s) => s.id === id)) || null;
}
/** The steps grouped into the runs that share a stage. Derived, never stored:
 * a run is just "until some step names a different stage", so reordering steps
 * can't put the grouping out of step with the steps themselves. */
export function stageRuns(content) {
    const out = [];
    content.steps.forEach((_, i) => {
        const stageId = stageIdAt(content, i);
        const last = out[out.length - 1];
        if (last && last.stageId === stageId)
            last.to = i;
        else
            out.push({ stageId, stage: stageAt(content, i), from: i, to: i });
    });
    return out;
}
//# sourceMappingURL=types.js.map