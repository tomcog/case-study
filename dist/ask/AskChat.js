import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ─── Ask AI Tom conversation ───────────────────────────────────────
// The chat inside the rail, about the one project being viewed. Owns the
// messages, the round trip to the host's endpoint (CaseStudyProvider `ask`),
// the typewriter reveal and the step chips; knows nothing about how it is
// framed. Mirrors tomcoggia-com's AskAiChat in its rail variant: newest
// exchange first, the field pinned to the top, suggestions until the first
// question. The site's project cards and page links aren't here — inside a
// project, the thing an answer points at is a step.
//
// POST <endpoint> { project, messages, stepIndex } → { text, step?: { id, label } }
import { Fragment, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { RED } from "../theme.js";
import { useCaseStudyConfig } from "../config.js";
import { CaseStudyLink } from "../ui/CaseStudyLink.js";
const RED_DARK = "#b2142c"; // the site's --color-red-dark: AI Tom's answers
export const ASK_SUGGESTIONS = [
    "What was your role on this project?",
    "What problem were you solving?",
    "What am I looking at here?",
    "What were the results?",
];
/** Inline formatting: **bold** and line breaks. */
function renderText(text) {
    return text.split("\n").map((line, i) => (_jsx("div", { style: { minHeight: line ? undefined : "0.6em" }, children: line.split(/(\*\*[^*]+\*\*)/g).map((p, j) => p.startsWith("**") && p.endsWith("**") ? _jsx("strong", { children: p.slice(2, -2) }, j) : _jsx("span", { children: p }, j)) }, i)));
}
const toPlainText = (s) => s.replace(/\*\*([^*]+)\*\*/g, "$1");
// The TC loader (static "T" + spinning "C"), shown where the answer will land.
function TCLoader() {
    return (_jsx("div", { style: { display: "flex", alignItems: "center", minHeight: 44 }, children: _jsx("div", { style: { position: "relative", width: 40, height: 40 }, children: _jsxs("svg", { style: { position: "absolute", inset: 0, width: "100%", height: "100%" }, fill: "none", viewBox: "0 0 100 100", children: [_jsx("path", { d: "M79.0107 32.9727H53.0752V86.0303H47.0752V32.9727H21.4033V26.9727H79.0107V32.9727Z", fill: RED }), _jsx("g", { style: { transformBox: "fill-box", transformOrigin: "center", animation: "askspin 0.8s linear infinite" }, children: _jsx("path", { d: "M50 0C73.8349 0 93.7737 16.6778 98.7852 39H92.6143C87.7298 20.0224 70.5023 6 50 6C25.6995 6 6 25.6995 6 50C6 74.3005 25.6995 94 50 94C70.5023 94 87.7298 79.9776 92.6143 61H98.7852C93.7737 83.3222 73.8349 100 50 100C22.3858 100 0 77.6142 0 50C0 22.3858 22.3858 0 50 0Z", fill: RED }) })] }) }) }));
}
// Newest exchange first, each question above its answer. Messages alternate
// user, assistant, user, assistant…
function reversedPairOrder(n) {
    const out = [];
    for (let i = n % 2 === 0 ? n - 2 : n - 1; i >= 0; i -= 2) {
        out.push(i);
        if (i + 1 < n)
            out.push(i + 1);
    }
    return out;
}
// Grow the field to fit its content, up to a max, rather than scrolling a
// fixed box — the rail is narrow.
const INPUT_MAX_H = 160;
function autosize(el) {
    el.style.height = "auto";
    const cs = getComputedStyle(el);
    const full = el.scrollHeight + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    el.style.height = Math.min(full, INPUT_MAX_H) + "px";
    el.style.overflowY = full > INPUT_MAX_H ? "auto" : "hidden";
}
// Kept for the browser session, one conversation per project, so a reload
// mid-chat keeps it.
const storeKey = (id) => `ask-project:${id}`;
function loadMessages(id) {
    try {
        const s = sessionStorage.getItem(storeKey(id));
        return s ? JSON.parse(s) : [];
    }
    catch {
        return [];
    }
}
const label = (color) => ({
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color,
});
export function AskChat({ projectId, stepIds, stepIndex, onStep, suggestions = ASK_SUGGESTIONS, inputRef }) {
    const { ask } = useCaseStudyConfig();
    const reduced = useReducedMotion();
    const [messages, setMessages] = useState(() => loadMessages(projectId));
    const [input, setInput] = useState("");
    const [hintHidden, setHintHidden] = useState(false); // clicking the field clears the hint
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [typing, setTyping] = useState(null);
    const ownRef = useRef(null);
    const taRef = inputRef ?? ownRef;
    const scrollerRef = useRef(null);
    useEffect(() => {
        try {
            sessionStorage.setItem(storeKey(projectId), JSON.stringify(messages));
        }
        catch { /* ignore */ }
    }, [projectId, messages]);
    // The newest exchange is at the top, so bring the top into view on each one.
    useEffect(() => {
        scrollerRef.current?.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    }, [messages.length, reduced]);
    // Typewriter reveal for the newest answer (fast, plain text).
    useEffect(() => {
        if (!typing)
            return;
        const full = toPlainText(messages[typing.index]?.content ?? "");
        if (typing.shown >= full.length) {
            setTyping(null);
            return;
        }
        const id = setTimeout(() => setTyping((t) => (t ? { ...t, shown: Math.min(full.length, t.shown + 3) } : t)), 12);
        return () => clearTimeout(id);
    }, [typing, messages]);
    async function send(text) {
        const q = text.trim();
        if (!q || loading || !ask)
            return;
        const next = [...messages, { role: "user", content: q }];
        setMessages(next);
        setInput("");
        if (taRef.current) {
            taRef.current.style.height = "auto";
            taRef.current.style.overflowY = "hidden";
        }
        setError(null);
        setLoading(true);
        try {
            const res = await fetch(ask.endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    project: projectId,
                    stepIndex,
                    messages: next.map(({ role, content }) => ({ role, content })),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(data.error || `Request failed (${res.status})`);
            setMessages((m) => [...m, { role: "assistant", content: data.text ?? "", step: data.step }]);
            // Reduced motion: the answer arrives whole.
            if (!reduced)
                setTyping({ index: next.length, shown: 0 });
        }
        catch (e) {
            setError(String(e?.message ?? e));
        }
        finally {
            setLoading(false);
        }
    }
    const started = messages.length > 0;
    // Waiting for an answer or still typing it out: the field hides for both.
    const busy = loading || typing != null;
    return (_jsxs("div", { ref: scrollerRef, style: { display: "flex", flexDirection: "column", gap: 20, padding: "4px 0 8px", width: "100%", flex: 1, minHeight: 0, overflowY: "auto" }, children: [_jsx("style", { children: `.ask-caret{animation:askCaret 1s steps(1) infinite}@keyframes askCaret{50%{opacity:0}}@keyframes askspin{to{transform:rotate(360deg)}}@keyframes askFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}.ask-input::placeholder{color:#000;opacity:1;text-align:center}` }), started && (_jsx("div", { style: { display: "flex", flexDirection: "column", gap: 22 }, children: reversedPairOrder(messages.length).map((i, pos) => {
                    const m = messages[i];
                    const newPair = pos > 0 && m.role === "user"; // a rule above each older exchange
                    const showPending = loading && i === messages.length - 1 && m.role === "user";
                    const typingThis = typing?.index === i;
                    const to = m.step ? stepIds.indexOf(m.step.id) : -1;
                    return (_jsxs(Fragment, { children: [_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 6, ...(newPair ? { borderTop: "1px solid #c1beba", paddingTop: 22 } : {}) }, children: [_jsx("div", { style: label(m.role === "user" ? "#9a9893" : RED), children: m.role === "user" ? "You" : "AI Tom" }), _jsx("div", { style: { fontSize: 15, lineHeight: "26px", color: m.role === "user" ? "#1A1A1A" : RED_DARK }, children: typingThis ? (_jsxs("span", { style: { whiteSpace: "pre-wrap" }, children: [toPlainText(m.content).slice(0, typing.shown), _jsx("span", { className: "ask-caret", children: "\u258D" }), _jsx("span", { style: { color: "transparent" }, children: toPlainText(m.content).slice(typing.shown) })] })) : (renderText(m.content)) }), m.role === "assistant" && !typingThis && to >= 0 && (_jsx("div", { style: { marginTop: 4 }, children: _jsxs(CaseStudyLink, { onClick: () => onStep(to), children: [m.step.label, " \u2192"] }) }))] }), showPending && (_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: [_jsx("div", { style: label(RED), children: "AI Tom" }), _jsx(TCLoader, {})] }))] }, i));
                }) })), error && _jsx("div", { style: { fontSize: 14, color: RED, background: "#fdecee", padding: "10px 14px", borderRadius: 8 }, children: error }), _jsxs("div", { style: {
                    minHeight: 44,
                    width: "100%",
                    order: -1,
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                    background: "#fff",
                    paddingBottom: 8,
                    opacity: busy ? 0 : 1,
                    transition: "opacity 0.3s ease",
                    pointerEvents: busy ? "none" : "auto",
                }, children: [_jsx("textarea", { ref: taRef, className: "ask-input", value: input, onChange: (e) => {
                            setInput(e.target.value);
                            autosize(e.currentTarget);
                        }, onKeyDown: (e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                void send(input);
                            }
                        }, onMouseDown: () => setHintHidden(true), onBlur: () => setHintHidden(false), placeholder: hintHidden ? "" : "Ask about this project", rows: 1, style: {
                            width: "100%",
                            resize: "none",
                            fontSize: 16,
                            lineHeight: "20px",
                            padding: "10px 14px",
                            textAlign: "center",
                            color: "#000",
                            border: `2px solid ${RED}`,
                            borderRadius: 4,
                            outline: "none",
                            background: "#fff",
                            caretColor: RED,
                            fontFamily: "inherit",
                            boxSizing: "border-box",
                            minHeight: 44,
                            maxHeight: INPUT_MAX_H,
                            overflowY: "hidden",
                            display: "block",
                        } }), _jsx("div", { style: { marginTop: 8, fontSize: 12, lineHeight: "16px", textAlign: "center", color: RED }, children: "This feature is under development." })] }), !started && suggestions.length > 0 && (_jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }, children: suggestions.map((s) => (_jsx("button", { type: "button", onClick: () => void send(s), style: {
                        fontSize: 14,
                        fontFamily: "inherit",
                        color: "#888888",
                        background: "#fff",
                        border: "1px solid #e3e0db",
                        borderRadius: 999,
                        padding: "9px 16px",
                        cursor: "pointer",
                        transition: "border-color 0.15s, color 0.15s",
                        animation: reduced ? undefined : "askFade 0.3s ease both",
                    }, onMouseEnter: (e) => {
                        e.currentTarget.style.borderColor = RED;
                        e.currentTarget.style.color = RED;
                    }, onMouseLeave: (e) => {
                        e.currentTarget.style.borderColor = "#e3e0db";
                        e.currentTarget.style.color = "#888888";
                    }, children: s }, s))) }))] }));
}
//# sourceMappingURL=AskChat.js.map