import { Fragment, createContext, useContext, useState, useEffect, useRef, useLayoutEffect, useMemo } from "react";
import { Lightbox, LightboxTrigger } from "./ui/Lightbox.js";
import { motion, useAnimate, useReducedMotion, Variants } from "motion/react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { CaseStudyThumb } from "./ui/CaseStudyThumb.js";
import { CaseStudyLink } from "./ui/CaseStudyLink.js";
import { LogoMark } from "./ui/LogoMark.js";
import { getVideoEmbedUrl, isVideoSrc } from "./video.js";
import { RED, INK, DEFAULT_ACCENT, OVERLAY_GRADIENT, MONO_FILTER } from "./theme.js";
import { renderStyledText, splitPauses } from "./ui/renderStyledText.js";

// ─── Data model ────────────────────────────────────────────────────
// A Screen is one composed slide: a layout and one flat bag of optional
// fields, of which the layout decides what it uses. A step displays one.
// It transitions in with a "spatial push" and builds itself up by staggering
// its parts (eyebrow → title → body → media).

export type ScreenLayout = "cover" | "overview" | "quote" | "metrics" | "gallery" | "showcase" | "bento" | "video" | "basic1" | "basic2";

export interface Metric {
  id: string;
  value: string;
  label: string;
}

// A row in the "overview" index list — also reused for "showcase" annotations.
export interface OverviewItem {
  id: string;
  label: string;
  body: string;
  x?: number; // annotation dot position on the showcase image, 0–100% of width
  y?: number; // …and height
}

// An image + caption pair for the "gallery" triptych.
export interface GalleryImage {
  id: string;
  url: string;
  caption: string;
  number?: string; // editable index label; undefined = sequential default, "" = hidden
}

export type Theme = "light" | "dark";

export interface Screen {
  id: string;
  layout: ScreenLayout;
  theme?: Theme;
  bg: string;
  fg: string;
  accent: string;
  eyebrow?: string;
  title?: string;
  body?: string;
  imageUrl?: string;
  imageUrl2?: string;
  bodyImage?: string;  // an image under the body, in the text column (Intro, Title Card, Basic 1 & 2)
  overlay?: boolean;   // Image-theme gradient toggle (Basic / Title Card / Intro)
  mono?: boolean;      // Grayscale and 25% darker; independent of `overlay`
  videoUrl?: string;   // "video" layout: YouTube/Vimeo/mp4 to embed
  linkUrl?: string;    // optional outbound CTA (e.g. a Figma prototype) — opens in a new tab
  linkLabel?: string;  // CTA button label (defaults to "View prototype", or "Next" for a next button)
  linkAction?: "next"; // the button moves on to the next step instead of opening linkUrl; absent is a link
  linkStyle?: "ghost"; // the button is a 1px white outline with no fill; absent is the filled default
  basicTheme?: "light" | "dark" | "red" | "image"; // Basic templates (image = basic1 only)
  basicTextSide?: "left" | "right"; // Basic 2-column: which half the text sits in
  basicImage?: "off" | "fit" | "fill" | "bleed" | "desktop" | "mobile"; // Basic 2-column image on the opposite half
  imageTextDark?: boolean; // Image theme: black text instead of the default white
  showLogo?: boolean;   // display the slide logo on this screen
  metrics?: Metric[];
  items?: OverviewItem[];
  images?: GalleryImage[];
}

export interface ProjectPreview {
  image?: string;
  imageOverlay?: boolean; // gradient overlay on the card image (default off)
  imageMono?: boolean;    // grayscale + 25% darker on the card image (default off)
  eyebrow?: string;
  title?: string;
  body?: string;
  logo?: string;         // logo shown on the presentation slides (Intro / Title Card, top-left)
  cardLogo?: string;     // logo shown on the Projects page preview card (falls back to `logo`)
  /** @deprecated Ignored. Each site that shows projects picks which ones itself. */
  show?: boolean;
}

export const ACCENT = RED;

// Theme is the single source of truth for background + text color. Light is the
// default for every template; the builder toggles between the two.
export const THEMES: Record<Theme, { bg: string; fg: string }> = {
  light: { bg: "#ffffff", fg: "#1a1a1a" },
  dark: { bg: "#0f0f10", fg: "#ffffff" },
};

// Legacy screens saved before the toggle existed only stored raw bg/fg — infer
// their theme from the background's luminance so they keep their look.
export function isDarkColor(hex?: string): boolean {
  if (!hex) return false;
  const m = hex.replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const r = parseInt(v.slice(0, 2), 16), g = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return false;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
}

export function screenTheme(screen: Screen): Theme {
  return screen.theme ?? (isDarkColor(screen.bg) ? "dark" : "light");
}

export function themeColors(screen: Screen): { bg: string; fg: string } {
  return THEMES[screenTheme(screen)];
}

/** The color that bleeds to the viewport edges behind the 16:9 stage. A Title
 * Card with a solid theme bleeds that solid color (white / red / black) full —
 * just like an image theme bleeds its picture — instead of showing the plain
 * light/dark theme color in the letterbox margins. */
export function bleedBg(screen: Screen): string {
  if (screen.layout === "cover" && screen.basicTheme && screen.basicTheme !== "image") {
    return basicColors(screen.basicTheme).bg;
  }
  return themeColors(screen).bg;
}

// Seed rows used when a screen is first switched to the "overview" layout, so
// the builder shows a fully-composed title slide instead of an empty shell.
export const DEFAULT_OVERVIEW_ITEMS: OverviewItem[] = [
  { id: "o1", label: "The Problem", body: "What problem did you set out to solve, and for whom?" },
  { id: "o2", label: "The Solution", body: "What did you design, and what changed as a result?" },
  { id: "o3", label: "My Role", body: "Research, Interaction Design, Prototyping" },
  { id: "o4", label: "Timeline", body: "6 months · 2024" },
  { id: "o5", label: "Tools", body: "Figma, Miro, FigJam, Jira" },
];

export const DEFAULT_GALLERY: GalleryImage[] = [
  { id: "g1", url: "", caption: "First exploration" },
  { id: "g2", url: "", caption: "Refined direction" },
  { id: "g3", url: "", caption: "Final design" },
];

export const DEFAULT_ANNOTATIONS: OverviewItem[] = [
  { id: "a1", label: "Clear hierarchy", body: "The most important action sits where the eye lands first." },
  { id: "a2", label: "Inline validation", body: "Errors surface at the field, before the order is ever submitted." },
  { id: "a3", label: "One source of truth", body: "Order, sample, and result status all live on a single screen." },
];

