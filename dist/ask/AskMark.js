import { jsx as _jsx } from "react/jsx-runtime";
// ─── Ask AI Tom mark ───────────────────────────────────────────────
// A filled disc holding the bot glyph, shared by the FAB and the rail's header
// so the button you press and the panel it opens carry the same mark. Ported
// from tomcoggia-com (Figma: `FAB-AskAITom`, 700:507).
import { BotMessageSquare } from "lucide-react";
import { RED } from "../theme.js";
export function AskMark({ size = 40, background = RED }) {
    return (_jsx("span", { style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            width: size,
            height: size,
            borderRadius: 99,
            background,
            transition: "background 0.15s ease",
        }, children: _jsx(BotMessageSquare, { size: Math.round(size * 0.6), color: "#fff" }) }));
}
//# sourceMappingURL=AskMark.js.map