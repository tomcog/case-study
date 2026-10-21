// ─── Walkthrough driver ────────────────────────────────────────────
// The seam between the player and the product. The player only ever talks to
// this interface, so how it reaches the demo stays swappable: same origin
// (below) reads the frame's document directly and needs nothing shipped inside
// the product, while a cross-origin target would need the same methods
// implemented over postMessage against a small script in the product.

import type { WalkthroughStep } from "./types.js";

/** An element's box in the demo's own viewport coordinates. */
export interface MarkRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type MarkRects = Record<string, MarkRect>;

/** An element the author pointed at while picking a mark. `mark` is null when
 * the element carries no data-walkthrough id — which is the one thing the
 * builder most needs to be able to say. */
export interface PickHit {
  mark: string | null;
  label: string;
  rect: MarkRect;
}

export interface Driver {
  /** Resolves once the demo has a document to read. */
  ready(): Promise<void>;
  /** Put the product into the state this step describes.
   * `reseed` reloads the demo with the step's `?wt=` state; walking forward
   * leaves it off, so the reader keeps whatever they just did. */
  enter(step: WalkthroughStep, opts?: { reseed?: boolean }): Promise<void>;
  /** Current geometry of the given marks. Missing marks are left out. */
  marks(ids: string[]): MarkRects;
  /** Scroll a mark into view inside the demo. */
  reveal(id: string): void;
  /** The route the demo is showing, as a hash ("#/settings"). */
  currentPath(): string;
  onClick(cb: (mark: string) => void): () => void;
  onPath(cb: (path: string) => void): () => void;
  onSignal(cb: (name: string, detail: unknown) => void): () => void;
  /** The demo scrolled, resized, or moved something: whatever `marks` returned
   * is now stale. Reports at most once a frame. */
  onLayout(cb: () => void): () => void;
  /** Which marks to watch closely. Their boxes are then followed as the demo
   * animates, re-renders and reflows, not just when it scrolls. */
  observe(ids: string[]): void;
  /** Authoring: swallow the demo's own interactions and report what's pointed
   * at instead, so a mark can be chosen by clicking it. */
  setPicking(on: boolean): void;
  onPick(cb: (hit: PickHit) => void): () => void;
  onHover(cb: (hit: PickHit | null) => void): () => void;
  reset(): Promise<void>;
  dispose(): void;
}

const hash = (path?: string) => (path ? `#${path.replace(/^#/, "")}` : "");

/** The frame's elements come from another realm, so `instanceof Element` is
 * always false here. Recognise them by shape instead. */
const asElement = (node: EventTarget | null): Element | null => {
  const el = node as Element | null;
  return el && typeof el.closest === "function" ? el : null;
};

/** What to call an element that has no mark of its own. */
const describe = (el: Element) => {
  const tag = el.tagName.toLowerCase();
  const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
  return text ? `${tag} “${text}”` : tag;
};