export const DEFAULT_STAT: Metric = { id: "b1", value: "−63%", label: "Order entry errors" };

// ─── Animation variants ────────────────────────────────────────────

export const EASE = [0.22, 1, 0.36, 1] as const;

// Every screen is composed on a fixed 16:9 stage, then scaled to fit whatever
// container it lives in (editor canvas or full-viewport player). This keeps the
// editor a pixel-accurate thumbnail of the played screen.
export const STAGE_W = 1280;
export const STAGE_H = 720;

/** Centers a fixed STAGE_W×STAGE_H stage inside its parent and scales it to fit.
 * `backdrop` renders full-bleed behind the scaled stage, so a bleed image fills
 * the whole container (the viewport in the player), not just the 16:9 safe area. */
export function Stage({ background, backdrop, children }: { background: string; backdrop?: React.ReactNode; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const compute = () => {
      const r = el.getBoundingClientRect();
      setScale(Math.min(r.width / STAGE_W, r.height / STAGE_H));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ position: "absolute", inset: 0, overflow: "hidden", background, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {backdrop}
      <div style={{ position: "relative", width: STAGE_W, height: STAGE_H, flexShrink: 0, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

/** A bleed image filling the whole Stage container (past the 16:9 safe area), or
 * just its left/right half when `half` is set, with an optional top gradient. */
export function BleedBackdrop({ url, overlay, mono, half }: { url: string; overlay: boolean; mono?: boolean; half?: "left" | "right" }) {
  const pos: React.CSSProperties = half
    ? { top: 0, bottom: 0, width: "50%", left: half === "left" ? 0 : undefined, right: half === "right" ? 0 : undefined }
    : { inset: 0 };
  return (
    <div style={{ position: "absolute", ...pos, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `url("${url}")`, backgroundSize: "cover", backgroundPosition: "center", filter: mono ? MONO_FILTER : undefined }} />
      {overlay && <div style={{ position: "absolute", inset: 0, background: OVERLAY_GRADIENT }} />}
    </div>
  );
}

/** Which background image (if any) escapes the 16:9 stage to bleed the whole
 * container: the Basic 2-column "bleed" image (its half) and every Image-theme
 * background (full, or the left half for Intro). */
export function backdropFor(screen: Screen): React.ReactNode {
  if (screen.layout === "basic2" && screen.basicImage === "bleed" && screen.imageUrl) {
    const textLeft = (screen.basicTextSide ?? "left") === "left";
    return <BleedBackdrop url={screen.imageUrl} overlay={screen.overlay === true} mono={screen.mono === true} half={textLeft ? "right" : "left"} />;
  }
  if (screen.basicTheme === "image" && screen.imageUrl &&
      (screen.layout === "basic1" || screen.layout === "cover" || screen.layout === "quote" || screen.layout === "overview")) {
    return <BleedBackdrop url={screen.imageUrl} overlay={screen.overlay !== false} mono={screen.mono === true} half={screen.layout === "overview" ? "left" : undefined} />;
  }
  return undefined;
}

export const screenVariants: Variants = {
  enter: (dir: number) => ({ x: dir >= 0 ? "100%" : "-100%", scale: 0.92, opacity: 0 }),
  center: { x: "0%", scale: 1, opacity: 1 },
  exit: (dir: number) => ({ x: dir >= 0 ? "-14%" : "14%", scale: 0.86, opacity: 0 }),
};

export const reducedScreenVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

export const buildContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.13, delayChildren: 0.22 } },
};

// An item's `custom` is the time of each pause inside it (see built), and its
// copy's paused runs are its variant children, so `delayChildren` holds each
// one back until its beat. The item itself keeps the stagger it is given.
const pausing = (ats: number[] = []) => ({ delayChildren: (i: number) => ats[i] ?? 0 });

export const buildItem: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: (ats?: number[]) => ({ opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE, ...pausing(ats) } }),
};

export const reducedItem: Variants = {
  hidden: { opacity: 0 },
  show: (ats?: number[]) => ({ opacity: 1, transition: { duration: 0.3, ...pausing(ats) } }),
};

/** The build container for a slide whose copy may pause. Each item still
 * arrives on the stagger, plus every pause in the items before it, so a pause
 * holds up the rest of the build rather than only its own text. Motion hands
 * `delayChildren` an index in document order, so the pauses are read off the
 * items' `data-build` in that same order. If the count doesn't match, it falls
 * back to the plain stagger rather than guess. */
export function pausedContainer(root: React.RefObject<HTMLElement | null>): Variants {
  return {
    hidden: {},
    show: {
      transition: {
        delayChildren: (i: number, n: number) => {
          const items = root.current?.querySelectorAll<HTMLElement>("[data-build]");
          let held = 0;
          if (items?.length === n) for (let j = 0; j < i; j++) held += Number(items[j].dataset.build) || 0;
          return 0.22 + 0.13 * i + held;
        },
      },
    },
  };
}

/** Seconds until a pausedContainer's build has started its last item: the
 * stagger across every item, plus every pause in them. */
function buildLength(root: HTMLElement | null): number {
  const items = [...(root?.querySelectorAll<HTMLElement>("[data-build]") ?? [])];
  return 0.22 + 0.13 * Math.max(items.length - 1, 0) + items.reduce((t, el) => t + (Number(el.dataset.build) || 0), 0);
}

// A paused run arrives on its own once its beat comes: a whole paragraph rises
// as an item does; a run inside a line can only fade, since an inline box
// won't take a transform.
const revealBlock: Variants = buildItem;
const revealInline: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.65, ease: EASE } } };

/** Whether copy is being drawn inside a slide's build, where its pauses play.
 * Anywhere else (a panel, a preview card, an eyebrow, which makes no entrance)
 * they are only stripped. */
const BuildContext = createContext(false);

// Every copy field holds two kinds of break. A blank line ends a paragraph
// (Return in the editor, see CopyInput); a single newline is a line break
// inside one (⌘Return), which keeps the tighter spacing of a line. Stored copy
// relies on this, so changing it breaks existing projects.

/** Space between paragraphs: 75% of the font size. */
export const PARA_GAP = "0.75em";

/** A copy field's paragraphs, in order, each still holding its line breaks.
 * Runs of blank lines count as one break, and empty paragraphs are dropped. */
export function splitParagraphs(text?: string): string[] {
  return (text ?? "").split(/\n[^\S\n]*\n/).map((p) => p.replace(/^\n+|\n+$/g, "")).filter((p) => p.trim() !== "");
}

/** A copy field's paragraphs, each cut into runs at its pauses, with the
 * seconds the build waits before each run. A pause with nothing after it in
 * its paragraph carries over to the next; one at the very end is `trail`, a
 * wait before whatever builds after this copy. */
