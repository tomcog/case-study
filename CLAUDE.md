# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@tomcog/case-study`: the case study builder and immersive player from tomcoggia.com, plus the walkthrough builder and player beside them, packaged as a React 18/19 component library. Peer deps: `react`, `react-dom`, `motion` (11+). The only runtime dependency is `lucide-react`. It also contains **ProjectBuilder** (`app/`), a standalone app for creating, managing and editing projects. README.md covers both.

## Commands

```bash
npm install
npm run dev       # ProjectBuilder on http://localhost:5187 (Vite, imports src/ directly, so no rebuild needed)
npm run build     # tsc -p tsconfig.json → dist/ (the package)
npm run watch     # tsc --watch → dist/
npm run check     # type-check the package and the app
npm run build:app # read-only ProjectBuilder site → app-dist/ (gitignored)
```

There are no tests and no linter. `npm run check` is the only check. To see a package change running, use `npm run dev`. To see it inside a host app, link the package from the app with `"@tomcog/case-study": "file:../ProjectBuilder"` and `resolve.dedupe: ["react", "react-dom", "motion"]` in its Vite config.

## dist/ is committed

Installs from GitHub use the committed `dist/`, because npm 11 doesn't run a git dependency's `prepare` script unless it's approved. After changing `src/`, run `npm run build` and commit `dist/` along with the source. Rebuild before tagging a release. Releases install from the tag's tarball (`.../archive/refs/tags/vX.Y.Z.tar.gz`).

## Architecture

