import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Lightbox, LightboxTrigger } from "./ui/Lightbox.js";
import { motion, Variants } from "motion/react";
import { ExternalLink } from "lucide-react";
import { CaseStudyThumb } from "./ui/CaseStudyThumb.js";
import { CaseStudyLink } from "./ui/CaseStudyLink.js";
import { LogoMark } from "./ui/LogoMark.js";
import { getVideoEmbedUrl, isVideoSrc } from "./video.js";
import { RED, INK, DEFAULT_ACCENT } from "./theme.js";

// ─── Data model ────────────────────────────────────────────────────
// A case study is an ordered list of Screens. Each screen is presented
// one-at-a-time, transitions in with a "spatial push", and builds itself
// up by staggering its parts (eyebrow → title → body → media).

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
  overlay?: boolean;   // Image-theme gradient toggle (Basic / Title Card / Intro)
  videoUrl?: string;   // "video" layout: YouTube/Vimeo/mp4 to embed
  linkUrl?: string;    // optional outbound CTA (e.g. a Figma prototype) — opens in a new tab
  linkLabel?: string;  // CTA button label (defaults to "View prototype")
  basicTheme?: "light" | "dark" | "red" | "image"; // Basic templates (image = basic1 only)
  basicTextSide?: "left" | "right"; // Basic 2-column: which half the text sits in
  basicImage?: "off" | "fit" | "fill" | "bleed" | "desktop" | "mobile"; // Basic 2-column image on the opposite half
  imageTextDark?: boolean; // Image theme: black text instead of the default white
  showLogo?: boolean;   // display the slide logo on this screen
  metrics?: Metric[];
  items?: OverviewItem[];
  images?: GalleryImage[];
  caseNumber?: string;
}

export interface ProjectPreview {
  image?: string;
  imageOverlay?: boolean; // gradient overlay on the card image (default off)
  eyebrow?: string;
  title?: string;
  body?: string;
  logo?: string;         // logo shown on the presentation slides (Intro / Title Card, top-left)
  cardLogo?: string;     // logo shown on the Projects page preview card (falls back to `logo`)
  /** @deprecated Ignored. Each site that shows projects picks which ones itself. */
  show?: boolean;
}

export interface CaseStudyContent {
  schemaVersion?: number; // see migrate() in project.ts; absent = saved before versioning
  title?: string;         // the project's name, for apps that don't keep it elsewhere
  draft?: boolean;        // ProjectBuilder: left out of the published build (default false)
  screens: Screen[];
  preview?: ProjectPreview; // the Projects-page preview card, authored here
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

export const DEFAULT_CONTENT: CaseStudyContent = {
  screens: [
    {
      id: "s1",
      layout: "overview",
      theme: "light",
      bg: THEMES.light.bg,
      fg: THEMES.light.fg,
      accent: DEFAULT_ACCENT,
      eyebrow: "Case Study",
      title: "Reinventing the cancer-screening workflow",
      body: "How a clinician-first redesign cut order errors and gave a brand-new diagnostic its first real product.",
      items: DEFAULT_OVERVIEW_ITEMS,
    },
    {
      id: "s2",
      layout: "cover",
      basicTheme: "light",
      theme: "light",
      bg: THEMES.light.bg,
      fg: THEMES.light.fg,
      accent: DEFAULT_ACCENT,
      eyebrow: "The problem",
      title: "Nobody had ever ordered a test like this before.",
      body: "There was no precedent, no workflow, and no requirements — just a novel blood test and a thousand open questions about how it would actually reach a patient.",
    },
    {
      id: "s3",
      layout: "basic2",
      basicTheme: "light",
      basicTextSide: "left",
      basicImage: "fill",
      theme: "light",
      bg: THEMES.light.bg,
      fg: THEMES.light.fg,
      accent: DEFAULT_ACCENT,
      eyebrow: "Research",
      title: "100+ conversations with the people in the loop",
      body: "Clinicians, lab techs, IT admins, and support agents. We mapped every hand-off from order to result and found where the workflow quietly broke.",
      imageUrl: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200&q=80",
    },
    {
      id: "s-quote",
      layout: "quote",
      theme: "light",
      bg: THEMES.light.bg,
      fg: THEMES.light.fg,
      accent: DEFAULT_ACCENT,
      eyebrow: "From the field",
      title: "For the first time, I could place an order without second-guessing a single step.",
      body: "Dr. Lena Ortiz, Oncologist",
    },
    {
      id: "s4",
      layout: "metrics",
      theme: "light",
      bg: THEMES.light.bg,
      fg: THEMES.light.fg,
      accent: DEFAULT_ACCENT,
      eyebrow: "Outcome",
      title: "What changed",
      metrics: [
        { id: "m1", value: "−63%", label: "Order entry errors" },
        { id: "m2", value: "8→2", label: "Steps to place an order" },
        { id: "m3", value: "1st", label: "Design system at the company" },
      ],
    },
  ],
};

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
export function BleedBackdrop({ url, overlay, half }: { url: string; overlay: boolean; half?: "left" | "right" }) {
  const pos: React.CSSProperties = half
    ? { top: 0, bottom: 0, width: "50%", left: half === "left" ? 0 : undefined, right: half === "right" ? 0 : undefined }
    : { inset: 0 };
  return (
    <div style={{ position: "absolute", ...pos, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `url("${url}")`, backgroundSize: "cover", backgroundPosition: "center" }} />
      {overlay && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0))" }} />}
    </div>
  );
}

