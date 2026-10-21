// ─── Walkthrough content ───────────────────────────────────────────
// A walkthrough is the second kind of project: a side panel of stepped copy
// beside whatever that copy is about. Every step says three things for itself,
// and they are independent of one another:
//
//   app      which ingested app is RUNNING, or none. A step that names the
//            same app as the step before it keeps that app's document alive,
//            so whatever the reader did carries forward. Naming a different
//            one throws the old document away and boots the new app.
//   content  what is VISIBLE: that app, a framed URL, an image, or a slide.
//            Anything but the app hides it without stopping it, so the step
//            after can pick the reader up where they left off.
//   actions  what the step DOES to the running app as it opens: click a mark,
//            type into one. The app is same-origin, so this needs nothing of
//            it beyond the marks a highlight already needs.
//
// Every step stores its own `app` — there is no "same as before" value. A new
// step copies the previous step's as its starting value and is independent
// after, so moving a step never silently re-homes the ones around it, and the
// control can always say truthfully what the step it belongs to is running.
//
// A "run" is then just consecutive steps holding the same app, which is what
// the rail bands. It is derived every time and never stored: there is nothing
// to get out of step with the steps themselves.
//
// An ingested app has to hold up three rules, and ingesting one means making
// them true of it:
//   1. data-walkthrough="<id>" on anything a step points at or acts on (never
//      CSS selectors, which rot)
//   2. hash routes, so a starting screen is an assignment rather than a load
//   3. built with base "./", since it is served from its own folder
/** What a new project starts as: one step, running nothing. */
export const DEFAULT_WALKTHROUGH = {
    steps: [
        {
            id: "step-1",
            eyebrow: "Step one",
            title: "Start here",
            body: "Pick an app for this step to run, then describe what the reader should do first.",
            advance: { on: "manual" },
        },
    ],
};
/** What a step shows, defaulted. */
export const contentOf = (step) => step?.content ?? { kind: "app" };
/** Whether what's on screen can be read into — marks, live geometry, advancing
 * on what the reader does. Only a running app can; an embed is another origin
 * and an image is a picture. */
export const isLive = (step) => !!step?.app && contentOf(step).kind === "app";
/** Whether this step boots its app rather than inheriting a running one. The
 * first step always boots; after that it is a step whose app differs from the
 * one before it. */
export function bootsApp(steps, index) {
    const step = steps[index];
    if (!step?.app)
        return false;
    return index === 0 || steps[index - 1]?.app !== step.app;
}
/** The steps grouped into the runs that share an app. Derived, never stored:
 * a run is just "consecutive steps holding the same app", so reordering steps
 * can't put the grouping out of step with them. */
export function appRuns(steps) {
    const out = [];
    steps.forEach((step, i) => {
        const app = step.app ?? null;
        const last = out[out.length - 1];
        if (last && last.app === app)
            last.to = i;
        else
            out.push({ app, from: i, to: i });
    });
    return out;
}
/** Every mark a step points at, spotlight and callouts together, in the order
 * they were authored and without repeats. Empty unless the app is on screen,
 * where the same things are anchored by rectangle instead. */
export function stepMarks(step) {
    const mark = step?.spotlight?.mark;
    const ids = !mark ? [] : Array.isArray(mark) ? [...mark] : [mark];
    for (const callout of step?.callouts ?? []) {
        if (callout.mark && !ids.includes(callout.mark))
            ids.push(callout.mark);
    }
    return ids;
}
//# sourceMappingURL=types.js.map