- **Data model** (`src/core.tsx`, `src/walkthrough/types.ts`): a project is one JSON object of one of two kinds, told apart by `kind` — absent means `case-study`, which is what everything saved before walkthroughs existed is. A **case study** (`CaseStudyContent`) holds an ordered list of `screens` plus a `preview` card; a `Screen` has a `layout` (`cover`, `overview`, `basic1`, `basic2`, `quote`, `metrics`, `gallery`, `showcase`, `bento`, `video`) and one flat bag of optional fields, and which of them it uses depends on its layout. A **walkthrough** (`WalkthroughContent`) holds `steps` plus the demo `target`s they run in. Both carry `preview`. The package only renders and edits the object; the host app stores it.
- **Rendering** (`src/core.tsx`): `ScreenView` renders any screen onto a fixed 1280×720 canvas (`STAGE_W`/`STAGE_H`). `Stage` scales that canvas to fit its parent, and `bleedBg`/`backdropFor` fill the letterbox margins around it. All layout math is in stage pixels. The `B_*` constants hold the spacing for the Basic templates. Entrance animations use the motion variants in core (`screenVariants`, `buildContainer`/`buildItem`), and each has a reduced-motion version.
- **Player** (`src/Player.tsx`): full-viewport, one screen at a time, spatial-push transitions, arrow keys and click navigation, Esc calls `onExit`.
- **Text markup** (`src/ui/renderStyledText.tsx`): screen text fields are plain strings with a small inline syntax: `{red}`, `**bold**`, `{**bold red**}`, `[label](url)` for a link, `[gray]` for muted text. Stored copy relies on it, so changing the syntax breaks existing projects. The other files in `src/ui/` are the shared presentational pieces (device frames, lightbox, preview card, image library modal).
- **Builder** (`src/Builder.tsx` + `src/editors.tsx`): a controlled editor. The host passes `content`/`setContent` and owns saving. `layoutPatch` seeds default list content (the `DEFAULT_*` constants in core) the first time a screen switches to a layout, so the canvas never shows an empty shell. It renders the same `ScreenView` as the player.
- **Walkthroughs** (`src/walkthrough/`): stepped copy in a side panel beside a live demo of the product, which the reader actually clicks. A `WalkthroughStep` carries the panel copy, an optional `spotlight` (the marks to highlight, optionally `lock`ing out clicks elsewhere), an `enter` (the app, route and seed it starts from) and an `advance` (`manual`, `click`, `path`, `signal`, or `any` of those). `WalkthroughPlayer.tsx` plays one, `WalkthroughBuilder.tsx` edits it, and `stage.tsx` holds the frame, scaling, measuring and spotlight they share. There is no fixed canvas here — the demo gets a real viewport width and the stage scales to fit it — so none of the `STAGE_*` math applies. A walkthrough can cross several apps: a step names one with `enter.app`, and a step that names none stays in whichever app the steps before it named, resolved by looking backwards through the steps so that jumping straight to a step lands where walking there would.
- **The demo contract** (described in `src/walkthrough/types.ts`): a demo has to hold up five rules, and adding an app means making them true of it — `data-walkthrough="<id>"` on anything a step points at (never CSS selectors, which rot), hash routes, boot from `?wt=<seed>`, fixtures instead of network, and a build with `base: "./"`. `?wt=` is sent even with no seed, so its presence is what tells the app it is in a walkthrough. A `wt:signal` custom event covers what a click can't express ("the upload finished").
- **The driver** (`src/walkthrough/driver.ts`): the only way the player touches the demo, so how it reaches it stays swappable. `sameOriginDriver` reads the frame's document directly and needs nothing shipped inside the product; a cross-origin demo would need the same `Driver` interface implemented over postMessage against a small script in it. The frame's elements come from another realm, so recognise them by shape (`asElement`) — `instanceof Element` is always false across it. Pick mode is what lets the builder choose a mark by clicking the product.
- **Host integration** (`src/config.tsx`): the optional `CaseStudyProvider` supplies `assets` (`upload`/`list`/`libraryUrl`) and `useImageCaption`. Without `assets`, image fields are URL-only. `useImageCaption` is called as a hook, so it must be the same function on every render.
- **Project files** (`src/project.ts`): `migrate()` never throws. It branches on `kind`, fills defaults and stamps `schemaVersion` (`SCHEMA_VERSION`). Bump the version and add a migration step when the saved shape changes; additive optional fields need neither. Old screens without a `theme` get one inferred at render time (`screenTheme`), not in migration. `withAssetBase` rewrites site-relative asset paths; it must cover every URL field on `Screen`/`ProjectPreview`, a walkthrough's step images and each of its demo targets, so update it when adding one. `ProjectSummary`, one row of `index.json`, carries `kind`, `count` (screens or steps) and `preview`; `cover` is null for a walkthrough, and `screens` stays as a deprecated alias so sites already reading the index keep working.
- **ProjectBuilder** (`app/`, configured by the root `vite.config.ts` with `root: "app"`): hash routes `#/` (list), `#/<id>` (play), `#/<id>/edit`. Projects live in `projects/<id>/project.json` with images in `projects/<id>/images/`, and the folder is the single copy of a project that other sites load. `app/projects-plugin.ts` serves `projects/` from disk in dev, handles `/__projects/*` writes (create, save, publish, rename, duplicate, delete, upload), generates `projects/index.json` on request, and copies `projects/` into the build. A project with `draft: true` is left out of the build and its index; new projects and duplicates start as drafts, and save keeps the flag on disk, so only Publish on the list changes it. Editing is dev only (`canEdit = import.meta.env.DEV` in `app/store.ts`); the build is read-only. Image paths are stored as `/projects/<id>/images/<name>`. The build is deployed by Vercel (`vercel.json`) to `https://projects.tomcoggia.com`, with CORS open on `/projects/*`, and other apps (tomcoggia-com first) read it with `projectSource(base)` from `src/project.ts`, which makes image paths absolute. Projects are only authored here; consumers never store a copy. Which published projects a site shows is decided by that site, never by the project (`preview.show` is deprecated and ignored). Duplicate copies the images and rewrites those paths to the new id. Ids are slugs taken from the name when a project is created, and they never change.
- **Public API**: `src/index.ts` is the only entry point. Anything a host should use has to be exported there.

## Conventions

- In the package (`src/`), all styling is inline `style` objects. There are no CSS files or classNames, apart from one scrollbar rule in `PhoneMockup`. The app (`app/`) has its own stylesheet, `app/app.css`.
- Brand colors come from `src/theme.ts`. Rendering uses `RED`/`INK`, which are `var(--cs-accent, …)`/`var(--cs-ink, …)` so hosts can re-skin them. Values stored in project data (a screen's `accent`) must be real hex values (`DEFAULT_ACCENT`), never CSS variables.
- ESM with `moduleResolution: "Bundler"`: relative imports in `src/` use the `.js` extension (`./core.js`), even for `.tsx` sources.
- Files open with a short header comment (`// ─── Section ───`) describing their role. Match that style.
