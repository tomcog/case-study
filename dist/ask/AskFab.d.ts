/** How far the FAB sits from the viewport's lower right (level with the
 * toolbar's inset); the player's panel clears this much at its foot when the
 * FAB is over it. */
export declare const FAB_INSET: {
    bottom: number;
    right: number;
};
export declare const FAB_CLEAR: number;
export declare function AskFab({ onClick, hidden }: {
    onClick: () => void;
    /** Fades out while the rail is open — the panel covers this corner anyway. */
    hidden?: boolean;
}): import("react").JSX.Element;
