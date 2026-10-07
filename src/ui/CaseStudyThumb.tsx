import type { CSSProperties } from "react";
import { PhoneMockup } from "./PhoneMockup.js";
import { ComputerFrame } from "./ComputerFrame.js";

export type ThumbFrame = "none" | "computer" | "iphone";

/** Renders a case-study thumbnail image, optionally wrapped in a device frame.
 * "none" → the bare image; "computer" → a monitor; "iphone" → the PhoneMockup
 * (its native 294px width scaled to `phoneWidth`). */
export function CaseStudyThumb({ src, frame = "none", phoneWidth = 230, fill = false }: {
  src?: string;
  frame?: ThumbFrame;
  phoneWidth?: number;
  fill?: boolean; // image covers the frame instead of top-anchored/scroll (phone)
}) {
  if (frame === "iphone") {
    const PHONE_W = 294, PHONE_H = 628;
    const s = phoneWidth / PHONE_W;
    // The scaled phone keeps its layout box, so reserve the scaled dimensions.
    return (
      <div style={{ width: phoneWidth, height: PHONE_H * s, position: "relative", margin: "0 auto" }}>
        <div style={{ position: "absolute", top: 0, left: 0, transformOrigin: "top left", transform: `scale(${s})` }}>
          <PhoneMockup src={src} fill={fill} />
        </div>
      </div>
    );
  }

  if (frame === "computer") return <ComputerFrame src={src} />;

  // No frame — the bare image.
  const box: CSSProperties = { width: "100%", borderRadius: 12, overflow: "hidden", display: "block", background: "#e5e5e5" };
  return src ? (
    <img src={src} alt="" style={{ ...box, height: "auto" }} />
  ) : (
    <div style={{ ...box, aspectRatio: "16 / 10", display: "flex", alignItems: "center", justifyContent: "center", color: "#9a958e", fontSize: 13 }}>No thumbnail</div>
  );
}
