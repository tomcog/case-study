import { type ReactNode } from "react";
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
export declare function renderStyledText(text: string): ReactNode[];
