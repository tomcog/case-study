import type { Plugin } from "vite";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

// ─── Project files and ingested apps ───────────────────────────────
// Every project lives in projects/<id>/: project.json plus an images/ folder.
// That folder is the one copy of the project; other sites load it from here.
// Saving is dev only, so a change goes live the usual way: commit and push.
//
// Ingested apps live beside them in apps/<id>/, one folder per app, holding
// somebody's built output exactly as it came plus an app.json naming it. The
// pool is shared: any walkthrough can run any app in it, which is why it sits
// at the root rather than inside a project. Ingesting copies the build in and
// never looks at the original again — a snapshot that can't change underneath
// a demo that depends on it.
//
//   GET  /projects/index.json                       one row per project, built from disk
//   GET  /projects/<id>/…                           project files, straight from disk
//   POST /__projects/create     { title, data }     → { id }  new folder, id from the title, a draft
//   POST /__projects/save       { id, data }        → overwrites project.json (keeps its draft flag)
//   POST /__projects/publish    { id, published }   → sets or clears the draft flag
//   POST /__projects/rename     { id, title }       → sets the title (the id never changes)
//   POST /__projects/duplicate  { id, title }       → { id }  copies the folder, images included, as a draft
//   POST /__projects/delete     { id }              → removes the folder
//   POST /__projects/upload     { id, fileName, dataUrl } → { path }  into projects/<id>/images/
//   GET  /__projects/images?id=<id>                 image names in projects/<id>/images/
//
//   GET  /apps/index.json                           one row per ingested app
//   GET  /apps/<id>/…                               an app's files, straight from disk
//   GET  /__apps/usage                              which projects run each app, drafts included
//   POST /__apps/ingest   { path, label }           → { id }  copies a built folder in
//   POST /__apps/rename   { id, label|minWidth|maxWidth|minWindow|hidden } → patches app.json (the id never changes)
//   POST /__apps/delete   { id }                    → removes the folder
//
// A build copies projects/ and apps/ into the output, each with a static
// index.json, giving a read-only site that other apps can load projects from.
// Drafts are left out.

const MIME: Record<string, string> = {
  ".json": "application/json",
  // A project may carry a built demo app (projects/<id>/demo/), served from the
  // same origin so a walkthrough can drive it. Without these it serves as
  // application/octet-stream and the browser refuses to run it.
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".map": "application/json",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
};

const ID = /^[a-z0-9][a-z0-9-]*$/;
const IMAGE = /\.(png|jpe?g|gif|webp|svg|avif|mp4)$/i;

