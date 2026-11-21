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
    bodyImage?: string;
    list?: string[];
    overlay?: boolean;
    mono?: boolean;
    videoUrl?: string;
    linkUrl?: string;
    linkLabel?: string;
    linkAction?: "next";
    linkStyle?: "ghost";
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
/** The build container for a slide whose copy may pause. Each item still
 * arrives on the stagger, plus every pause in the items before it, so a pause
 * holds up the rest of the build rather than only its own text. Motion hands
 * `delayChildren` an index in document order, so the pauses are read off the
 * items' `data-build` in that same order. If the count doesn't match, it falls
 * back to the plain stagger rather than guess. */
export declare function pausedContainer(root: React.RefObject<HTMLElement | null>): Variants;
/** Space between paragraphs: 75% of the font size. */
export declare const PARA_GAP = "0.75em";
/** A copy field's paragraphs, in order, each still holding its line breaks.
 * Runs of blank lines count as one break, and empty paragraphs are dropped. */
export declare function splitParagraphs(text?: string): string[];
/** A copy field's paragraphs, each cut into runs at its pauses, with the
 * seconds the build waits before each run. A pause with nothing after it in
 * its paragraph carries over to the next; one at the very end is `trail`, a
 * wait before whatever builds after this copy. */
export declare function pausedParagraphs(text?: string): {
    paras: {
        wait: number;
        text: string;
    }[][];
    trail: number;
};
/** What a build item needs to know about the copy in it, spread onto the
 * item: `custom`, the time of each pause from the item's start in the order
 * its runs are drawn, and `data-build`, how long it holds up the rest of the
 * slide. Pass every copy field the item draws, in drawing order; an item with
 * none still takes `built()`, so pausedContainer can count it. */
export declare function built(...texts: (string | undefined)[]): {
    custom: number[];
    "data-build": number;
};
/** Copy as it was typed: a block per paragraph, PARA_GAP apart, and its line
 * breaks kept. Spans rather than <p>, so it can sit inside a heading or a
 * blockquote. `styled` runs the inline markup (renderStyledText); `nowrap`
 * breaks only where the author did; `lead` goes in front of the first
 * paragraph, inline with it. Inside a slide's build, a run after a pause is
 * a variant child of its item, which times it (built); elsewhere the pause is
 * just dropped. Every place copy is drawn goes through here. */
export declare function Paragraphs({ text, styled, nowrap, lead }: {
    text?: string;
    styled?: boolean;
    nowrap?: boolean;
    lead?: React.ReactNode;
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
/** The slide's button, or null for none. A link opens its URL in a new tab; a
 * next button moves the player on a step, and shows whether or not a URL was
 * ever typed. Either way a click on it is the button's alone — the player
 * also moves on for a click anywhere on a slide, and must not do it twice, or
 * at all for a link. */
export declare function slideButton(screen: Screen, onNext?: () => void): {
    href?: string;
    label: string;
    next: boolean;
    onClick: (e: React.MouseEvent) => void;
} | null;
export declare function BasicCtaButton({ href, label, theme, onClick, ghost }: {
    href?: string;
    label?: string;
    theme: "light" | "dark" | "red" | "image";
    onClick?: (e: React.MouseEvent) => void;
    ghost?: boolean;
}): import("react").JSX.Element;
/** Eyebrow / Title / Body (+ optional CTA) for the Basic templates, per the
 * iconAtomic type ramp. Title/body sizes are overridable (Title Card runs
 * larger); the eyebrow is always the same size across all layouts. */
export declare function BasicText({ screen, colors, item, theme, titleSize, bodySize, gap, bodyColor, bodyLetterSpacing, titleLetterSpacing, onNext, onImage }: {
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
    onNext?: () => void;
    onImage?: (src: string) => void;
}): import("react").JSX.Element;
export declare function ScreenView({ screen, play, reduced, cta, textScale, card, onAnnotationMove, logoSrc, footnote, onNext }: {
    screen: Screen;
    play: boolean;
    reduced: boolean;
    cta?: React.ReactNode;
    textScale?: number;
    card?: boolean;
    onAnnotationMove?: (id: string, x: number, y: number) => void;
    logoSrc?: string;
    footnote?: string;
    onNext?: () => void;
}): import("react").JSX.Element;
