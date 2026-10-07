// Brand colors. Rendering reads them as CSS variables so a host app can re-skin
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
//# sourceMappingURL=theme.js.map