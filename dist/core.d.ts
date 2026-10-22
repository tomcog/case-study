import { Variants } from "motion/react";
export type ScreenLayout = "cover" | "overview" | "quote" | "metrics" | "gallery" | "showcase" | "bento" | "video" | "basic1" | "basic2";
export interface Metric {
    id: string;
    value: string;
    label: string;
}
export interface OverviewItem {
    id: string;
    label: string;
    body: string;
    x?: number;
    y?: number;
}
export interface GalleryImage {
    id: string;
    url: string;
    caption: string;
    number?: string;
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
    overlay?: boolean;
    mono?: boolean;
    videoUrl?: string;
    linkUrl?: string;
    linkLabel?: string;
    basicTheme?: "light" | "dark" | "red" | "image";
    basicTextSide?: "left" | "right";
    basicImage?: "off" | "fit" | "fill" | "bleed" | "desktop" | "mobile";
    imageTextDark?: boolean;
    showLogo?: boolean;
    metrics?: Metric[];
    items?: OverviewItem[];
    images?: GalleryImage[];
}
export interface ProjectPreview {
    image?: string;
    imageOverlay?: boolean;
    imageMono?: boolean;
    eyebrow?: string;
    title?: string;
    body?: string;
    logo?: string;
    cardLogo?: string;
    /** @deprecated Ignored. Each site that shows projects picks which ones itself. */
    show?: boolean;
}
export declare const ACCENT = "var(--cs-accent, #E51A38)";
export declare const THEMES: Record<Theme, {
    bg: string;
    fg: string;
}>;
export declare function isDarkColor(hex?: string): boolean;
export declare function screenTheme(screen: Screen): Theme;
export declare function themeColors(screen: Screen): {
    bg: string;
    fg: string;
};
/** The color that bleeds to the viewport edges behind the 16:9 stage. A Title
 * Card with a solid theme bleeds that solid color (white / red / black) full —
 * just like an image theme bleeds its picture — instead of showing the plain
 * light/dark theme color in the letterbox margins. */
export declare function bleedBg(screen: Screen): string;
export declare const DEFAULT_OVERVIEW_ITEMS: OverviewItem[];
export declare const DEFAULT_GALLERY: GalleryImage[];
export declare const DEFAULT_ANNOTATIONS: OverviewItem[];
export declare const DEFAULT_STAT: Metric;
export declare const EASE: readonly [0.22, 1, 0.36, 1];
export declare const STAGE_W = 1280;
export declare const STAGE_H = 720;
/** Centers a fixed STAGE_W×STAGE_H stage inside its parent and scales it to fit.
 * `backdrop` renders full-bleed behind the scaled stage, so a bleed image fills
 * the whole container (the viewport in the player), not just the 16:9 safe area. */
export declare function Stage({ background, backdrop, children }: {
    background: string;
    backdrop?: React.ReactNode;
    children: React.ReactNode;
}): import("react").JSX.Element;
/** A bleed image filling the whole Stage container (past the 16:9 safe area), or
 * just its left/right half when `half` is set, with an optional top gradient. */
export declare function BleedBackdrop({ url, overlay, mono, half }: {
    url: string;
    overlay: boolean;
    mono?: boolean;
    half?: "left" | "right";
}): import("react").JSX.Element;
/** Which background image (if any) escapes the 16:9 stage to bleed the whole
 * container: the Basic 2-column "bleed" image (its half) and every Image-theme
 * background (full, or the left half for Intro). */
export declare function backdropFor(screen: Screen): React.ReactNode;
export declare const screenVariants: Variants;
export declare const reducedScreenVariants: Variants;
export declare const buildContainer: Variants;
export declare const buildItem: Variants;
export declare const reducedItem: Variants;
export declare const PARA_GAP = "0.75em";
export declare function Paragraphs({ text }: {
    text?: string;
}): import("react").JSX.Element;
/** Numbered annotation dots overlaid on the Annotated (showcase) image, matching
 * the numbered callouts. When `onMove` is provided (edit mode) each dot is
 * draggable to reposition it; otherwise only placed dots render, statically. */
export declare function ShowcaseDots({ notes, accent, onMove }: {
    notes: OverviewItem[];
    accent: string;
    onMove?: (id: string, x: number, y: number) => void;
}): import("react").JSX.Element;
export declare const B_M = 120;
export declare const B_COL = 460;
export declare const B_HALF: number;
export declare const B_GAP = 32;
export declare const B_RADIUS = 13;
export declare const B_IMG_H = 480;
export declare const B_BLACK = "var(--cs-ink, #282523)";
export declare const B_RED = "var(--cs-accent, #E51A38)";
export declare function basicColors(theme: "light" | "dark" | "red" | "image", imageTextDark?: boolean): {
    bg: string;
    eyebrow: string;
    title: string;
    body: string;
};
/** CTA pill for the Basic templates. Red/white by default (black on hover);
 * inverts to white/red on the Red theme where a red pill would vanish. */
export declare function BasicCtaButton({ href, label, theme }: {
    href?: string;
    label?: string;
    theme: "light" | "dark" | "red" | "image";
}): import("react").JSX.Element;
/** Eyebrow / Title / Body (+ optional CTA) for the Basic templates, per the
 * iconAtomic type ramp. Title/body sizes are overridable (Title Card runs
 * larger); the eyebrow is always the same size across all layouts. */
export declare function BasicText({ screen, colors, item, theme, titleSize, bodySize, gap, bodyColor, bodyLetterSpacing, titleLetterSpacing }: {
    screen: Screen;
    colors: {
        eyebrow: string;
        title: string;
        body: string;
    };
    item: Variants;
    theme: "light" | "dark" | "red" | "image";
    titleSize?: number;
    bodySize?: number;
    gap?: number;
    bodyColor?: string;
    bodyLetterSpacing?: string;
    titleLetterSpacing?: string;
}): import("react").JSX.Element;
export declare function ScreenView({ screen, play, reduced, cta, textScale, card, onAnnotationMove, logoSrc }: {
    screen: Screen;
    play: boolean;
    reduced: boolean;
    cta?: React.ReactNode;
    textScale?: number;
    card?: boolean;
    onAnnotationMove?: (id: string, x: number, y: number) => void;
    logoSrc?: string;
}): import("react").JSX.Element;
