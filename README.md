# @tomcog/case-study

The case study (mini project) builder and immersive player from tomcoggia.com, packaged for any React 18/19 app.

A project is one JSON object (`CaseStudyContent`): an ordered list of `screens` plus a `preview` card. The package renders and edits it. The app decides where it's stored.

## Install

```bash
npm install github:tomcog/case-study#v0.1.0 motion
```

Peer dependencies: `react`, `react-dom` (18 or 19), `motion` (11+).

## Use

```tsx
import { CaseStudyPlayer, CaseStudyBuilder, CaseStudyCard, CaseStudyProvider, loadProject, previewCard } from "@tomcog/case-study";

// Play one (full screen; Esc or the X calls onExit)
<CaseStudyPlayer screens={project.screens} logoSrc={project.preview?.logo} onExit={close} />

// Edit one (full screen). You own the state and the saving.
<CaseStudyProvider assets={{ upload, list, libraryUrl }}>
  <CaseStudyBuilder content={project} setContent={setProject} projectName="Acme" onClose={close} />
</CaseStudyProvider>

// Its preview card
<CaseStudyCard {...previewCard(project)} />
```

`CaseStudyProvider` is optional. Without `assets`, image fields are URL-only (no Upload / Browse buttons). Pass `useImageCaption` to give the full-size image viewer captions when a slide has none.

## Projects from another site

```ts
const project = await loadProject("/tc/data/content/page-123.json", { assetBase: "https://www.tomcoggia.com" });
```

`loadProject` fetches, runs `migrate()` (fills defaults and stamps `schemaVersion`), and with `assetBase` rewrites site-relative paths like `/images/x.png` to absolute URLs so they load from the site that owns them. Fetch the JSON through a same-origin proxy (a Vite `server.proxy` in dev, a Vercel rewrite in production) so no CORS headers are needed.

## Theming

Slides and builder chrome read two CSS variables, red and near-black by default:

```css
:root { --cs-accent: #0a7c86; --cs-ink: #111; }
```

A screen's own `accent` (metrics, gallery numbers, and so on) is stored in the project as a hex value.

## Develop

```bash
npm install
npm run dev     # tsc --watch → dist/
```

Apps link it with `"@tomcog/case-study": "file:../case-study"` and `resolve.dedupe: ["react", "react-dom", "motion"]` in their Vite config. `dist/` is committed because npm 11 doesn't run a git dependency's `prepare` script unless it's approved, so installs from GitHub use the committed build. Rebuild before tagging a release.