export function pausedParagraphs(text?: string): { paras: { wait: number; text: string }[][]; trail: number } {
  const paras: { wait: number; text: string }[][] = [];
  let carry = 0;
  for (const p of splitParagraphs(text)) {
    const runs: { wait: number; text: string }[] = [];
    for (const run of splitPauses(p)) {
      const wait = carry + run.wait;
      if (run.text.trim() === "") { carry = wait; continue; }
      carry = 0;
      runs.push({ wait, text: run.text });
    }
    if (runs.length) paras.push(runs);
  }
  return { paras, trail: carry };
}

/** What a build item needs to know about the copy in it, spread onto the
 * item: `custom`, the time of each pause from the item's start in the order
 * its runs are drawn, and `data-build`, how long it holds up the rest of the
 * slide. Pass every copy field the item draws, in drawing order; an item with
 * none still takes `built()`, so pausedContainer can count it. */
export function built(...texts: (string | undefined)[]): { custom: number[]; "data-build": number } {
  const ats: number[] = [];
  let t = 0;
  for (const text of texts) {
    const { paras, trail } = pausedParagraphs(text);
    for (const runs of paras) for (const run of runs) if (run.wait > 0) ats.push(t += run.wait);
    t += trail;
  }
  return { custom: ats, "data-build": t };
}

/** Copy as it was typed: a block per paragraph, PARA_GAP apart, and its line
 * breaks kept. Spans rather than <p>, so it can sit inside a heading or a
 * blockquote. `styled` runs the inline markup (renderStyledText); `nowrap`
 * breaks only where the author did; `lead` goes in front of the first
 * paragraph, inline with it. Inside a slide's build, a run after a pause is
 * a variant child of its item, which times it (built); elsewhere the pause is
 * just dropped. Every place copy is drawn goes through here. */
export function Paragraphs({ text, styled = false, nowrap = false, lead }: { text?: string; styled?: boolean; nowrap?: boolean; lead?: React.ReactNode }) {
  const building = useContext(BuildContext);
  const reduced = useReducedMotion();
  const draw = (s: string) => (styled ? renderStyledText(s) : s);
  return (
    <>
      {pausedParagraphs(text).paras.map((runs, i) => {
        const style: React.CSSProperties = { display: "block", marginTop: i ? PARA_GAP : 0, whiteSpace: nowrap ? "pre" : "pre-line" };
        // A paragraph that is one paused run arrives whole.
        if (building && runs.length === 1 && runs[0].wait > 0) {
          return (
            <motion.span key={i} variants={reduced ? reducedItem : revealBlock} style={style}>
              {i === 0 && lead}
              {draw(runs[0].text)}
            </motion.span>
          );
        }
        return (
          <span key={i} style={style}>
            {i === 0 && lead}
            {runs.map((run, j) => building && run.wait > 0
              ? <motion.span key={j} variants={reduced ? reducedItem : revealInline}>{draw(run.text)}</motion.span>
              : <Fragment key={j}>{draw(run.text)}</Fragment>)}
          </span>
        );
      })}
    </>
  );
}

/** Numbered annotation dots overlaid on the Annotated (showcase) image, matching
 * the numbered callouts. When `onMove` is provided (edit mode) each dot is
 * draggable to reposition it; otherwise only placed dots render, statically. */
export function ShowcaseDots({ notes, accent, onMove }: {
  notes: OverviewItem[];
  accent: string;
  onMove?: (id: string, x: number, y: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<string | null>(null);
  useEffect(() => {
    if (!drag || !onMove) return;
    const move = (e: PointerEvent) => {
      const r = ref.current?.getBoundingClientRect();
      if (!r || r.width === 0) return;
      const x = Math.min(97, Math.max(3, ((e.clientX - r.left) / r.width) * 100));
      const y = Math.min(94, Math.max(6, ((e.clientY - r.top) / r.height) * 100));
      onMove(drag, Math.round(x * 10) / 10, Math.round(y * 10) / 10);
    };
    const up = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, onMove]);

  return (
    <div ref={ref} style={{ position: "absolute", inset: 0, pointerEvents: onMove ? "auto" : "none", zIndex: 2 }}>
      {notes.map((it, i) => {
        const placed = it.x != null && it.y != null;
        if (!onMove && !placed) return null; // view mode: only placed dots
        const x = it.x ?? 8 + (i % 8) * 8; // unplaced dots stack along the top to grab
        const y = it.y ?? 8;
        return (
          <div
            key={it.id}
            onPointerDown={onMove ? (e) => { e.preventDefault(); setDrag(it.id); } : undefined}
            title={onMove ? "Drag to position" : undefined}
            style={{
              position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)",
              width: 30, height: 30, borderRadius: 999, background: accent, color: "#fff",
              fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center",
              fontVariantNumeric: "tabular-nums", border: "2px solid rgba(255,255,255,0.9)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.35)", userSelect: "none",
              cursor: onMove ? (drag === it.id ? "grabbing" : "grab") : "default",
              opacity: !placed && onMove ? 0.7 : 1, // unplaced dots read as "to be placed"
            }}
          >
            {i + 1}
          </div>
        );
      })}
    </div>
  );
}

// ─── Basic templates (iconAtomic spec) ─────────────────────────────
// Spec'd on a 1600×900 frame; scaled 0.8× into the 1280×720 stage so the
// proportions (150 margins, 575 columns, 40 gaps, the DM Sans type ramp) are
// exact. The Stage then scales the whole thing to any viewport.
export const B_M = 120;        // margin / gutter (150 × 0.8)
export const B_COL = 460;      // column width (575 × 0.8)
export const B_HALF = STAGE_W / 2; // 640 — a column half (out to the gutter midpoint)
export const B_GAP = 32;       // gap between eyebrow/title/body (40 × 0.8)
export const B_RADIUS = 13;    // image corner radius (16 × 0.8)
export const B_IMG_H = 480;    // Fit/Fill image box height (600 × 0.8)
export const B_BLACK = INK; // site "black" for title/body on light
export const B_RED = RED;

export function basicColors(theme: "light" | "dark" | "red" | "image", imageTextDark = false): { bg: string; eyebrow: string; title: string; body: string } {
  switch (theme) {
    case "dark": return { bg: "#000000", eyebrow: B_RED, title: "#ffffff", body: "#ffffff" };
    case "red": return { bg: B_RED, eyebrow: "#ffffff", title: "#ffffff", body: "#ffffff" };
    case "image": {
      // All text is white by default; the user can flip the whole set to black.
      const t = imageTextDark ? B_BLACK : "#ffffff";
      return { bg: "transparent", eyebrow: t, title: t, body: t };
    }
    default: return { bg: "#ffffff", eyebrow: B_RED, title: B_BLACK, body: B_BLACK };
  }
}

/** CTA pill for the Basic templates. Red/white by default (black on hover);
 * inverts to white/red on the Red theme where a red pill would vanish. */
/** The slide's button, or null for none. A link opens its URL in a new tab; a
 * next button moves the player on a step, and shows whether or not a URL was
 * ever typed. Either way a click on it is the button's alone — the player
 * also moves on for a click anywhere on a slide, and must not do it twice, or
 * at all for a link. */
export function slideButton(screen: Screen, onNext?: () => void): { href?: string; label: string; next: boolean; onClick: (e: React.MouseEvent) => void } | null {
  if (screen.linkAction === "next") {
    return { label: screen.linkLabel || "Next", next: true, onClick: (e) => { e.stopPropagation(); onNext?.(); } };
  }
  if (!screen.linkUrl && !screen.linkLabel) return null;
  return { href: screen.linkUrl, label: screen.linkLabel || "View prototype", next: false, onClick: (e) => e.stopPropagation() };
}

export function BasicCtaButton({ href, label, theme, onClick, ghost = false }: { href?: string; label?: string; theme: "light" | "dark" | "red" | "image"; onClick?: (e: React.MouseEvent) => void; ghost?: boolean }) {
  const [hover, setHover] = useState(false);
  const onRed = theme === "red";
  // Ghost is the same pill as a white 1px outline with no fill; the border
  // comes out of the padding, so the two are the same size.
  const style: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 8,
    background: ghost ? (hover ? "rgba(255,255,255,0.14)" : "transparent") : onRed ? (hover ? "#f0e6e6" : "#ffffff") : (hover ? "#000000" : B_RED),
    color: !ghost && onRed ? B_RED : "#ffffff",
    textDecoration: "none", border: ghost ? "1px solid #ffffff" : "none", borderRadius: 999, padding: ghost ? "12px 25px" : "13px 26px",
    fontSize: 16, fontWeight: 600, cursor: "pointer", width: "fit-content", transition: "background 0.15s ease",
  };
  const hoverProps = { onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false) };
  const external = href ? /^https?:\/\//i.test(href) : false;
  const text = label || "View prototype";
  return href
    ? <a href={href} style={style} onClick={onClick} {...hoverProps} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{text}</a>
    : <button type="button" style={style} onClick={onClick} {...hoverProps}>{text}</button>;
}

