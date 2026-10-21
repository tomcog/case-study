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
//# sourceMappingURL=types.js.map