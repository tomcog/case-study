# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@tomcog/case-study`: the case study builder and immersive player from tomcoggia.com, packaged as a React 18/19 component library. Peer deps: `react`, `react-dom`, `motion` (11+). The only runtime dependency is `lucide-react`. README.md covers how a host app uses it.

## Commands

```bash
npm install
npm run build   # tsc -p tsconfig.json → dist/
npm run dev     # tsc --watch → dist/
```

There are no tests, no linter, and no demo app. The type-check (`npm run build`) is the only check. To see a change running, use a host app that links the package with `"@tomcog/case-study": "file:../case-study"` and `resolve.dedupe: ["react", "react-dom", "motion"]` in its Vite config.

## dist/ is committed

Installs from GitHub use the committed `dist/`, because npm 11 doesn't run a git dependency's `prepare` script unless it's approved. After changing `src/`, run `npm run build` and commit `dist/` along with the source. Rebuild before tagging a release. Releases install from the tag's tarball (`.../archive/refs/tags/vX.Y.Z.tar.gz`).

## Architecture

- **Data model** (`src/core.tsx`): a project is one JSON object, `CaseStudyContent`, holding an ordered list of `screens` plus a `preview` card. A `Screen` has a `layout` (`cover`, `overview`, `basic1`, `basic2`, `quote`, `metrics`, `gallery`, `showcase`, `bento`, `video`) and one flat bag of optional fields. Which fields a screen uses depends on its layout. The package only renders and edits the object; the host app stores it.
- **Rendering** (`src/core.tsx`): `ScreenView` renders any screen onto a fixed 1280×720 canvas (`STAGE_W`/`STAGE_H`). `Stage` scales that canvas to fit its parent, and `bleedBg`/`backdropFor` fill the letterbox margins around it. All layout math is in stage pixels. The `B_*` constants hold the spacing for the Basic templates. Entrance animations use the motion variants in core (`screenVariants`, `buildContainer`/`buildItem`), and each has a reduced-motion version.
- **Player** (`src/Player.tsx`): full-viewport, one screen at a time, spatial-push transitions, arrow keys and click navigation, Esc calls `onExit`.
- **Builder** (`src/Builder.tsx` + `src/editors.tsx`): a controlled editor. The host passes `content`/`setContent` and owns saving. `layoutPatch` seeds default list content (the `DEFAULT_*` constants in core) the first time a screen switches to a layout, so the canvas never shows an empty shell. It renders the same `ScreenView` as the player.
- **Host integration** (`src/config.tsx`): the optional `CaseStudyProvider` supplies `assets` (`upload`/`list`/`libraryUrl`) and `useImageCaption`. Without `assets`, image fields are URL-only. `useImageCaption` is called as a hook, so it must be the same function on every render.
- **Project files** (`src/project.ts`): `migrate()` never throws. It fills defaults and stamps `schemaVersion` (`SCHEMA_VERSION`). Bump the version and add a migration step when the saved shape changes. Old screens without a `theme` get one inferred at render time (`screenTheme`), not in migration. `withAssetBase` rewrites site-relative asset paths; it must cover every URL field on `Screen`/`ProjectPreview`, so update it when adding one.
- **Public API**: `src/index.ts` is the only entry point. Anything a host should use has to be exported there.

## Conventions

- All styling is inline `style` objects. There are no CSS files or classNames, apart from one scrollbar rule in `PhoneMockup`.
- Brand colors come from `src/theme.ts`. Rendering uses `RED`/`INK`, which are `var(--cs-accent, …)`/`var(--cs-ink, …)` so hosts can re-skin them. Values stored in project data (a screen's `accent`) must be real hex values (`DEFAULT_ACCENT`), never CSS variables.
- ESM with `moduleResolution: "Bundler"`: relative imports use the `.js` extension (`./core.js`), even for `.tsx` sources.
- Files open with a short header comment (`// ─── Section ───`) describing their role. Match that style.
