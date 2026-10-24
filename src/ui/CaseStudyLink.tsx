import { useState, type CSSProperties, type ReactNode } from "react";

import { RED as ACCENT } from "../theme.js";

/** A pill CTA linking to a case study: red background + white text by default,
 * black on hover; `ghost` is a white 1px outline with no fill instead. Renders an <a> when `href` is given (full navigation), else a
 * <button> (SPA navigation via `onClick`). */
export function CaseStudyLink({ href, onClick, children, style, ghost = false }: {
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
  children: ReactNode;
  style?: CSSProperties;
  ghost?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const s: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: ghost ? (hover ? "rgba(255,255,255,0.14)" : "transparent") : hover ? "#000" : ACCENT,
    color: "#fff",
    textDecoration: "none",
    border: ghost ? "1px solid #fff" : "none",
    borderRadius: 999,
    padding: "8px 16px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    width: "fit-content",
    transition: "background 0.15s ease",
    ...style,
  };
  const hoverProps = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
  };
  // External URLs open in a new tab (e.g. a Figma prototype).
  const external = href ? /^https?:\/\//i.test(href) : false;
  return href ? (
    <a href={href} style={s} onClick={onClick} {...hoverProps} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{children}</a>
  ) : (
    <button type="button" onClick={onClick} style={s} {...hoverProps}>{children}</button>
  );
}
