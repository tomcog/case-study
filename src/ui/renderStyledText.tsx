import { useState, type ReactNode } from "react";
import { RED } from "../theme.js";

/**
 * Lightweight inline markup parser.
 *
 * Syntax:
 *   {text}        → red
 *   **text**      → bold
 *   {**text**}    → bold + red
 *   __text__      → bold + red  (legacy, same result)
 *   [label](url)  → link (red, underlined, opens in new tab)
 *   [text]        → middle gray
 */
export function renderStyledText(text: string): ReactNode[] {
  const pattern = /(\{(?:\*\*[^*]+\*\*|[^}]+)\}|\*\*[^*]+\*\*|__[^_]+__|\[[^\]]+\]\([^)]+\)|\[[^\]]+\])/g;
  const tokens = text.split(pattern);

  return tokens.map((token, i) => {
    // {**bold + red**} or {red}
    if (token.startsWith("{") && token.endsWith("}")) {
      const inner = token.slice(1, -1);
      if (inner.startsWith("**") && inner.endsWith("**")) {
        return <strong key={i} style={{ fontWeight: 700, color: RED }}>{inner.slice(2, -2)}</strong>;
      }
      return <span key={i} style={{ color: RED }}>{inner}</span>;
    }
    // **bold**
    if (token.startsWith("**") && token.endsWith("**")) {
      return <strong key={i} style={{ fontWeight: 700 }}>{token.slice(2, -2)}</strong>;
    }
    // __bold + red__ (legacy)
    if (token.startsWith("__") && token.endsWith("__")) {
      return <strong key={i} style={{ fontWeight: 700, color: RED }}>{token.slice(2, -2)}</strong>;
    }
    // [label](url)
    const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) return <StyledLink key={i} href={linkMatch[2]}>{linkMatch[1]}</StyledLink>;
    // [text] → middle gray, one step lighter than surrounding text
    if (token.startsWith("[") && token.endsWith("]")) {
      return <span key={i} style={{ color: "#838383", fontWeight: "lighter" }}>{token.slice(1, -1)}</span>;
    }
    return token;
  });
}

// Red link whose 4px underline wipes in from the left on hover.
function StyledLink({ href, children }: { href: string; children: ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ position: "relative", display: "inline-block", color: RED, fontWeight: 600, textDecoration: "none" }}>
      {children}
      <span style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: 4, background: RED, transformOrigin: "left", transform: hover ? "scaleX(1)" : "scaleX(0)", transition: "transform 0.2s" }} />
    </a>
  );
}
