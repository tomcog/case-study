// Brand colors and the image effects, which every place that draws a picture
// shares. Rendering reads the colors as CSS variables so a host app can re-skin
// every slide and the builder chrome with two declarations, e.g.
//   :root { --cs-accent: #0a7c86; --cs-ink: #111; }
// The hex defaults are what gets written into project data (a screen's
// `accent`), since stored colors have to be real values, not variables.
export const DEFAULT_ACCENT = "#E51A38";
export const DEFAULT_INK = "#282523";
/** Accent (red by default): eyebrows, CTAs, active states. */
export const RED = `var(--cs-accent, ${DEFAULT_ACCENT})`;
/** Near-black ink for body text on light themes. */
export const INK = `var(--cs-ink, ${DEFAULT_INK})`;
// ─── Image effects ─────────────────────────────────────────────────
// Two independent treatments an image can carry, stored as separate flags on
// whatever holds the image (`overlay`/`mono` on a Screen, `imageOverlay`/
// `imageMono` on a preview card) so either, both or neither can be on.
/** Darkens the top of an image so white text over it stays readable. Drawn as
 * a layer above the picture, which is why it is a background and not a
 * filter — a filter would take the text with it. */
export const OVERLAY_GRADIENT = "linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0))";
/** Drains the color out of an image and takes 25% off its brightness, so a
 * photograph sits back from the copy instead of competing with it. Applied to
 * the picture itself, so anything drawn over it — the gradient, a logo, the
 * text — keeps its own color. */
export const MONO_FILTER = "grayscale(1) brightness(0.75)";
//# sourceMappingURL=theme.js.map