/** Which background image (if any) escapes the 16:9 stage to bleed the whole
 * container: the Basic 2-column "bleed" image (its half) and every Image-theme
 * background (full, or the left half for Intro). */
export function backdropFor(screen: Screen): React.ReactNode {
  if (screen.layout === "basic2" && screen.basicImage === "bleed" && screen.imageUrl) {
    const textLeft = (screen.basicTextSide ?? "left") === "left";
    return <BleedBackdrop url={screen.imageUrl} overlay={screen.overlay === true} half={textLeft ? "right" : "left"} />;
  }
  if (screen.basicTheme === "image" && screen.imageUrl &&
      (screen.layout === "basic1" || screen.layout === "cover" || screen.layout === "quote" || screen.layout === "overview")) {
    return <BleedBackdrop url={screen.imageUrl} overlay={screen.overlay !== false} half={screen.layout === "overview" ? "left" : undefined} />;
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

export const buildItem: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } },
};

export const reducedItem: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3 } },
};

// Space between body paragraphs = 75% of the font size. Applied by rendering
// each newline-separated paragraph as its own <p> inside a flex column whose
// `gap` is set to PARA_GAP (em = the container's font size).
export const PARA_GAP = "0.75em";
export function Paragraphs({ text }: { text?: string }) {
  const paras = (text ?? "").split("\n").filter((l) => l.trim() !== "");
  return <>{paras.map((p, i) => <p key={i} style={{ margin: 0 }}>{p}</p>)}</>;
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
export function BasicCtaButton({ href, label, theme }: { href?: string; label?: string; theme: "light" | "dark" | "red" | "image" }) {
  const [hover, setHover] = useState(false);
  const onRed = theme === "red";
  const style: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 8,
    background: onRed ? (hover ? "#f0e6e6" : "#ffffff") : (hover ? "#000000" : B_RED),
    color: onRed ? B_RED : "#ffffff",
    textDecoration: "none", border: "none", borderRadius: 999, padding: "13px 26px",
    fontSize: 16, fontWeight: 600, cursor: "pointer", width: "fit-content", transition: "background 0.15s ease",
  };
  const hoverProps = { onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false) };
  const external = href ? /^https?:\/\//i.test(href) : false;
  const text = label || "View prototype";
  return href
    ? <a href={href} style={style} {...hoverProps} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{text}</a>
    : <span style={style} {...hoverProps}>{text}</span>;
}

/** Eyebrow / Title / Body (+ optional CTA) for the Basic templates, per the
 * iconAtomic type ramp. Title/body sizes are overridable (Title Card runs
 * larger); the eyebrow is always the same size across all layouts. */
