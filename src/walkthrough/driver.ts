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
  onClick(cb: (mark: string) => void): () => void;
  onPath(cb: (path: string) => void): () => void;
  onSignal(cb: (name: string, detail: unknown) => void): () => void;
  /** The demo scrolled or resized: whatever `marks` returned is now stale. */
  onLayout(cb: () => void): () => void;
  reset(): Promise<void>;
  dispose(): void;
}

const hash = (path?: string) => (path ? `#${path.replace(/^#/, "")}` : "");

/** Drive a demo served from the player's own origin. */
export function sameOriginDriver(frame: HTMLIFrameElement, src: string): Driver {
  const clicks = new Set<(mark: string) => void>();
  const paths = new Set<(path: string) => void>();
  const signals = new Set<(name: string, detail: unknown) => void>();
  const layouts = new Set<() => void>();

  const win = () => frame.contentWindow;
  const doc = () => frame.contentDocument;

  const handleClick = (e: Event) => {
    const target = e.target as Element | null;
    const el = target && "closest" in target ? target.closest("[data-walkthrough]") : null;
    const mark = el?.getAttribute("data-walkthrough");
    if (mark) clicks.forEach((cb) => cb(mark));
  };

  const handleHash = () => {
    const path = win()?.location.hash;
    if (path) paths.forEach((cb) => cb(path));
  };

  const handleSignal = (e: Event) => {
    const detail = (e as CustomEvent).detail as { name?: string } | undefined;
    if (detail?.name) signals.forEach((cb) => cb(detail.name as string, detail));
  };

  const handleLayout = () => layouts.forEach((cb) => cb());

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
    d.addEventListener("scroll", handleLayout, true);
    w.addEventListener("hashchange", handleHash);
    w.addEventListener("wt:signal", handleSignal as EventListener);
    w.addEventListener("resize", handleLayout);
    detach = () => {
      d.removeEventListener("click", handleClick, true);
      d.removeEventListener("scroll", handleLayout, true);
      w.removeEventListener("hashchange", handleHash);
      w.removeEventListener("wt:signal", handleSignal as EventListener);
      w.removeEventListener("resize", handleLayout);
    };
  }

  frame.addEventListener("load", attach);

  const url = (state?: string, path?: string) => {
    const next = new URL(src, window.location.href);
    if (state) next.searchParams.set("wt", state);
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
      const d = doc();
      if (!d) return {};
      const out: MarkRects = {};
      for (const id of ids) {
        const el = d.querySelector(`[data-walkthrough="${CSS.escape(id)}"]`);
        if (!el) continue;
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
