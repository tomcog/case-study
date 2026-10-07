import { ReactNode, CSSProperties } from "react";
/** The single, site-wide full-size image viewer. A dark strip across the top
 * holds: a close button, a Fit-to-screen / View-full-size toggle, and the
 * image's caption. In "fit" mode the image is centered and scaled to the
 * viewport; in "full" mode it renders at natural size and the overlay scrolls.
 *
 * Caption/title can be passed explicitly (project galleries, case studies). If
 * neither is given, the caption falls back to the image's macOS Finder
 * "Comments" field via the dev server (localhost only; empty elsewhere). */
export declare function Lightbox({ src, onClose, caption, title, }: {
    src: string;
    onClose: () => void;
    caption?: string;
    title?: string;
}): import("react").ReactPortal;
/** Wraps any clickable image so it gets the site-wide "this opens a lightbox"
 * affordance: an expand icon in a translucent circle that fades in on hover.
 * Self-contained (no Tailwind `group` dependency) so it drops into inline-styled
 * surfaces — content blocks, project thumbnails, case-study galleries. */
export declare function LightboxTrigger({ onOpen, children, style, title, disabled, }: {
    onOpen: () => void;
    children: ReactNode;
    style?: CSSProperties;
    title?: string;
    disabled?: boolean;
}): import("react").JSX.Element;