export function projectsPlugin(dir: string, appsDir: string): Plugin {
  // ── Ingested apps ──
  const appFile = (id: string) => join(appsDir, id, "app.json");
  /** An app.json in the current shape. Before an app had a floor and a
   * ceiling, `width` was its floor and `minWidth` the narrowest window; a
   * file that still has `width` is read that way, and rewritten that way the
   * next time anything about it is saved. */
  function readApp(id: string) {
    const meta = JSON.parse(readFileSync(appFile(id), "utf8"));
    if (!("width" in meta)) return meta;
    const { width, minWidth, ...rest } = meta;
    return { ...rest, minWidth: width, minWindow: minWidth };
  }
  const appIds = () => (existsSync(appsDir) ? readdirSync(appsDir).filter((f) => ID.test(f) && existsSync(appFile(f))) : []);

  /** One row per ingested app. The entry is whatever the build calls its
   * HTML, which is index.html everywhere so far but is recorded rather than
   * assumed. */
  function apps() {
    return appIds()
      .map((id) => {
        const meta = readApp(id);
        return {
          id,
          label: meta.label || id,
          src: `/apps/${id}/${meta.entry || "index.html"}`,
          minWidth: meta.minWidth,
          maxWidth: meta.maxWidth,
          minWindow: meta.minWindow,
          hidden: meta.hidden === true ? true : undefined,
          ingestedAt: meta.ingestedAt ?? statSync(appFile(id)).mtimeMs,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  function freeAppId(label: string) {
    const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "app";
    let id = base;
    for (let i = 2; existsSync(join(appsDir, id)); i++) id = `${base}-${i}`;
    return id;
  }

  /** Copy a built folder into the pool. The source is a path on this machine,
   * since ingesting is a dev-only act by the person running the builder. */
  function ingest(input: any): [number, unknown] {
    const from = resolve(String(input.path ?? "").replace(/^~/, process.env.HOME ?? "~"));
    if (!existsSync(from) || !statSync(from).isDirectory()) return [400, { error: `No folder at ${from}` }];
    const entry = ["index.html", "index.htm"].find((name) => existsSync(join(from, name)));
    if (!entry) return [400, { error: "That folder has no index.html — point at a built output folder" }];
    const label = String(input.label ?? basename(from)).trim() || basename(from);
    const id = freeAppId(label);
    cpSync(from, join(appsDir, id), { recursive: true, filter: (src) => basename(src) !== ".DS_Store" });
    writeFileSync(appFile(id), `${JSON.stringify({ label, entry, ingestedAt: Date.now() }, null, 2)}\n`);
    return [200, { id }];
  }

  function handleApps(path: string, input: any): [number, unknown] {
    if (path === "/__apps/ingest") return ingest(input);
    if (!ID.test(input.id ?? "") || !existsSync(appFile(input.id))) return [404, { error: "No such app" }];
    if (path === "/__apps/rename") {
      const meta = readApp(input.id);
      const patch: Record<string, unknown> = {};
      for (const key of ["label", "minWidth", "maxWidth", "minWindow", "hidden"]) if (key in input) patch[key] = input[key];
      // A cleared field is an absent one: undefined overrides what app.json
      // holds and JSON.stringify drops it, so showing an app again leaves no
      // "hidden": false behind.
      if (patch.hidden === false) patch.hidden = undefined;
      writeFileSync(appFile(input.id), `${JSON.stringify({ ...meta, ...patch }, null, 2)}\n`);
      return [200, { ok: true }];
    }
    if (path === "/__apps/delete") {
      rmSync(join(appsDir, input.id), { recursive: true, force: true });
      return [200, { ok: true }];
    }
    return [404, { error: "Unknown action" }];
  }

  const projectFile = (id: string) => join(dir, id, "project.json");
  const imagesDir = (id: string) => join(dir, id, "images");
  const ids = () => (existsSync(dir) ? readdirSync(dir).filter((f) => ID.test(f) && existsSync(projectFile(f))) : []);
  const read = (id: string) => JSON.parse(readFileSync(projectFile(id), "utf8"));
  const write = (id: string, data: unknown) => {
    mkdirSync(join(dir, id), { recursive: true });
    writeFileSync(projectFile(id), `${JSON.stringify(data, null, 2)}\n`);
  };

  const isDraft = (id: string) => read(id).draft === true;

  /** Which projects run each app, drafts included. The pool is shared, so the
   * only honest count of what a deletion would break is taken across every
   * project rather than the one that happens to be open. */
  function appUsage() {
    const out: Record<string, { id: string; title: string; steps: number[] }[]> = {};
    for (const id of ids()) {
      const data = read(id);
      const steps: any[] = Array.isArray(data.steps) ? data.steps : [];
      const byApp = new Map<string, number[]>();
      steps.forEach((step, i) => {
        if (!step?.app) return;
        if (!byApp.has(step.app)) byApp.set(step.app, []);
        byApp.get(step.app)!.push(i + 1);
      });
      for (const [app, at] of byApp) (out[app] ??= []).push({ id, title: data.title || id, steps: at });
    }
    return out;
  }

  // What the project list needs, without loading every project in full. The
  // published index leaves drafts out.
  function index({ drafts }: { drafts: boolean }) {
    return ids()
      .filter((id) => drafts || !isDraft(id))
      .map((id) => {
        const data = read(id);
        // Projects saved before version 5 were a deck of screens or a list of
        // steps; both are steps now, and a deck's screens are the slides they
        // display. Read either, so the list works before a project is opened
        // and migrated on load.
        const steps: any[] = Array.isArray(data.steps) ? data.steps : [];
        const screens: any[] = Array.isArray(data.screens) ? data.screens : [];
        const slide = steps.find((s) => s?.content?.kind === "slide")?.content.screen ?? screens[0] ?? null;
        return {
          id,
          title: data.title || data.preview?.title || id,
          count: steps.length || screens.length,
          cover: slide,
          preview: data.preview ?? null,
          draft: data.draft === true,
          updatedAt: statSync(projectFile(id)).mtimeMs,
        };
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // A new id from a title: "SimpleScreen CRC" → "simplescreen-crc", suffixed if taken.
  // "apps" is the builder's own route for the shared pool, so a project can't
  // have it as an id — it would be unreachable at #/apps.
  const RESERVED = new Set(["apps"]);

  function freeId(title: string) {
    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "project";
    let id = base;
    for (let i = 2; existsSync(join(dir, id)) || RESERVED.has(id); i++) id = `${base}-${i}`;
    return id;
  }

  // A file name safe to write: no folders, no odd characters, never overwriting another image.
  function freeName(id: string, fileName: string) {
    const ext = extname(fileName).toLowerCase();
    const stem = basename(fileName, extname(fileName)).replace(/[^a-zA-Z0-9._-]+/g, "-") || "image";
    let name = `${stem}${ext}`;
    for (let i = 2; existsSync(join(imagesDir(id), name)); i++) name = `${stem}-${i}${ext}`;
    return name;
  }

  function handle(path: string, input: any): [number, unknown] {
    if (path === "/__projects/create") {
      const id = freeId(input.title ?? "");
      write(id, { ...input.data, title: input.title, draft: true });
      return [200, { id }];
    }

    // Everything else acts on an existing project.
    if (!ID.test(input.id ?? "") || !existsSync(projectFile(input.id))) return [404, { error: "No such project" }];
    const { id } = input;

    if (path === "/__projects/save") {
      // Publishing is set from the list, so an editor's save never changes it.
      write(id, { ...input.data, draft: isDraft(id) });
      return [200, { ok: true }];
    }
    if (path === "/__projects/publish") {
      write(id, { ...read(id), draft: !input.published });
      return [200, { ok: true }];
    }
    if (path === "/__projects/rename") {
      write(id, { ...read(id), title: input.title });
      return [200, { ok: true }];
    }
    if (path === "/__projects/duplicate") {
      const copy = freeId(input.title ?? "");
      if (existsSync(imagesDir(id))) cpSync(imagesDir(id), imagesDir(copy), { recursive: true });
      // Point the copy at its own images, so editing or deleting either project leaves the other alone.
      const text = readFileSync(projectFile(id), "utf8").split(`/projects/${id}/`).join(`/projects/${copy}/`);
      write(copy, { ...JSON.parse(text), title: input.title, draft: true });
      return [200, { id: copy }];
    }
    if (path === "/__projects/delete") {
      rmSync(join(dir, id), { recursive: true, force: true });
      return [200, { ok: true }];
    }
    if (path === "/__projects/upload") {
      const match = /^data:[^;]+;base64,(.+)$/.exec(input.dataUrl ?? "");
      if (!match) return [400, { error: "Expected a base64 data URL" }];
      mkdirSync(imagesDir(id), { recursive: true });
      const name = freeName(id, input.fileName ?? "image.png");
      writeFileSync(join(imagesDir(id), name), Buffer.from(match[1], "base64"));
      return [200, { path: `/projects/${id}/images/${name}` }];
    }
    return [404, { error: "Unknown action" }];
  }

  let outDir = "";

  return {
    name: "project-files",

    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const path = url.pathname;
        const reply = (status: number, body: unknown) => {
          res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(JSON.stringify(body));
        };

        // Other apps' dev servers read projects from here too (projectSource), so reads are open to any origin.
        if (req.method === "GET" && path.startsWith("/projects/")) res.setHeader("Access-Control-Allow-Origin", "*");

        if (req.method === "GET" && path.startsWith("/apps/")) res.setHeader("Access-Control-Allow-Origin", "*");

        if (req.method === "GET" && path === "/projects/index.json") return reply(200, index({ drafts: true }));
        if (req.method === "GET" && path === "/apps/index.json") return reply(200, apps());

        if (req.method === "GET" && path.startsWith("/apps/")) {
          const file = join(appsDir, decodeURIComponent(path.slice("/apps/".length)));
          if (!file.startsWith(appsDir + "/") || !existsSync(file) || statSync(file).isDirectory()) return next();
          const type = MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
          res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" }).end(readFileSync(file));
          return;
        }

        // Read from disk on every request: files saved since the server started are never stale.
        if (req.method === "GET" && path.startsWith("/projects/")) {
          const file = join(dir, decodeURIComponent(path.slice("/projects/".length)));
          if (!file.startsWith(dir + "/") || !existsSync(file) || statSync(file).isDirectory()) return next();
          const type = MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
          res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" }).end(readFileSync(file));
          return;
        }

        if (!path.startsWith("/__projects/") && !path.startsWith("/__apps/")) return next();

        if (req.method === "GET" && path === "/__projects/images") {
          const id = url.searchParams.get("id") ?? "";
          if (!ID.test(id) || !existsSync(imagesDir(id))) return reply(200, []);
          return reply(200, readdirSync(imagesDir(id)).filter((name) => IMAGE.test(name)));
        }
        if (req.method === "GET" && path === "/__apps/usage") return reply(200, appUsage());
        if (req.method !== "POST") return next();

        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            const input = JSON.parse(body);
            reply(...(path.startsWith("/__apps/") ? handleApps(path, input) : handle(path, input)));
          } catch (err) {
            reply(400, { error: (err as Error).message });
          }
        });
      });
    },

    writeBundle() {
      if (!existsSync(dir)) return;

      const drafts = new Set(ids().filter(isDraft).map((id) => join(dir, id)));
      cpSync(dir, join(outDir, "projects"), {
        recursive: true,
        filter: (src) => basename(src) !== ".DS_Store" && !drafts.has(src),
      });
      writeFileSync(join(outDir, "projects", "index.json"), `${JSON.stringify(index({ drafts: false }), null, 2)}\n`);

      if (!existsSync(appsDir)) return;
      cpSync(appsDir, join(outDir, "apps"), { recursive: true, filter: (src) => basename(src) !== ".DS_Store" });
      writeFileSync(join(outDir, "apps", "index.json"), `${JSON.stringify(apps(), null, 2)}\n`);
    },
  };
}
