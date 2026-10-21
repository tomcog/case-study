// ─── Walkthrough driver ────────────────────────────────────────────
// The seam between the player and the product. The player only ever talks to
// this interface, so how it reaches the demo stays swappable: same origin
// (below) reads the frame's document directly and needs nothing shipped inside
// the product, while a cross-origin target would need the same methods
// implemented over postMessage against a small script in the product.
const hash = (path) => (path ? `#${path.replace(/^#/, "")}` : "");
/** Drive a demo served from the player's own origin. */
export function sameOriginDriver(frame, src) {
    const clicks = new Set();
    const paths = new Set();
    const signals = new Set();
    const layouts = new Set();
    const win = () => frame.contentWindow;
    const doc = () => frame.contentDocument;
    const handleClick = (e) => {
        const target = e.target;
        const el = target && "closest" in target ? target.closest("[data-walkthrough]") : null;
        const mark = el?.getAttribute("data-walkthrough");
        if (mark)
            clicks.forEach((cb) => cb(mark));
    };
    const handleHash = () => {
        const path = win()?.location.hash;
        if (path)
            paths.forEach((cb) => cb(path));
    };
    const handleSignal = (e) => {
        const detail = e.detail;
        if (detail?.name)
            signals.forEach((cb) => cb(detail.name, detail));
    };
    const handleLayout = () => layouts.forEach((cb) => cb());
    // Every navigation inside the frame replaces the document, so the listeners
    // are bound again on each load rather than once at setup.
    let detach = null;
    function attach() {
        detach?.();
        detach = null;
        const w = win();
        const d = doc();
        if (!w || !d)
            return;
        d.addEventListener("click", handleClick, true);
        d.addEventListener("scroll", handleLayout, true);
        w.addEventListener("hashchange", handleHash);
        w.addEventListener("wt:signal", handleSignal);
        w.addEventListener("resize", handleLayout);
        detach = () => {
            d.removeEventListener("click", handleClick, true);
            d.removeEventListener("scroll", handleLayout, true);
            w.removeEventListener("hashchange", handleHash);
            w.removeEventListener("wt:signal", handleSignal);
            w.removeEventListener("resize", handleLayout);
        };
    }
    frame.addEventListener("load", attach);
    const url = (state, path) => {
        const next = new URL(src, window.location.href);
        if (state)
            next.searchParams.set("wt", state);
        next.hash = hash(path);
        return next.toString();
    };
    const href = () => {
        try {
            return win()?.location.href ?? "";
        }
        catch {
            return "";
        }
    };
    const load = (to) => new Promise((resolve) => {
        const go = () => {
            frame.addEventListener("load", () => resolve(), { once: true });
            frame.src = to;
        };
        // Where only the fragment differs from what the frame is showing, setting
        // src navigates without reloading, so the seed would never re-apply and
        // no load event would arrive. Compare against the frame's real location
        // rather than its src attribute, which goes stale the moment the demo
        // routes itself, and blank the frame first so the load is always real.
        if (href().split("#")[0] !== to.split("#")[0])
            return go();
        frame.addEventListener("load", go, { once: true });
        frame.src = "about:blank";
    });
    const loaded = () => !!doc() && doc().readyState !== "loading";
    return {
        ready() {
            if (loaded())
                return Promise.resolve();
            return new Promise((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));
        },
        async enter(step, opts = {}) {
            const { path, state } = step.enter ?? {};
            // A fresh frame, or a step arrived at out of order, boots from the seed.
            if (opts.reseed || !loaded()) {
                await load(url(state, path));
                return;
            }
            const w = win();
            if (path && w && w.location.hash !== hash(path))
                w.location.hash = hash(path);
        },
        marks(ids) {
            const d = doc();
            if (!d)
                return {};
            const out = {};
            for (const id of ids) {
                const el = d.querySelector(`[data-walkthrough="${CSS.escape(id)}"]`);
                if (!el)
                    continue;
                const r = el.getBoundingClientRect();
                out[id] = { x: r.x, y: r.y, w: r.width, h: r.height };
            }
            return out;
        },
        reveal(id) {
            const el = doc()?.querySelector(`[data-walkthrough="${CSS.escape(id)}"]`);
            el?.scrollIntoView({ block: "center", behavior: "smooth" });
        },
        onClick(cb) {
            clicks.add(cb);
            return () => clicks.delete(cb);
        },
        onPath(cb) {
            paths.add(cb);
            return () => paths.delete(cb);
        },
        onSignal(cb) {
            signals.add(cb);
            return () => signals.delete(cb);
        },
        onLayout(cb) {
            layouts.add(cb);
            return () => layouts.delete(cb);
        },
        reset() {
            return load(url());
        },
        dispose() {
            frame.removeEventListener("load", attach);
            detach?.();
            clicks.clear();
            paths.clear();
            signals.clear();
            layouts.clear();
        },
    };
}
//# sourceMappingURL=driver.js.map