/** Eyebrow / Title / Body (+ optional CTA) for the Basic templates, per the
 * iconAtomic type ramp. Title/body sizes are overridable (Title Card runs
 * larger); the eyebrow is always the same size across all layouts. */
export function BasicText({ screen, colors, item, theme, titleSize = 51, bodySize = 19, gap = B_GAP, bodyColor, bodyLetterSpacing = "-0.01em", titleLetterSpacing = "0", onNext, onImage }: { screen: Screen; colors: { eyebrow: string; title: string; body: string }; item: Variants; theme: "light" | "dark" | "red" | "image"; titleSize?: number; bodySize?: number; gap?: number; bodyColor?: string; bodyLetterSpacing?: string; titleLetterSpacing?: string; onNext?: () => void; onImage?: (src: string) => void }) {
  const button = slideButton(screen, onNext);
  // The block fills its column's height, so an image under the body takes
  // what's left of it and shrinks rather than running off the slide.
  return (
    <div style={{ display: "flex", flexDirection: "column", gap, height: "100%", flex: "0 1 auto", minHeight: 0 }}>
      {/* No entrance: the eyebrow is anchored (see eyebrowEl in ScreenView). */}
      {screen.eyebrow && (
        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", lineHeight: 1, color: colors.eyebrow, whiteSpace: "pre-line", marginBottom: -10 }}>
          <BuildContext.Provider value={false}><Paragraphs text={screen.eyebrow} /></BuildContext.Provider>
        </div>
      )}
      {screen.title && (
        <motion.div variants={item} {...built(screen.title)} style={{ fontSize: titleSize, fontWeight: 700, letterSpacing: titleLetterSpacing, lineHeight: 1.3, color: colors.title, whiteSpace: "pre-line" }}>
          <Paragraphs text={screen.title} />
        </motion.div>
      )}
      {screen.body && (
        <motion.div variants={item} {...built(screen.body)} style={{ fontSize: bodySize, fontWeight: 400, letterSpacing: bodyLetterSpacing, lineHeight: 1.6, color: bodyColor ?? colors.body }}>
          <Paragraphs text={screen.body} />
        </motion.div>
      )}
      {/* The box takes the column's remaining height, a definite size, so the
          image can fit inside it at its own aspect: as large as it can be,
          never past its natural size, from the top left. */}
      {screen.bodyImage && (
        <motion.div variants={item} {...built()} style={{ flex: "1 1 0", minHeight: 0, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <LightboxTrigger onOpen={() => onImage?.(screen.bodyImage!)} style={{ display: "flex", flexDirection: "column", minHeight: 0, maxWidth: "100%", maxHeight: "100%" }}>
            <img src={screen.bodyImage} alt="" style={{ display: "block", maxWidth: "100%", maxHeight: "100%", minHeight: 0, objectFit: "contain", borderRadius: B_RADIUS }} />
          </LightboxTrigger>
        </motion.div>
      )}
      {button && (
        <motion.div variants={item} {...built()} style={{ width: "fit-content", marginTop: 8 }}>
          <BasicCtaButton href={button.href} label={button.label} theme={theme} onClick={button.onClick} ghost={screen.linkStyle === "ghost"} />
        </motion.div>
      )}
    </div>
  );
}

// ─── A single rendered screen ──────────────────────────────────────

export function ScreenView({ screen, play, reduced, cta, textScale = 1, card = false, onAnnotationMove, logoSrc, footnote, onNext }: { screen: Screen; play: boolean; reduced: boolean; cta?: React.ReactNode; textScale?: number; card?: boolean; onAnnotationMove?: (id: string, x: number, y: number) => void; logoSrc?: string; footnote?: string; onNext?: () => void }) {
  const item = reduced ? reducedItem : buildItem;
  // Full-bleed text layouts that manage their own margins (root uses no padding).
  const isBasic = screen.layout === "basic1" || screen.layout === "basic2" || screen.layout === "cover" || screen.layout === "quote";
  const { bg, fg } = themeColors(screen);

  // Gallery lightbox: clicking a thumbnail opens the full-size image. Rendered
  // via a portal so it escapes the scaled Stage and the player's nav click-zones.
  const [lightbox, setLightbox] = useState<{ src: string; caption?: string } | null>(null);
  useEffect(() => {
    if (!lightbox) return;
    // Capture-phase so Esc/arrows close the lightbox instead of the player navigating/exiting.
    const onKey = (e: KeyboardEvent) => {
      if (["Escape", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === "Escape") setLightbox(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [lightbox]);

  // Fit-to-page: if a slide's content is taller than the stage's safe area, scale
  // it down uniformly so nothing is cut off. Slides that fit are left at 1×.
  // scrollHeight is a layout measurement (unaffected by the CSS transform), so
  // this is stable and won't feedback-loop.
  const fitRef = useRef<HTMLDivElement>(null);
  const container = useMemo(() => pausedContainer(fitRef), []);
  const [fitScale, setFitScale] = useState(1);
  // The centered layouts share the Basic templates' margin, so their eyebrow
  // lands exactly where an Intro's does.
  const pad = card ? 100 : B_M;
  const availH = STAGE_H - (screen.layout === "overview" ? 0 : pad) * 2;
  useLayoutEffect(() => {
    // Full-bleed / split layouts manage their own margins and don't use the
    // uniform top-left fit-scale (it would drag text over an adjacent image half).
    if (screen.layout === "overview" || screen.layout === "basic1" || screen.layout === "basic2" || screen.layout === "cover" || screen.layout === "quote") { setFitScale(1); return; }
    const el = fitRef.current;
    if (!el) return;
    const compute = () => {
      const needH = el.scrollHeight;
      setFitScale(needH > availH ? availH / needH : 1);
    };
    compute();
    const ro = new ResizeObserver(compute); // recompute as fonts/images settle
    ro.observe(el);
    return () => ro.disconnect();
  }, [screen, availH]);


  const titleSize = 46 * textScale;
  // Pixel equivalent of the title's 15em cap at its own font size, so the body
  // can share the title's measure when desired.
  const titleMaxWidth = titleSize * 15;

  // The eyebrow makes no entrance. It sits in the same place on every slide
  // that has one, so moving from slide to slide it should hold still while the
  // rest arrives around it — the crossfade between the two slides is all the
  // change it gets, and an unchanged eyebrow doesn't visibly change at all.
  // Its type and spacing are the Intro's (BasicText): 20px at line height 1,
  // with 22px to the title (B_GAP less BasicText's -10 margin). It
  // counter-scales the fit-to-page shrink so it always renders at a constant
  // size, no matter how much text the slide has.
  const eyebrowEl = screen.eyebrow ? (
    <div style={{ marginBottom: B_GAP - 10 }}>
      <div
        style={{
          fontSize: 20, lineHeight: 1, letterSpacing: "0.18em", textTransform: "uppercase",
          fontWeight: 600, color: screen.accent, whiteSpace: "pre-line", width: "fit-content",
          transform: fitScale < 1 ? `scale(${1 / fitScale})` : undefined, transformOrigin: "left top",
        }}
      >
        <BuildContext.Provider value={false}><Paragraphs text={screen.eyebrow} /></BuildContext.Provider>
      </div>
    </div>
  ) : null;

  const titleEl = screen.title ? (
    <motion.h1
      variants={item}
      {...built(screen.title)}
      style={{
        fontSize: titleSize,
        lineHeight: 1.25, fontWeight: 700, letterSpacing: 0,
        margin: 0, maxWidth: titleMaxWidth, whiteSpace: "pre-line",
      }}
    >
      <Paragraphs text={screen.title} />
    </motion.h1>
  ) : null;

  const bodyEl = screen.body ? (
    <motion.div
      variants={item}
      {...built(screen.body)}
      style={{
        fontSize: 19 * textScale, lineHeight: 1.5, marginTop: 28, letterSpacing: card ? 0.5 : undefined,
        maxWidth: 640, opacity: 0.82, fontWeight: 400,
      }}
    >
      <Paragraphs text={screen.body} />
    </motion.div>
  ) : null;

  // Optional button: an outbound link (e.g. a Figma prototype) or a next
  // button (see slideButton). Uses the shared CaseStudyLink pill (red → black
  // on hover); wrapped in motion.div to keep the entrance stagger. A link
  // with no URL has nowhere to go, so these layouts leave it out.
  const button = slideButton(screen, onNext);
  const ctaEl = button && (button.next || button.href) ? (
    <motion.div variants={item} {...built()} style={{ marginTop: 32, width: "fit-content" }}>
      <CaseStudyLink href={button.href} onClick={button.onClick} ghost={screen.linkStyle === "ghost"} style={{ fontSize: 17 * textScale, padding: screen.linkStyle === "ghost" ? "13px 25px" : "14px 26px", gap: 8 }}>
        {button.label} {button.next ? <ArrowRight size={18 * textScale} /> : <ExternalLink size={18 * textScale} />}
      </CaseStudyLink>
    </motion.div>
  ) : null;

  // Top space the corner logo reserves (its box height + a gap), so a slide's
  // top-left content clears the logo the Stage pins to the viewport corner.
  const logoClear = screen.showLogo && logoSrc ? 104 : 0;
  // Bottom space the first slide's hint reserves (13px type + a gap), so an
  // image under the body, which runs to the column's foot, stops above it.
  const noteClear = footnote ? 37 : 0;

  // ── Layout-specific composition ──
  let inner: React.ReactNode;

  if (screen.layout === "metrics") {
    inner = (
      <div style={{ width: "100%", maxWidth: 1100 }}>
        {eyebrowEl}{titleEl}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 56, marginTop: 56 }}>
          {(screen.metrics ?? []).map((m) => (
            <motion.div key={m.id} variants={item} {...built(m.label)} style={{ minWidth: 160 }}>
              <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: "-0.03em", color: screen.accent, lineHeight: 1 }}>
                {m.value}
              </div>
              <div style={{ fontSize: 18, marginTop: 12, opacity: 0.7 }}><Paragraphs text={m.label} /></div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  } else if (screen.layout === "gallery") {
    // Triptych: header + a row of captioned images, each with a red index number.
    const placeholder = `color-mix(in srgb, ${fg} 8%, transparent)`;
    const imgs = screen.images ?? [];
    // One row for up to 5 images; wrap at 5 per row once there are 6+.
    const cols = imgs.length >= 6 ? 5 : Math.max(imgs.length, 1);
    inner = (
      <div style={{ width: "100%", maxWidth: 1160 }}>
        {eyebrowEl}{titleEl}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 32, marginTop: 48 }}>
          {imgs.map((img, i) => (
            <motion.div key={img.id} variants={item} {...built(img.caption)} style={{ minWidth: 0 }}>
              <LightboxTrigger
                onOpen={() => img.url && setLightbox({ src: img.url, caption: img.caption })}
                disabled={!img.url}
                style={{
                  display: "block", width: "100%",
                  aspectRatio: "4 / 3", borderRadius: 10, overflow: "hidden",
                  background: placeholder,
                }}
              >
                {img.url && <img src={img.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              </LightboxTrigger>
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                {(() => { const num = img.number ?? String(i + 1).padStart(2, "0"); return num.trim() !== "" ? (
                  <span style={{ color: screen.accent, fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{num}</span>
                ) : null; })()}
                <span style={{ fontSize: 14, opacity: 0.72, lineHeight: 1.4, whiteSpace: "pre-line" }}><Paragraphs text={img.caption} /></span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  } else if (screen.layout === "showcase") {
    // Annotated showcase: large hero image + numbered callouts down the side.
    const placeholder = `color-mix(in srgb, ${fg} 10%, transparent)`;
    const notes = screen.items ?? [];
    inner = (
      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 64, alignItems: "start", width: "100%", maxWidth: 1200 }}>
        {/* Left: eyebrow above the image */}
        <div style={{ minWidth: 0 }}>
          {eyebrowEl}
          <motion.div variants={item} {...built()} style={{ position: "relative", aspectRatio: "4 / 3", borderRadius: 12, overflow: "hidden", background: placeholder }}>
            {screen.imageUrl && <img src={screen.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
            <ShowcaseDots notes={notes} accent={screen.accent} onMove={onAnnotationMove} />
          </motion.div>
        </div>
        {/* Right: title + annotations */}
        <div style={{ minWidth: 0 }}>
          {screen.title && (
            <motion.h2 variants={item} {...built(screen.title)} style={{ fontSize: 36, lineHeight: 1.1, fontWeight: 700, margin: "0 0 28px", whiteSpace: "pre-line" }}>
              <Paragraphs text={screen.title} />
            </motion.h2>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {notes.map((it, i) => (
              <motion.div key={it.id} variants={item} {...built(it.label, it.body)} style={{ display: "grid", gridTemplateColumns: "32px 1fr", gap: 16, alignItems: "start" }}>
                <span style={{ width: 30, height: 30, borderRadius: 999, background: screen.accent, color: "#fff", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.01em", whiteSpace: "pre-line" }}><Paragraphs text={it.label} /></div>
                  <div style={{ fontSize: 14, opacity: 0.75, marginTop: 4, lineHeight: 1.5 }}><Paragraphs text={it.body} /></div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    );
  } else if (screen.layout === "bento") {
    // Bento mosaic: big image, accent stat block, text cell, and a small image.
    const placeholder = `color-mix(in srgb, ${fg} 10%, transparent)`;
    const stat = screen.metrics?.[0];
    const cellRadius = 12;
    const imgStyle: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };
    inner = (
      <div style={{ width: "100%", maxWidth: 1160 }}>
        {eyebrowEl}
        {screen.title && (
          <motion.h2 variants={item} {...built(screen.title)} style={{ fontSize: 36, lineHeight: 1.1, fontWeight: 700, margin: "0 0 28px", whiteSpace: "pre-line" }}>
            <Paragraphs text={screen.title} />
          </motion.h2>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 18, height: 360 }}>
          <motion.div variants={item} {...built()} style={{ gridColumn: "1", gridRow: "1 / 3", borderRadius: cellRadius, overflow: "hidden", background: placeholder }}>
            {screen.imageUrl && <img src={screen.imageUrl} alt="" style={imgStyle} />}
          </motion.div>
          <motion.div variants={item} {...built(stat?.label)} style={{ gridColumn: "2 / 4", gridRow: "1", borderRadius: cellRadius, background: screen.accent, color: "#fff", padding: 28, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: 0, lineHeight: 1 }}>{stat?.value}</div>
            <div style={{ fontSize: 16, marginTop: 10, opacity: 0.85 }}><Paragraphs text={stat?.label} /></div>
          </motion.div>
          <motion.div variants={item} {...built()} style={{ gridColumn: "2", gridRow: "2", borderRadius: cellRadius, overflow: "hidden", background: placeholder }}>
            {screen.imageUrl2 && <img src={screen.imageUrl2} alt="" style={imgStyle} />}
          </motion.div>
          <motion.div variants={item} {...built(screen.body)} style={{ gridColumn: "3", gridRow: "2", borderRadius: cellRadius, background: bg, padding: 22, display: "flex", alignItems: "center" }}>
            <div style={{ fontSize: 15, lineHeight: 1.5, opacity: 0.85 }}><Paragraphs text={screen.body} /></div>
          </motion.div>
        </div>
      </div>
    );
  } else if (screen.layout === "cover") {
    // Title Card: the Basic 1-column template with larger text (scale 1.25).
    // Same themes (Light / Dark / Red / Image + gradient) and optional button.
    const theme = screen.basicTheme ?? "light";
    const c = basicColors(theme, screen.imageTextDark);
    inner = (
      <div style={{ position: "absolute", inset: 0, background: c.bg, overflow: "hidden" }}>
        {/* Image-theme background bleeds the whole viewport via a Stage backdrop (see backdropFor). */}
        {/* When a logo is shown it sits at the top margin; push the text below it. */}
        <div style={{ position: "absolute", left: B_M, top: B_M + logoClear, right: B_M, bottom: B_M + noteClear, zIndex: 1 }}>
          {/* Title 88 / body 44 at design scale (×0.8 into the stage); larger than Basic.
              Body is medium-dark gray on light theme (stays white on dark/red/image), tracking 0. */}
          <BasicText screen={screen} colors={c} item={item} onNext={onNext} onImage={(src) => setLightbox({ src })} theme={theme} titleSize={88 * 0.8} bodySize={44 * 0.8} gap={40}
            bodyColor={theme === "light" ? "#808080" : undefined} bodyLetterSpacing="0.01em" titleLetterSpacing="1px" />
        </div>
      </div>
    );
  } else if (screen.layout === "overview") {
    // Intro: left half = Basic 1-column (themed); right half (always white) = a
    // list of project data points (label + value), count set by the user.
    const theme = screen.basicTheme ?? "light";
    const c = basicColors(theme, screen.imageTextDark);
    const points = screen.items ?? [];
    inner = (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        {/* Right half — always white (holds the data points) */}
        <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: B_HALF, background: "#ffffff" }} />
        {/* Left half — themed; the Image theme bleeds the viewport via a Stage backdrop (see backdropFor) */}
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: B_HALF, background: c.bg }} />
        {/* Left text — the Basic 1-column content block */}
        <div style={{ position: "absolute", left: B_M, top: B_M + logoClear, bottom: B_M + noteClear, width: B_COL, zIndex: 1, display: "flex", flexDirection: "column" }}>
          <BasicText screen={screen} colors={c} item={item} onNext={onNext} onImage={(src) => setLightbox({ src })} theme={theme} titleLetterSpacing="1px" />
          {cta && <motion.div variants={item} {...built()} style={{ marginTop: 32, width: "fit-content" }}>{cta}</motion.div>}
        </div>
        {/* Right data points */}
        <div style={{ position: "absolute", left: STAGE_W - B_M - B_COL, top: B_M, width: B_COL, zIndex: 1, display: "flex", flexDirection: "column" }}>
          {points.map((it, i) => (
            <div key={it.id}>
              {i > 0 && <div style={{ height: 1, background: "#e5e3df", margin: "18px 0" }} />}
              <motion.div variants={item} {...built(it.label, it.body)} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", lineHeight: 1.6, color: B_RED, whiteSpace: "nowrap", flexShrink: 0 }}><Paragraphs text={it.label} nowrap /></div>
                <div style={{ width: "68%", flexShrink: 0, fontSize: 16, fontWeight: 400, letterSpacing: "0", lineHeight: 1.6, color: B_BLACK }}>
                  <Paragraphs text={it.body} />
                </div>
              </motion.div>
            </div>
          ))}
        </div>
      </div>
    );
  } else if (screen.layout === "quote") {
    // Pull-quote on a themed full-bleed background (Light / Dark / Red / Image),
    // using the same theme model as the Basic layouts.
    const theme = screen.basicTheme ?? "light";
    const c = basicColors(theme, screen.imageTextDark);
    inner = (
      <div style={{ position: "absolute", inset: 0, background: c.bg, overflow: "hidden" }}>
        {/* Image-theme background bleeds the whole viewport via a Stage backdrop (see backdropFor). */}
        <div style={{ position: "absolute", left: B_M, top: B_M + logoClear, right: B_M, bottom: B_M, zIndex: 1, textAlign: "left" }}>
          {/* No entrance: the eyebrow is anchored (see eyebrowEl). */}
          {screen.eyebrow && (
            <div style={{ fontSize: 20, lineHeight: 1, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600, color: c.eyebrow, marginBottom: 30, whiteSpace: "pre-line" }}>
              <BuildContext.Provider value={false}><Paragraphs text={screen.eyebrow} /></BuildContext.Provider>
            </div>
          )}
          <motion.div variants={item} {...built()} aria-hidden="true" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 128, lineHeight: 0.85, fontWeight: 700, color: c.eyebrow, marginBottom: 8 }}>
            &ldquo;
          </motion.div>
          {screen.title && (
            <motion.blockquote variants={item} {...built(screen.title)} style={{ fontSize: 46, lineHeight: 1.32, fontWeight: 700, letterSpacing: 0, margin: "-30px 0 0", maxWidth: 920, color: c.title, whiteSpace: "pre-line" }}>
              <Paragraphs text={screen.title} />
            </motion.blockquote>
          )}
          {screen.body && (
            <motion.div variants={item} {...built(screen.body)} style={{ fontSize: 19, marginTop: 32, fontWeight: 500, fontStyle: "italic", color: c.body, whiteSpace: "pre-line" }}>
              <Paragraphs text={screen.body} lead={<span style={{ color: c.eyebrow }}>&mdash; </span>} />
            </motion.div>
          )}
        </div>
      </div>
    );
  } else if (screen.layout === "basic1") {
    // Basic 1-column: full-bleed background (color or image) + a text block
    // inset by a uniform margin, top/left aligned.
    const theme = screen.basicTheme ?? "light";
    const c = basicColors(theme, screen.imageTextDark);
    inner = (
      <div style={{ position: "absolute", inset: 0, background: c.bg, overflow: "hidden" }}>
        {/* Image-theme background bleeds the whole viewport via a Stage backdrop (see backdropFor). */}
        <div style={{ position: "absolute", left: B_M, top: B_M + logoClear, right: B_M, bottom: B_M + noteClear, zIndex: 1 }}>
          <BasicText screen={screen} colors={c} item={item} onNext={onNext} onImage={(src) => setLightbox({ src })} theme={theme} />
        </div>
      </div>
    );
  } else if (screen.layout === "basic2") {
    // Basic 2-column: text on one half (theme-colored), optional image on the
    // other (always white). Column grid = margin · col · gutter · col · margin.
    const theme = screen.basicTheme === "image" ? "light" : (screen.basicTheme ?? "light");
    const c = basicColors(theme, screen.imageTextDark);
    const textLeft = (screen.basicTextSide ?? "left") === "left";
    const imgMode = screen.basicImage ?? "off";
    const textX = textLeft ? B_M : STAGE_W - B_M - B_COL;
    const imgColX = textLeft ? STAGE_W - B_M - B_COL : B_M; // opposite column
    // "bleed" renders as a Stage backdrop (fills the viewport past the 16:9 safe
    // area — see backdropFor), so its half of the content stays transparent.
    const bleed = imgMode === "bleed" && !!screen.imageUrl;
    // Fit / Fill / Desktop / Mobile images open the full image in a lightbox on click.
    const openLightbox = () => screen.imageUrl && setLightbox({ src: screen.imageUrl });
    const imageEl = imgMode === "off" || !screen.imageUrl || imgMode === "bleed" ? null
      : imgMode === "fill" ? (
        <LightboxTrigger onOpen={openLightbox} style={{ position: "absolute", left: imgColX, top: B_M, width: B_COL, height: B_IMG_H, borderRadius: B_RADIUS, overflow: "hidden", zIndex: 1 }}>
          <img src={screen.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: screen.mono === true ? MONO_FILTER : undefined }} />
          {screen.overlay === true && <div style={{ position: "absolute", inset: 0, background: OVERLAY_GRADIENT }} />}
        </LightboxTrigger>
      ) : imgMode === "fit" ? (
        <LightboxTrigger onOpen={openLightbox} style={{ position: "absolute", left: imgColX, top: B_M, width: B_COL, zIndex: 1 }}>
          <img src={screen.imageUrl} alt="" style={{ maxWidth: "100%", maxHeight: B_IMG_H, borderRadius: B_RADIUS, display: "block" }} />
        </LightboxTrigger>
      ) : (
        <LightboxTrigger onOpen={openLightbox} style={{ position: "absolute", left: imgColX, top: 0, bottom: 0, width: B_COL, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
          <CaseStudyThumb src={screen.imageUrl} frame={imgMode === "mobile" ? "iphone" : "computer"} phoneWidth={210} fill />
        </LightboxTrigger>
      );
    inner = (
      <div style={{ position: "absolute", inset: 0, background: bleed ? "transparent" : "#ffffff", overflow: "hidden" }}>
        {/* When bleeding, the image half is transparent (backdrop shows through);
            keep the text half white so it — and the letterbox — read as the frame. */}
        {bleed && (
          <div style={{ position: "absolute", top: 0, bottom: 0, width: B_HALF, left: textLeft ? 0 : undefined, right: textLeft ? undefined : 0, background: "#ffffff" }} />
        )}
        {theme !== "light" && (
          <div style={{ position: "absolute", top: 0, bottom: 0, width: B_HALF, left: textLeft ? 0 : undefined, right: textLeft ? undefined : 0, background: c.bg }} />
        )}
        {imageEl}
        <div style={{ position: "absolute", left: textX, top: textLeft ? B_M + logoClear : B_M, bottom: B_M + noteClear, width: B_COL, zIndex: 2 }}>
          <BasicText screen={screen} colors={c} item={item} onNext={onNext} onImage={(src) => setLightbox({ src })} theme={theme} />
        </div>
      </div>
    );
  } else if (screen.layout === "video") {
    // Embedded, playable video (YouTube/Vimeo iframe or a direct .mp4).
    const embedUrl = getVideoEmbedUrl(screen.videoUrl ?? "");
    const rawVideo = screen.videoUrl && isVideoSrc(screen.videoUrl) ? screen.videoUrl : "";
    inner = (
      <div style={{ width: "100%", maxWidth: 1160 }}>
        {eyebrowEl}{titleEl}
        <motion.div variants={item} {...built()} style={{ marginTop: screen.eyebrow || screen.title ? 40 : 0, width: "100%", aspectRatio: "16 / 9", borderRadius: 12, overflow: "hidden", background: "#000" }}>
          {embedUrl ? (
            <iframe src={embedUrl} style={{ width: "100%", height: "100%", border: "none" }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          ) : rawVideo ? (
            <video src={rawVideo} controls playsInline style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#8a857d", fontSize: 16 }}>Add a YouTube, Vimeo, or .mp4 URL</div>
          )}
        </motion.div>
        {ctaEl}
      </div>
    );
  } else {
    // statement
    inner = (
      <div style={{ maxWidth: 1100, textAlign: "left", margin: 0 }}>
        {eyebrowEl}{titleEl}{bodyEl}{ctaEl}
      </div>
    );
  }

  // Project logo, top-left. It lives in the same (scaled) stage coordinate space
  // as the text, at the same left margin, so the two always share a left edge.
  const fullBleed = isBasic || screen.layout === "overview";
  const logoLeft = fullBleed ? B_M : pad;
  // A line from the host at the foot of the content area (the player's "how
  // to move on" on its first slide). It isn't the slide's, so it isn't one of
  // its build items: it waits out the whole build, pauses included, and then
  // fades in. It sits on the copy's column, in the copy's color at a whisper.
  const [noteRef, animateNote] = useAnimate<HTMLDivElement>();
  useEffect(() => {
    if (!footnote || !play || !noteRef.current) return;
    const run = animateNote(noteRef.current, { opacity: 1 }, { delay: buildLength(fitRef.current) + 0.5, duration: reduced ? 0.3 : 0.65 });
    return () => run.stop();
  }, [footnote, play, reduced, screen]);
  const noteLeft = screen.layout === "basic2" && screen.basicTextSide === "right" ? STAGE_W - B_M - B_COL : fullBleed ? B_M : pad;
  const noteColor = fullBleed
    ? basicColors(screen.layout === "basic2" && screen.basicTheme === "image" ? "light" : (screen.basicTheme ?? "light"), screen.imageTextDark).body
    : fg;
  const noteEl = footnote ? (
    <div ref={noteRef} style={{ position: "absolute", left: noteLeft, bottom: fullBleed ? B_M : pad, zIndex: 3, fontSize: 13, lineHeight: 1, color: noteColor, opacity: play ? 0 : 1, pointerEvents: "none" }}>
      <span style={{ opacity: 0.8 }}>{footnote}</span>
    </div>
  ) : null;

  const logoEl = screen.showLogo && logoSrc ? (
    <div style={{ position: "absolute", left: logoLeft, top: 12, width: 300, height: 80, zIndex: 3, pointerEvents: "none" }}>
      <LogoMark src={logoSrc} position="left top" style={{ width: "100%", height: "100%" }} />
    </div>
  ) : null;

  return (
    <div
      style={{
        position: "relative",
        width: STAGE_W, height: STAGE_H, background: isBasic || (screen.layout === "overview" && screen.imageUrl) ? "transparent" : bg, color: fg,
        display: "flex",
        // Full-bleed layouts (Basic / Title Card / Intro) stretch to fill the stage
        // and manage their own margins; everything else is a centered content block.
        alignItems: (screen.layout === "overview" || isBasic) ? "stretch" : "flex-start",
        justifyContent: "center",
        padding: screen.layout === "overview" || isBasic ? 0 : pad, overflow: "hidden", boxSizing: "border-box",
        // Centered-flow layouts reserve extra top space for the corner logo.
        ...(screen.layout === "overview" || isBasic ? {} : { paddingTop: pad + logoClear }),
      }}
    >
      {/* Fit-to-page wrapper: shrinks the slide's content to fit when it overflows. */}
      <div
        ref={fitRef}
        style={{
          width: "100%",
          height: screen.layout === "overview" || isBasic ? "100%" : undefined,
          transform: fitScale < 1 && screen.layout !== "overview" ? `scale(${fitScale})` : undefined,
          transformOrigin: "top left",
        }}
      >
        <motion.div
          variants={container}
          initial={play ? "hidden" : "show"}
          animate="show"
          style={{ position: "relative", zIndex: 1, width: "100%", height: screen.layout === "overview" || isBasic ? "100%" : undefined, display: "flex", justifyContent: "flex-start" }}
        >
          <BuildContext.Provider value={true}>{inner}</BuildContext.Provider>
        </motion.div>
      </div>
      {logoEl}
      {noteEl}
      {lightbox && <Lightbox src={lightbox.src} caption={lightbox.caption} onClose={() => setLightbox(null)} />}
    </div>
  );
}


