// ─── Ask AI Tom rail ───────────────────────────────────────────────
// The right rail the FAB opens: a drawer holding the conversation, sliding in
// over whatever the project is showing. The page behind it is left as it was
// — no dim, no blur — and a running app keeps running underneath, so closing
// the rail leaves the reader exactly where they were. Ported from
// tomcoggia-com's AskAiRail.

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { ButtonRound } from "@tomcoggia/ui";
import { INK, RED } from "../theme.js";
import { AskMark } from "./AskMark.js";
import { AskChat, type AskChatProps } from "./AskChat.js";

/** Widest the panel goes; below that it takes the whole viewport. */
const RAIL_W = 440;

export function AskRail({ open, onClose, title, ...chat }: Omit<AskChatProps, "inputRef"> & {
  open: boolean;
  onClose: () => void;
  /** The project's title, under the rail's name. */
  title?: string;
}) {
  const reduced = useReducedMotion();
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Esc closes the rail. The player stands its own keys down while the rail
  // is open, so this is the only thing Esc does then.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Focus the field once the panel has arrived, so opening the rail leaves you
  // ready to type.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => taRef.current?.focus(), reduced ? 0 : 260);
    return () => clearTimeout(t);
  }, [open, reduced]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Click-catcher only: the panel's shadow is what separates it from
              the project, not a backdrop. */}
          <div
            key="ask-scrim"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            style={{ position: "fixed", inset: 0, zIndex: 11, background: "transparent" }}
          />
          <motion.aside
            key="ask-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Ask AI Tom"
            onClick={(e) => e.stopPropagation()}
            initial={reduced ? { opacity: 0 } : { x: "100%" }}
            animate={reduced ? { opacity: 1 } : { x: 0 }}
            exit={reduced ? { opacity: 0 } : { x: "100%" }}
            transition={reduced ? { duration: 0.15 } : { type: "spring", stiffness: 380, damping: 40, mass: 0.9 }}
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              zIndex: 12,
              width: `min(${RAIL_W}px, 100vw)`,
              display: "flex",
              flexDirection: "column",
              background: "#fff",
              borderLeft: "1px solid #e3e0db",
              boxShadow: "-24px 0 60px -8px rgba(0,0,0,0.16)",
              padding: "20px 24px 24px",
              boxSizing: "border-box",
            }}
          >
            <header
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                paddingBottom: 16,
                marginBottom: 4,
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <AskMark />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 20, lineHeight: "24px", fontWeight: 700, color: INK }}>
                    Ask <span style={{ color: RED }}>AI Tom</span>
                  </div>
                  {title && (
                    <div style={{ fontSize: 13, lineHeight: "18px", color: "#9a9893", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      About {title}
                    </div>
                  )}
                </div>
              </div>
              <ButtonRound size="md" variant="ghost" icon={<X size={20} />} onClick={onClose} aria-label="Close" />
            </header>

            <AskChat {...chat} inputRef={taRef} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
