// ─── Ask AI Tom FAB ────────────────────────────────────────────────
// The mark beside an "Ask AI Tom" label, pinned to the viewport's lower right,
// the corner across from the player's toolbar and the one a running app is
// least likely to use. (The site pins it top right, under its header.) Opens
// the rail. On a phone-width viewport the label goes and the mark stands
// alone. Ported from tomcoggia-com's AskAiFab.

import { useEffect, useState, type CSSProperties } from "react";
import { INK, RED } from "../theme.js";
import { AskMark } from "./AskMark.js";

/** How far the FAB sits from the viewport's lower right (level with the
 * toolbar's inset); the player's panel clears this much at its foot when the
 * FAB is over it. */
export const FAB_INSET = { bottom: 16, right: 24 };
export const FAB_CLEAR = FAB_INSET.bottom + 40;

const NARROW = "(max-width: 640px)";

function useNarrow() {
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia(NARROW).matches);
  useEffect(() => {
    const query = window.matchMedia(NARROW);
    const on = () => setNarrow(query.matches);
    query.addEventListener("change", on);
    return () => query.removeEventListener("change", on);
  }, []);
  return narrow;
}

export function AskFab({ onClick, hidden = false }: {
  onClick: () => void;
  /** Fades out while the rail is open — the panel covers this corner anyway. */
  hidden?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const narrow = useNarrow();

  const wrap: CSSProperties = {
    position: "fixed",
    bottom: FAB_INSET.bottom,
    right: narrow ? 16 : FAB_INSET.right,
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: "none",
    background: "transparent",
    padding: 0,
    font: "inherit",
    cursor: "pointer",
    opacity: hidden ? 0 : 1,
    pointerEvents: hidden ? "none" : "auto",
    transition: "opacity 0.2s ease",
  };
  const label: CSSProperties = {
    fontSize: 14,
    lineHeight: "20px",
    fontWeight: 500,
    whiteSpace: "nowrap",
    color: hover ? INK : RED,
    transition: "color 0.15s ease",
  };

  return (
    <button
      type="button"
      // A slide advances on a click anywhere on it; this one is for the FAB.
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={wrap}
      title="Ask AI Tom"
      aria-label="Ask AI Tom"
      aria-haspopup="dialog"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <AskMark background={hover ? INK : RED} />
      {!narrow && <span style={label}>Ask AI Tom</span>}
    </button>
  );
}
