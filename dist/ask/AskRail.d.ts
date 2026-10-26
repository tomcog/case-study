import { type AskChatProps } from "./AskChat.js";
export declare function AskRail({ open, onClose, title, ...chat }: Omit<AskChatProps, "inputRef"> & {
    open: boolean;
    onClose: () => void;
    /** The project's title, under the rail's name. */
    title?: string;
}): import("react").JSX.Element;
