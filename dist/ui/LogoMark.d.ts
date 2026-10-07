import type { CSSProperties } from "react";
/** Renders a logo (typically an SVG). With no `color`, shows the file as-is.
 * With a `color`, recolors it to a solid silhouette via a CSS mask so any SVG
 * can be set to any color regardless of its own fills. `opacity` always applies.
 * The sized box comes from `style` (width/height/position); the mask/img fits
 * inside it (contain) at `position`. */
export declare function LogoMark({ src, color, opacity, position, style }: {
    src?: string;
    color?: string;
    opacity?: number;
    position?: string;
    style?: CSSProperties;
}): import("react").JSX.Element | null;
