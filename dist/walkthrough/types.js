// ─── Walkthrough content ───────────────────────────────────────────
// A walkthrough is the second kind of project: a side panel of stepped copy
// next to a live product the reader actually clicks. The product is a demo
// build co-hosted with the project (projects/<id>/demo/), so the player can
// drive it directly — see driver.ts for that contract.
//
// The demo it points at has to hold up five rules:
//   1. data-walkthrough="<id>" on anything a step references (never selectors)
//   2. hash routes, so `enter.path` is an assignment and a path advance is a hashchange
//   3. boot from ?wt=<state> (sometimes empty), so any step is reachable by
//      reload, and treat the parameter's presence as "I am in a walkthrough"
//   4. fixtures, not network — deterministic for every reader
//   5. built with base "./" into projects/<id>/demo/
/** What a new walkthrough starts as: one step, and no demo pointed at yet. */
export const DEFAULT_WALKTHROUGH = {
    kind: "walkthrough",
    target: { src: "", width: 1280, minWidth: 900 },
    steps: [
        {
            id: "step-1",
            eyebrow: "Step one",
            title: "Start here",
            body: "Point this walkthrough at a demo, then describe what the reader should do first.",
            advance: { on: "manual" },
        },
    ],
};
/** Every mark a step points at, spotlight and callouts together, in the order
 * they were authored and without repeats. */
export function stepMarks(step) {
    const mark = step?.spotlight?.mark;
    const ids = !mark ? [] : Array.isArray(mark) ? [...mark] : [mark];
    for (const callout of step?.callouts ?? []) {
        if (callout.mark && !ids.includes(callout.mark))
            ids.push(callout.mark);
    }
    return ids;
}
/** The demo a step runs in: the nearest `enter.app` at or before it. A run of
 * steps through one app only has to name it once, and jumping straight to step
 * seven still resolves to the same app as walking there.
 *
 * Crossing into another app is always a fresh document, so the reader's work in
 * the app they are leaving doesn't carry over — each app boots from its seed. */
export function targetAt(content, index) {
    const app = appAt(content, index);
    return (app && content.targets?.[app]) || content.target;
}
/** The name a step resolves to, or null for the default demo. An unknown name
 * — "default" among them — means the default demo, which is how a step says
 * it comes back from a named one. */
export function appAt(content, index) {
    for (let i = Math.min(index, content.steps.length - 1); i >= 0; i--) {
        const app = content.steps[i]?.enter?.app;
        if (app)
            return content.targets?.[app] ? app : null;
    }
    return null;
}
/** Every demo the walkthrough can show, the default first. */
export function allTargets(content) {
    return [
        { name: null, target: content.target },
        ...Object.entries(content.targets ?? {}).map(([name, target]) => ({ name, target })),
    ];
}
//# sourceMappingURL=types.js.map