export function BasicText({ screen, colors, item, theme, titleSize = 51, bodySize = 19, gap = B_GAP, bodyColor, bodyLetterSpacing = "-0.01em", titleLetterSpacing = "0" }: { screen: Screen; colors: { eyebrow: string; title: string; body: string }; item: Variants; theme: "light" | "dark" | "red" | "image"; titleSize?: number; bodySize?: number; gap?: number; bodyColor?: string; bodyLetterSpacing?: string; titleLetterSpacing?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {screen.eyebrow && (
        <motion.div variants={item} style={{ fontSize: 20, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", lineHeight: 1, color: colors.eyebrow, whiteSpace: "pre-line", marginBottom: -10 }}>
          {screen.eyebrow}
        </motion.div>
      )}
      {screen.title && (
        <motion.div variants={item} style={{ fontSize: titleSize, fontWeight: 700, letterSpacing: titleLetterSpacing, lineHeight: 1.3, color: colors.title, whiteSpace: "pre-line" }}>
          {screen.title}
        </motion.div>
      )}
      {screen.body && (
        <motion.div variants={item} style={{ fontSize: bodySize, fontWeight: 400, letterSpacing: bodyLetterSpacing, lineHeight: 1.6, color: bodyColor ?? colors.body, display: "flex", flexDirection: "column", gap: PARA_GAP }}>
          <Paragraphs text={screen.body} />
        </motion.div>
      )}
      {(screen.linkUrl || screen.linkLabel) && (
        <motion.div variants={item} style={{ width: "fit-content", marginTop: 8 }}>
          <BasicCtaButton href={screen.linkUrl} label={screen.linkLabel} theme={theme} />
        </motion.div>
      )}
    </div>
  );
}

// ─── A single rendered screen ──────────────────────────────────────

export function ScreenView({ screen, play, reduced, cta, textScale = 1, card = false, onAnnotationMove, logoSrc }: { screen: Screen; play: boolean; reduced: boolean; cta?: React.ReactNode; textScale?: number; card?: boolean; onAnnotationMove?: (id: string, x: number, y: number) => void; logoSrc?: string }) {
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
  const [fitScale, setFitScale] = useState(1);
  const availH = STAGE_H - (screen.layout === "overview" ? 0 : 112) * 2;
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

  const eyebrowEl = screen.eyebrow ? (
    // The inner div counter-scales the fit-to-page shrink so the eyebrow always
    // renders at a constant size, no matter how much text the slide has. (motion
    // owns the outer transform for the entrance animation, so keep them separate.)
    <motion.div variants={item} style={{ marginBottom: 24 }}>
      <div
        style={{
          fontSize: 16 * textScale, letterSpacing: "0.18em", textTransform: "uppercase",
          fontWeight: 600, color: screen.accent, whiteSpace: "pre-line", width: "fit-content",
          transform: fitScale < 1 ? `scale(${1 / fitScale})` : undefined, transformOrigin: "left top",
        }}
      >
        {screen.eyebrow}
      </div>
    </motion.div>
  ) : null;

  const titleEl = screen.title ? (
    <motion.h1
      variants={item}
      style={{
        fontSize: titleSize,
        lineHeight: 1.25, fontWeight: 700, letterSpacing: 0,
        margin: 0, maxWidth: titleMaxWidth, whiteSpace: "pre-line",
      }}
    >
      {screen.title}
    </motion.h1>
  ) : null;

  const bodyEl = screen.body ? (
    <motion.div
      variants={item}
      style={{
        fontSize: 19 * textScale, lineHeight: 1.5, marginTop: 28, letterSpacing: card ? 0.5 : undefined,
        maxWidth: 640, opacity: 0.82, fontWeight: 400,
        display: "flex", flexDirection: "column", gap: PARA_GAP,
      }}
    >
      <Paragraphs text={screen.body} />
    </motion.div>
  ) : null;

  // Optional outbound CTA (e.g. a Figma prototype). Uses the shared CaseStudyLink
  // pill (red → black on hover); wrapped in motion.div to keep the entrance stagger.
  const ctaEl = screen.linkUrl ? (
    <motion.div variants={item} style={{ marginTop: 32, width: "fit-content" }}>
      <CaseStudyLink href={screen.linkUrl} style={{ fontSize: 17 * textScale, padding: "14px 26px", gap: 8 }}>
        {screen.linkLabel || "View prototype"} <ExternalLink size={18 * textScale} />
      </CaseStudyLink>
    </motion.div>
  ) : null;

  // Top space the corner logo reserves (its box height + a gap), so a slide's
  // top-left content clears the logo the Stage pins to the viewport corner.
  const logoClear = screen.showLogo && logoSrc ? 104 : 0;

  // ── Layout-specific composition ──
  let inner: React.ReactNode;

  if (screen.layout === "metrics") {
    inner = (
      <div style={{ width: "100%", maxWidth: 1100 }}>
        {eyebrowEl}{titleEl}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 56, marginTop: 56 }}>
          {(screen.metrics ?? []).map((m) => (
            <motion.div key={m.id} variants={item} style={{ minWidth: 160 }}>
              <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: "-0.03em", color: screen.accent, lineHeight: 1 }}>
                {m.value}
              </div>
              <div style={{ fontSize: 18, marginTop: 12, opacity: 0.7 }}>{m.label}</div>
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
            <motion.div key={img.id} variants={item} style={{ minWidth: 0 }}>
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
                <span style={{ fontSize: 14, opacity: 0.72, lineHeight: 1.4, whiteSpace: "pre-line" }}>{img.caption}</span>
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
          <motion.div variants={item} style={{ position: "relative", aspectRatio: "4 / 3", borderRadius: 12, overflow: "hidden", background: placeholder }}>
            {screen.imageUrl && <img src={screen.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
            <ShowcaseDots notes={notes} accent={screen.accent} onMove={onAnnotationMove} />
          </motion.div>
        </div>
        {/* Right: title + annotations */}
        <div style={{ minWidth: 0 }}>
          {screen.title && (
            <motion.h2 variants={item} style={{ fontSize: 36, lineHeight: 1.1, fontWeight: 700, margin: "0 0 28px", whiteSpace: "pre-line" }}>
              {screen.title}
            </motion.h2>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {notes.map((it, i) => (
              <motion.div key={it.id} variants={item} style={{ display: "grid", gridTemplateColumns: "32px 1fr", gap: 16, alignItems: "start" }}>
                <span style={{ width: 30, height: 30, borderRadius: 999, background: screen.accent, color: "#fff", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.01em", whiteSpace: "pre-line" }}>{it.label}</div>
                  <div style={{ fontSize: 14, opacity: 0.75, marginTop: 4, lineHeight: 1.5, display: "flex", flexDirection: "column", gap: PARA_GAP }}><Paragraphs text={it.body} /></div>
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
          <motion.h2 variants={item} style={{ fontSize: 36, lineHeight: 1.1, fontWeight: 700, margin: "0 0 28px", whiteSpace: "pre-line" }}>
            {screen.title}
          </motion.h2>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 18, height: 360 }}>
          <motion.div variants={item} style={{ gridColumn: "1", gridRow: "1 / 3", borderRadius: cellRadius, overflow: "hidden", background: placeholder }}>
            {screen.imageUrl && <img src={screen.imageUrl} alt="" style={imgStyle} />}
          </motion.div>
          <motion.div variants={item} style={{ gridColumn: "2 / 4", gridRow: "1", borderRadius: cellRadius, background: screen.accent, color: "#fff", padding: 28, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: 0, lineHeight: 1 }}>{stat?.value}</div>
            <div style={{ fontSize: 16, marginTop: 10, opacity: 0.85 }}>{stat?.label}</div>
          </motion.div>
          <motion.div variants={item} style={{ gridColumn: "2", gridRow: "2", borderRadius: cellRadius, overflow: "hidden", background: placeholder }}>
            {screen.imageUrl2 && <img src={screen.imageUrl2} alt="" style={imgStyle} />}
          </motion.div>
          <motion.div variants={item} style={{ gridColumn: "3", gridRow: "2", borderRadius: cellRadius, background: bg, padding: 22, display: "flex", alignItems: "center" }}>
            <div style={{ fontSize: 15, lineHeight: 1.5, opacity: 0.85, display: "flex", flexDirection: "column", gap: PARA_GAP }}><Paragraphs text={screen.body} /></div>
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
        <div style={{ position: "absolute", left: B_M, top: B_M + logoClear, right: B_M, bottom: B_M, zIndex: 1 }}>
          {/* Title 88 / body 44 at design scale (×0.8 into the stage); larger than Basic.
              Body is medium-dark gray on light theme (stays white on dark/red/image), tracking 0. */}
          <BasicText screen={screen} colors={c} item={item} theme={theme} titleSize={88 * 0.8} bodySize={44 * 0.8} gap={40}
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
        <div style={{ position: "absolute", left: B_M, top: B_M + logoClear, width: B_COL, zIndex: 1 }}>
          <BasicText screen={screen} colors={c} item={item} theme={theme} titleLetterSpacing="1px" />
          {cta && <motion.div variants={item} style={{ marginTop: 32, width: "fit-content" }}>{cta}</motion.div>}
        </div>
        {/* Right data points */}
        <div style={{ position: "absolute", left: STAGE_W - B_M - B_COL, top: B_M, width: B_COL, zIndex: 1, display: "flex", flexDirection: "column" }}>
          {points.map((it, i) => (
            <div key={it.id}>
              {i > 0 && <div style={{ height: 1, background: "#e5e3df", margin: "18px 0" }} />}
              <motion.div variants={item} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", lineHeight: 1.6, color: B_RED, whiteSpace: "nowrap", flexShrink: 0 }}>{it.label}</div>
                <div style={{ width: "68%", flexShrink: 0, fontSize: 16, fontWeight: 400, letterSpacing: "0", lineHeight: 1.6, color: B_BLACK, display: "flex", flexDirection: "column", gap: PARA_GAP }}>
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
          {screen.eyebrow && (
            <motion.div variants={item} style={{ fontSize: 20, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600, color: c.eyebrow, marginBottom: 24, whiteSpace: "pre-line" }}>
              {screen.eyebrow}
            </motion.div>
          )}
          <motion.div variants={item} aria-hidden="true" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 128, lineHeight: 0.85, fontWeight: 700, color: c.eyebrow, marginBottom: 8 }}>
            &ldquo;
          </motion.div>
          {screen.title && (
            <motion.blockquote variants={item} style={{ fontSize: 46, lineHeight: 1.32, fontWeight: 700, letterSpacing: 0, margin: "-30px 0 0", maxWidth: 920, color: c.title, whiteSpace: "pre-line" }}>
              {screen.title}
            </motion.blockquote>
          )}
          {screen.body && (
            <motion.div variants={item} style={{ fontSize: 19, marginTop: 32, fontWeight: 500, fontStyle: "italic", color: c.body, whiteSpace: "pre-line" }}>
              <span style={{ color: c.eyebrow }}>&mdash; </span>{screen.body}
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
        <div style={{ position: "absolute", left: B_M, top: B_M + logoClear, right: B_M, bottom: B_M, zIndex: 1 }}>
          <BasicText screen={screen} colors={c} item={item} theme={theme} />
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
          <img src={screen.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          {screen.overlay === true && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0))" }} />}
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
        <div style={{ position: "absolute", left: textX, top: textLeft ? B_M + logoClear : B_M, width: B_COL, zIndex: 2 }}>
          <BasicText screen={screen} colors={c} item={item} theme={theme} />
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
        <motion.div variants={item} style={{ marginTop: screen.eyebrow || screen.title ? 40 : 0, width: "100%", aspectRatio: "16 / 9", borderRadius: 12, overflow: "hidden", background: "#000" }}>
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
  const logoLeft = fullBleed ? B_M : (card ? 100 : 112);
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
        padding: screen.layout === "overview" || isBasic ? 0 : card ? 100 : 112, overflow: "hidden", boxSizing: "border-box",
        // Centered-flow layouts reserve extra top space for the corner logo.
        ...(screen.layout === "overview" || isBasic ? {} : { paddingTop: (card ? 100 : 112) + logoClear }),
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
          variants={buildContainer}
          initial={play ? "hidden" : "show"}
          animate="show"
          style={{ position: "relative", zIndex: 1, width: "100%", height: screen.layout === "overview" || isBasic ? "100%" : undefined, display: "flex", justifyContent: "flex-start" }}
        >
          {inner}
        </motion.div>
      </div>
      {logoEl}
      {lightbox && <Lightbox src={lightbox.src} caption={lightbox.caption} onClose={() => setLightbox(null)} />}
    </div>
  );
}


