import { jsx as _jsx } from "react/jsx-runtime";
/** Renders a logo (typically an SVG). With no `color`, shows the file as-is.
 * With a `color`, recolors it to a solid silhouette via a CSS mask so any SVG
 * can be set to any color regardless of its own fills. `opacity` always applies.
 * The sized box comes from `style` (width/height/position); the mask/img fits
 * inside it (contain) at `position`. */
export function LogoMark({ src, color, opacity = 1, position = "left center", style }) {
    if (!src)
        return null;
    if (color) {
        const maskUrl = `url("${src}")`;
        return (_jsx("div", { style: {
                WebkitMaskImage: maskUrl, maskImage: maskUrl,
                WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
                WebkitMaskPosition: position, maskPosition: position,
                WebkitMaskSize: "contain", maskSize: "contain",
                backgroundColor: color, opacity,
                ...style,
            } }));
    }
    return _jsx("img", { src: src, alt: "", style: { objectFit: "contain", objectPosition: position, opacity, ...style } });
}
//# sourceMappingURL=LogoMark.js.map