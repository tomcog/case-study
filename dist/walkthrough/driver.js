// ─── Walkthrough driver ────────────────────────────────────────────
// The seam between the player and the app. The player only ever talks to this
// interface, so how it reaches the app stays swappable: same origin (below)
// reads the frame's document directly and needs nothing shipped inside the
// app, while a cross-origin one would need the same methods implemented over
// postMessage against a small script in it.
//
// Everything here reaches the app the way a reader does — by mark, through the
// DOM — which is why an ingested app needs nothing added to it beyond the
// marks a highlight already requires.
const hash = (path) => (path ? `#${path.replace(/^#/, "")}` : "");
/** The frame's elements come from another realm, so `instanceof Element` is
 * always false here. Recognise them by shape instead. */
const asElement = (node) => {
    const el = node;
    return el && typeof el.closest === "function" ? el : null;
};
/** What to call an element that has no mark of its own. */
const describe = (el) => {
    const tag = el.tagName.toLowerCase();
    const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
    return text ? `${tag} “${text}”` : tag;
};
/** Drive a demo served from the player's own origin. */
export function sameOriginDriver(frame, src) {
    const clicks = new Set();
    const paths = new Set();
    const signals = new Set();
    const layouts = new Set();
    const picks = new Set();
    const hovers = new Set();
    let picking = false;
    let hovered = null;
    // The frame's own realm, where its observers and constructors live.
    const win = () => frame.contentWindow;
    const doc = () => frame.contentDocument;
    const hitFrom = (node) => {
        const el = asElement(node);
        if (!el)
            return null;
        const marked = el.closest("[data-walkthrough]");
        const chosen = marked ?? el;
        const r = chosen.getBoundingClientRect();
        return {
            el: chosen,
            hit: {
                mark: marked?.getAttribute("data-walkthrough") ?? null,
                label: describe(chosen),
                rect: { x: r.x, y: r.y, w: r.width, h: r.height },
            },
        };
    };
    const handleClick = (e) => {
        if (picking) {
            // The author is aiming at the product, not using it.
            e.preventDefault();
            e.stopPropagation();
            const found = hitFrom(e.target);
            if (found)
                picks.forEach((cb) => cb(found.hit));
            return;
        }
        const el = asElement(e.target)?.closest("[data-walkthrough]");
        const mark = el?.getAttribute("data-walkthrough");
        if (mark)
            clicks.forEach((cb) => cb(mark));
    };
    const handleSuppress = (e) => {
        if (!picking)
            return;
        e.preventDefault();
        e.stopPropagation();
    };
    const handleMove = (e) => {
        if (!picking)
            return;
        const found = hitFrom(e.target);
        if (found?.el === hovered)
            return;
        hovered = found?.el ?? null;
        hovers.forEach((cb) => cb(found?.hit ?? null));
    };
    const handleLeave = () => {
        if (!picking || !hovered)
            return;
        hovered = null;
        hovers.forEach((cb) => cb(null));
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
    // Layout reports are coalesced to one a frame: a demo that animates or
    // re-renders can otherwise fire these faster than anything can measure.
    let queued = false;
    const handleLayout = () => {
        if (queued)
            return;
        queued = true;
        window.requestAnimationFrame(() => {
            queued = false;
            syncSizes();
            layouts.forEach((cb) => cb());
        });
    };
    let watched = [];
    let observedEls = [];
    let sizes = null;
    let mutations = null;
    /** Follow the watched elements themselves, so a box that moves because the
     * demo re-rendered is noticed as readily as one that moved by scrolling.
     * Re-observing only when the elements actually change keeps the observer's
     * own first callback from looping back round. */
    function syncSizes() {
        const w = win();
        const d = doc();
        if (!w || !d)
            return;
        const els = watched.map((id) => query(id)).filter((el) => !!el);
        const same = sizes && els.length === observedEls.length && els.every((el, i) => el === observedEls[i]);
        if (same)
            return;
        observedEls = els;
        sizes?.disconnect();
        const ro = new w.ResizeObserver(handleLayout);
        sizes = ro;
        ro.observe(d.documentElement);
        els.forEach((el) => ro.observe(el));
    }
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
        d.addEventListener("mousedown", handleSuppress, true);
        d.addEventListener("mousemove", handleMove, true);
        d.addEventListener("mouseleave", handleLeave, true);
        d.addEventListener("scroll", handleLayout, true);
        w.addEventListener("hashchange", handleHash);
        w.addEventListener("wt:signal", handleSignal);
        w.addEventListener("resize", handleLayout);
        mutations?.disconnect();
        const mo = new w.MutationObserver(handleLayout);
        mutations = mo;
        mo.observe(d, { childList: true, subtree: true, attributes: true });
        observedEls = [];
        syncSizes();
        if (picking)
            d.documentElement.style.cursor = "crosshair";
        detach = () => {
            d.removeEventListener("click", handleClick, true);
            d.removeEventListener("mousedown", handleSuppress, true);
            d.removeEventListener("mousemove", handleMove, true);
            d.removeEventListener("mouseleave", handleLeave, true);
            d.removeEventListener("scroll", handleLayout, true);
            w.removeEventListener("hashchange", handleHash);
            w.removeEventListener("wt:signal", handleSignal);
            w.removeEventListener("resize", handleLayout);
        };
    }
    frame.addEventListener("load", attach);
    const url = (path) => {
        const next = new URL(src, window.location.href);
        // ?wt= is what tells the app it is inside a walkthrough at all, so it is
        // always sent. Without it an app built to use fixtures here would go back
        // to its normal mode and reach for a backend it isn't meant to have.
        next.searchParams.set("wt", "");
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
    const query = (id) => doc()?.querySelector(`[data-walkthrough="${CSS.escape(id)}"]`) ?? null;
    return {
        ready() {
            if (loaded())
                return Promise.resolve();
            return new Promise((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));
        },
        async open(path, opts = {}) {
            // A step that boots the app, or a frame with nothing in it yet.
            if (opts.reload || !loaded()) {
                await load(url(path));
                return;
            }
            const w = win();
            if (path && w && w.location.hash !== hash(path))
                w.location.hash = hash(path);
        },
        click(mark) {
            const el = query(mark);
            if (!el)
                return false;
            el.click();
            return true;
        },
        type(mark, text) {
            const el = query(mark);
            const w = win();
            if (!el || !w)
                return false;
            if (el.isContentEditable) {
                el.textContent = text;
            }
            else if ("value" in el) {
                // Frameworks patch the value setter on the prototype to notice writes;
                // assigning el.value directly goes round the patch and the app never
                // hears about it.
                const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set;
                if (setter)
                    setter.call(el, text);
                else
                    el.value = text;
            }
            else {
                return false;
            }
            el.dispatchEvent(new w.Event("input", { bubbles: true }));
            el.dispatchEvent(new w.Event("change", { bubbles: true }));
            return true;
        },
        marks(ids) {
            const out = {};
            for (const id of ids) {
                const el = query(id);
                if (!el)
                    continue;
                const r = el.getBoundingClientRect();
                out[id] = { x: r.x, y: r.y, w: r.width, h: r.height };
            }
            return out;
        },
        reveal(id) {
            query(id)?.scrollIntoView({ block: "center", behavior: "smooth" });
        },
        currentPath() {
            return win()?.location.hash ?? "";
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
        observe(ids) {
            if (ids.length === watched.length && ids.every((id, i) => id === watched[i]))
                return;
            watched = ids;
            syncSizes();
        },
        onPick(cb) {
            picks.add(cb);
            return () => picks.delete(cb);
        },
        onHover(cb) {
            hovers.add(cb);
            return () => hovers.delete(cb);
        },
        setPicking(on) {
            picking = on;
            const d = doc();
            if (d)
                d.documentElement.style.cursor = on ? "crosshair" : "";
            if (!on && hovered) {
                hovered = null;
                hovers.forEach((cb) => cb(null));
            }
        },
        reset() {
            return load(url());
        },
        dispose() {
            this.setPicking(false);
            frame.removeEventListener("load", attach);
            sizes?.disconnect();
            mutations?.disconnect();
            detach?.();
            clicks.clear();
            paths.clear();
            signals.clear();
            layouts.clear();
            picks.clear();
            hovers.clear();
        },
    };
}
//# sourceMappingURL=driver.js.map