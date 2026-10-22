# @tomcog/case-study

The case study (mini project) builder and immersive player from tomcoggia.com, packaged for any React 18/19 app.

A project is one JSON object (`ProjectFile`): an ordered list of `steps` plus a `preview` card. Each step says for itself which app it runs, what it displays — a slide, that app, a framed URL or an image — and what it does to the app as it opens. The package renders and edits it. The app decides where it's stored.

## Install

```bash
npm install https://github.com/tomcog/case-study/archive/refs/tags/v0.1.0.tar.gz motion github:tomcog/component-library
```

Peer dependencies: `react`, `react-dom` (18 or 19), `motion` (11+), and `@tomcoggia/ui` (0.86+), which the builders are built from.

The package ships no stylesheet of its own, so the app loads the design system's — once, wherever it sets up:

```tsx
import "@tomcoggia/ui/fonts.css";  // self-hosted DM Sans; omit it to use your own type
import "@tomcoggia/ui/styles.css";
```

Playing a project needs neither import to work, but the builders will look unstyled without them.

## Use

```tsx
import { ProjectPlayer, ProjectBuilder, CaseStudyCard, CaseStudyProvider, loadProject, previewCard } from "@tomcog/case-study";

// Play one (full screen; Esc calls onExit). `apps` is the pool its steps run.
<ProjectPlayer content={project} apps={apps} onExit={close} />

// Edit one (full screen). You own the state and the saving.
<CaseStudyProvider assets={{ upload, list, libraryUrl }}>
  <ProjectBuilder content={project} setContent={setProject} apps={apps} projectName="Acme" onClose={close} />
</CaseStudyProvider>

// Its preview card
<CaseStudyCard {...previewCard(project)} />
```

`CaseStudyProvider` is optional. Without `assets`, image fields are URL-only (no Upload / Browse buttons). Pass `useImageCaption` to give the full-size image viewer captions when a slide has none.

## Projects from another site

ProjectBuilder (below) is the one source for projects. It publishes them at `https://projects.tomcoggia.com`, and any app reads them with `projectSource`:

```ts
const projects = projectSource("https://projects.tomcoggia.com");
const rows = await projects.list();            // index.json: id, title, count, cover, preview, …
const project = await projects.get("augmedix"); // fetched, migrated, image paths made absolute
```

The published files are served with `Access-Control-Allow-Origin: *`, so no proxy is needed. To see unpublished edits, point the source at ProjectBuilder's dev server (`http://localhost:5187`), which allows any origin too. Its list includes drafts, marked `draft: true`.

Publishing a project only makes it available. Each site decides which published projects it shows, where, and in what order, by keeping its own list of ids (tomcoggia-com stores one `projectId` per presentation page).

`loadProject(url, { assetBase })` is the lower-level call underneath: it fetches, runs `migrate()` (fills defaults and stamps `schemaVersion`), and with `assetBase` rewrites site-relative paths like `/images/x.png` to absolute URLs on that site.

## Theming

Slides and builder chrome read two CSS variables, red and near-black by default:

```css
:root { --cs-accent: #0a7c86; --cs-ink: #111; }
```

A screen's own `accent` (metrics, gallery numbers, and so on) is stored in the project as a hex value.

## ProjectBuilder

The standalone app for creating, managing and editing projects, apart from any site that shows them.

```bash
npm install
npm run dev     # ProjectBuilder at http://localhost:5187
```

Each project lives in `projects/<id>/`: `project.json` plus an `images/` folder. That folder is the only copy of the project. The id comes from the name you give a new project and never changes, even if you rename it, because other sites load projects by id. Duplicate makes an independent copy with its own id and images.

Editing autosaves to those files, and only works under `npm run dev`. New projects and duplicates start as drafts; use Publish on the project list when one is ready. Commit as you go: pushing to `main` publishes everything that isn't a draft. Vercel runs `npm run build:app` (see `vercel.json`), which builds a read-only site into `app-dist/` with the projects and a generated `projects/index.json`, served at `https://projects.tomcoggia.com` for other apps to load with `projectSource`.

## Develop

```bash
npm install
npm run watch   # tsc --watch → dist/
npm run check   # type-check the package and the app
```

Apps link it with `"@tomcog/case-study": "file:../ProjectBuilder"` and `resolve.dedupe: ["react", "react-dom", "motion"]` in their Vite config. `dist/` is committed because npm 11 doesn't run a git dependency's `prepare` script unless it's approved, so installs from GitHub use the committed build. Rebuild before tagging a release.
