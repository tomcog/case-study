export declare const DEFAULT_ACCENT = "#E51A38";
export declare const DEFAULT_INK = "#282523";
/** Accent (red by default): eyebrows, CTAs, active states. */
export declare const RED = "var(--cs-accent, #E51A38)";
/** Near-black ink for body text on light themes. */
export declare const INK = "var(--cs-ink, #282523)";
/** Darkens the top of an image so white text over it stays readable. Drawn as
 * a layer above the picture, which is why it is a background and not a
 * filter — a filter would take the text with it. */
export declare const OVERLAY_GRADIENT = "linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0))";
/** Drains the color out of an image and takes 25% off its brightness, so a
 * photograph sits back from the copy instead of competing with it. Applied to
 * the picture itself, so anything drawn over it — the gradient, a logo, the
 * text — keeps its own color. */
export declare const MONO_FILTER = "grayscale(1) brightness(0.75)";