/** Drive a demo served from the player's own origin. */
export function sameOriginDriver(frame: HTMLIFrameElement, src: string): Driver {
  const clicks = new Set<(mark: string) => void>();
  const paths = new Set<(path: string) => void>();
  const signals = new Set<(name: string, detail: unknown) => void>();
  const layouts = new Set<() => void>();
  const picks = new Set<(hit: PickHit) => void>();
  const hovers = new Set<(hit: PickHit | null) => void>();

  let picking = false;
  let hovered: Element | null = null;

  // The frame's own realm, where its observers and constructors live.
  const win = () => frame.contentWindow as (Window & typeof globalThis) | null;
  const doc = () => frame.contentDocument;

  const hitFrom = (node: EventTarget | null): { el: Element; hit: PickHit } | null => {
    const el = asElement(node);
    if (!el) return null;
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

  const handleClick = (e: Event) => {
    if (picking) {
      // The author is aiming at the product, not using it.
      e.preventDefault();
      e.stopPropagation();
      const found = hitFrom(e.target);
      if (found) picks.forEach((cb) => cb(found.hit));
      return;
    }
    const el = asElement(e.target)?.closest("[data-walkthrough]");
    const mark = el?.getAttribute("data-walkthrough");
    if (mark) clicks.forEach((cb) => cb(mark));
  };

  const handleSuppress = (e: Event) => {
    if (!picking) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMove = (e: Event) => {
    if (!picking) return;
    const found = hitFrom(e.target);
    if (found?.el === hovered) return;
    hovered = found?.el ?? null;
    hovers.forEach((cb) => cb(found?.hit ?? null));
  };

  const handleLeave = () => {
    if (!picking || !hovered) return;
    hovered = null;
    hovers.forEach((cb) => cb(null));
  };

  const handleHash = () => {
    const path = win()?.location.hash;
    if (path) paths.forEach((cb) => cb(path));
  };

  const handleSignal = (e: Event) => {
    const detail = (e as CustomEvent).detail as { name?: string } | undefined;
    if (detail?.name) signals.forEach((cb) => cb(detail.name as string, detail));
  };

  // Layout reports are coalesced to one a frame: a demo that animates or
  // re-renders can otherwise fire these faster than anything can measure.
  let queued = false;
  const handleLayout = () => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(() => {
      queued = false;
      syncSizes();
      layouts.forEach((cb) => cb());
    });
  };

  let watched: string[] = [];
  let observedEls: Element[] = [];
  let sizes: ResizeObserver | null = null;
  let mutations: MutationObserver | null = null;

  /** Follow the watched elements themselves, so a box that moves because the
   * demo re-rendered is noticed as readily as one that moved by scrolling.
   * Re-observing only when the elements actually change keeps the observer's
   * own first callback from looping back round. */
  function syncSizes() {
    const w = win();
    const d = doc();
    if (!w || !d) return;
    const els = watched.map((id) => query(id)).filter((el): el is Element => !!el);
    const same = sizes && els.length === observedEls.length && els.every((el, i) => el === observedEls[i]);
    if (same) return;
    observedEls = els;
    sizes?.disconnect();
    const ro = new w.ResizeObserver(handleLayout);
    sizes = ro;
    ro.observe(d.documentElement);
    els.forEach((el) => ro.observe(el));
  }

  // Every navigation inside the frame replaces the document, so the listeners
  // are bound again on each load rather than once at setup.
  let detach: (() => void) | null = null;

  function attach() {
    detach?.();
    detach = null;
    const w = win();
    const d = doc();
    if (!w || !d) return;
    d.addEventListener("click", handleClick, true);
    d.addEventListener("mousedown", handleSuppress, true);
    d.addEventListener("mousemove", handleMove, true);
    d.addEventListener("mouseleave", handleLeave, true);
    d.addEventListener("scroll", handleLayout, true);
    w.addEventListener("hashchange", handleHash);
    w.addEventListener("wt:signal", handleSignal as EventListener);
    w.addEventListener("resize", handleLayout);
    mutations?.disconnect();
    const mo = new w.MutationObserver(handleLayout);
    mutations = mo;
    mo.observe(d, { childList: true, subtree: true, attributes: true });
    observedEls = [];
    syncSizes();
    if (picking) d.documentElement.style.cursor = "crosshair";
    detach = () => {
      d.removeEventListener("click", handleClick, true);
      d.removeEventListener("mousedown", handleSuppress, true);
      d.removeEventListener("mousemove", handleMove, true);
      d.removeEventListener("mouseleave", handleLeave, true);
      d.removeEventListener("scroll", handleLayout, true);
      w.removeEventListener("hashchange", handleHash);
      w.removeEventListener("wt:signal", handleSignal as EventListener);
      w.removeEventListener("resize", handleLayout);
    };
  }

  frame.addEventListener("load", attach);

  const url = (state?: string, path?: string) => {
    const next = new URL(src, window.location.href);
    // ?wt= is always present, even with no seed to ask for: it is what tells the
    // demo it is inside a walkthrough at all. Dropping it on a step that names
    // no state would put the demo back into its normal mode — reaching for a
    // real backend it isn't meant to have here.
    next.searchParams.set("wt", state ?? "");
    next.hash = hash(path);
    return next.toString();
  };

  const href = () => {
    try {
      return win()?.location.href ?? "";
    } catch {
      return "";
    }
  };

  const load = (to: string) =>
    new Promise<void>((resolve) => {
      const go = () => {
        frame.addEventListener("load", () => resolve(), { once: true });
        frame.src = to;
      };
      // Where only the fragment differs from what the frame is showing, setting
      // src navigates without reloading, so the seed would never re-apply and
      // no load event would arrive. Compare against the frame's real location
      // rather than its src attribute, which goes stale the moment the demo
      // routes itself, and blank the frame first so the load is always real.
      if (href().split("#")[0] !== to.split("#")[0]) return go();
      frame.addEventListener("load", go, { once: true });
      frame.src = "about:blank";
    });

  const loaded = () => !!doc() && doc()!.readyState !== "loading";

  const query = (id: string) => doc()?.querySelector(`[data-walkthrough="${CSS.escape(id)}"]`) ?? null;

  return {
    ready() {
      if (loaded()) return Promise.resolve();
      return new Promise<void>((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));
    },

    async enter(step, opts = {}) {
      const { path, state } = step.enter ?? {};
      // A fresh frame, or a step arrived at out of order, boots from the seed.
      if (opts.reseed || !loaded()) {
        await load(url(state, path));
        return;
      }
      const w = win();
      if (path && w && w.location.hash !== hash(path)) w.location.hash = hash(path);
    },

    marks(ids) {
      const out: MarkRects = {};
      for (const id of ids) {
        const el = query(id);
        if (!el) continue;
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
      if (ids.length === watched.length && ids.every((id, i) => id === watched[i])) return;
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
      if (d) d.documentElement.style.cursor = on ? "crosshair" : "";
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
