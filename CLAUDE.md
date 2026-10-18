# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@tomcog/case-study`: the case study builder and immersive player from tomcoggia.com, packaged as a React 18/19 component library. Peer deps: `react`, `react-dom`, `motion` (11+). The only runtime dependency is `lucide-react`. It also contains **ProjectBuilder** (`app/`), a standalone app for creating, managing and editing projects. README.md covers both.

## Commands

```bash
npm install
npm run dev       # ProjectBuilder on http://localhost:5187 (Vite, imports src/ directly, so no rebuild needed)
npm run build     # tsc -p tsconfig.json → dist/ (the package)
npm run watch     # tsc --watch → dist/
npm run check     # type-check the package and the app
npm run build:app # read-only ProjectBuilder site → app-dist/ (gitignored)
```

There are no tests and no linter. `npm run check` is the only check. To see a package change running, use `npm run dev`. To see it inside a host app, link the package from the app with `"@tomcog/case-study": "file:../case-study"` and `resolve.dedupe: ["react", "react-dom", "motion"]` in its Vite config.

## dist/ is committed

Installs from GitHub use the committed `dist/`, because npm 11 doesn't run a git dependency's `prepare` script unless it's approved. After changing `src/`, run `npm run build` and commit `dist/` along with the source. Rebuild before tagging a release. Releases install from the tag's tarball (`.../archive/refs/tags/vX.Y.Z.tar.gz`).

## Architecture

- **Data model** (`src/core.tsx`): a project is one JSON object, `CaseStudyContent`, holding an ordered list of `screens` plus a `preview` card. A `Screen` has a `layout` (`cover`, `overview`, `basic1`, `basic2`, `quote`, `metrics`, `gallery`, `showcase`, `bento`, `video`) and one flat bag of optional fields. Which fields a screen uses depends on its layout. The package only renders and edits the object; the host app stores it.
- **Rendering** (`src/core.tsx`): `ScreenView` renders any screen onto a fixed 1280×720 canvas (`STAGE_W`/`STAGE_H`). `Stage` scales that canvas to fit its parent, and `bleedBg`/`backdropFor` fill the letterbox margins around it. All layout math is in stage pixels. The `B_*` constants hold the spacing for the Basic templates. Entrance animations use the motion variants in core (`screenVariants`, `buildContainer`/`buildItem`), and each has a reduced-motion version.
- **Player** (`src/Player.tsx`): full-viewport, one screen at a time, spatial-push transitions, arrow keys and click navigation, Esc calls `onExit`.
- **Builder** (`src/Builder.tsx` + `src/editors.tsx`): a controlled editor. The host passes `content`/`setContent` and owns saving. `layoutPatch` seeds default list content (the `DEFAULT_*` constants in core) the first time a screen switches to a layout, so the canvas never shows an empty shell. It renders the same `ScreenView` as the player.
- **Host integration** (`src/config.tsx`): the optional `CaseStudyProvider` supplies `assets` (`upload`/`list`/`libraryUrl`) and `useImageCaption`. Without `assets`, image fields are URL-only. `useImageCaption` is called as a hook, so it must be the same function on every render.
- **Project files** (`src/project.ts`): `migrate()` never throws. It fills defaults and stamps `schemaVersion` (`SCHEMA_VERSION`). Bump the version and add a migration step when the saved shape changes. Old screens without a `theme` get one inferred at render time (`screenTheme`), not in migration. `withAssetBase` rewrites site-relative asset paths; it must cover every URL field on `Screen`/`ProjectPreview`, so update it when adding one.
- **ProjectBuilder** (`app/`, configured by the root `vite.config.ts` with `root: "app"`): hash routes `#/` (list), `#/<id>` (play), `#/<id>/edit`. Projects live in `projects/<id>/project.json` with images in `projects/<id>/images/`, and the folder is the single copy of a project that other sites load. `app/projects-plugin.ts` serves `projects/` from disk in dev, handles `/__projects/*` writes (create, save, rename, duplicate, delete, upload), generates `projects/index.json` on request, and copies `projects/` into the build. Editing is dev only (`canEdit = import.meta.env.DEV` in `app/store.ts`); the build is read-only. Image paths are stored as `/projects/<id>/images/<name>`, so a consumer site loads them with `loadProject(..., { assetBase })`. Duplicate copies the images and rewrites those paths to the new id. Ids are slugs taken from the name when a project is created, and they never change.
- **Public API**: `src/index.ts` is the only entry point. Anything a host should use has to be exported there.

## Conventions

- In the package (`src/`), all styling is inline `style` objects. There are no CSS files or classNames, apart from one scrollbar rule in `PhoneMockup`. The app (`app/`) has its own stylesheet, `app/app.css`.
- Brand colors come from `src/theme.ts`. Rendering uses `RED`/`INK`, which are `var(--cs-accent, …)`/`var(--cs-ink, …)` so hosts can re-skin them. Values stored in project data (a screen's `accent`) must be real hex values (`DEFAULT_ACCENT`), never CSS variables.
- ESM with `moduleResolution: "Bundler"`: relative imports in `src/` use the `.js` extension (`./core.js`), even for `.tsx` sources.
- Files open with a short header comment (`// ─── Section ───`) describing their role. Match that style.
