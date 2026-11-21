import type { Plugin } from "vite";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { exec } from "node:child_process";

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
//   POST /__projects/create     { title, data, id? } → { id }  new folder, a draft; the id is the one given, or one from the title
//   POST /__projects/save       { id, data }        → overwrites project.json (keeps its draft flag)
//   POST /__projects/publish    { id, published }   → sets or clears the draft flag
//   POST /__projects/rename     { id, title }       → sets the title (the id stays)
//   POST /__projects/move       { id, to }          → { id }  changes the id: moves the folder, repoints its image paths
//   POST /__projects/duplicate  { id, title }       → { id }  copies the folder, images and ask.md included, as a draft
//   POST /__projects/delete     { id }              → removes the folder
//   POST /__projects/upload     { id, fileName, dataUrl } → { path }  into projects/<id>/images/
//   GET  /__projects/images?id=<id>                 image names in projects/<id>/images/
//   GET  /__projects/ask?id=<id>                    Ask AI Tom: on or off, the Google Doc, and ask.md's size and age
//   POST /__projects/ask        { id, enabled?, source? } → the same, after setting them
//   POST /__projects/ask-pull   { id }              → the same, after replacing ask.md with the Doc as markdown
//
//   GET  /apps/index.json                           one row per ingested app
//   GET  /apps/<id>/…                               an app's files, straight from disk
//   GET  /__apps/usage                              which projects run each app, drafts included
//   POST /__apps/ingest   { path, label }           → { id }  copies a built folder in
//   POST /__apps/reingest { id, path? }             → builds the app, then replaces its files from that folder (or the one it came from)
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
   * assumed. `source` is a path on the author's machine, so only the dev
   * server lists it; the build's index leaves it out. */
  function apps({ source = false } = {}) {
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
          source: source ? meta.source : undefined,
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

  /** A built folder to copy in, or why it can't be. The path is on this
   * machine, since ingesting is a dev-only act by the person running the
   * builder. */
  function builtFolder(path: unknown): { from: string; entry: string } | { error: string } {
    const from = resolve(String(path ?? "").replace(/^~/, process.env.HOME ?? "~"));
    if (!existsSync(from) || !statSync(from).isDirectory()) return { error: `No folder at ${from}` };
    if (from === appsDir || from.startsWith(appsDir + "/")) return { error: "That folder is already in the pool — point at the app's own build" };
    const entry = ["index.html", "index.htm"].find((name) => existsSync(join(from, name)));
    if (!entry) return { error: "That folder has no index.html — point at a built output folder" };
    return { from, entry };
  }

  const copyIn = (from: string, id: string) =>
    cpSync(from, join(appsDir, id), { recursive: true, filter: (src) => basename(src) !== ".DS_Store" });

  /** Copy a built folder into the pool, remembering where it came from so it
   * can be re-ingested from there. */
  function ingest(input: any): [number, unknown] {
    const built = builtFolder(input.path);
    if ("error" in built) return [400, built];
    const label = String(input.label ?? basename(built.from)).trim() || basename(built.from);
    const id = freeAppId(label);
    copyIn(built.from, id);
    writeFileSync(appFile(id), `${JSON.stringify({ label, entry: built.entry, source: built.from, ingestedAt: Date.now() }, null, 2)}\n`);
    return [200, { id }];
  }

  /** The project a built folder came out of: the nearest folder above it
   * whose package.json has a build script. None means a build that was
   * handed over rather than made here, which is copied as it is. */
  function projectOf(built: string): { dir: string; script: string } | undefined {
    for (let dir = dirname(built); dir !== dirname(dir); dir = dirname(dir)) {
      const pkg = join(dir, "package.json");
      if (!existsSync(pkg)) continue;
      try {
        const script = JSON.parse(readFileSync(pkg, "utf8")).scripts?.build;
        if (script) return { dir, script };
      } catch {}
    }
  }

  /** Run the app's own build, so re-ingesting takes in its latest source
   * rather than whatever was last built. When the script ends in `vite build`
   * the extra arguments reach Vite, which holds the ingest contract for the
   * app (`base: "./"`) and writes to the folder being ingested, wherever its
   * own config points. Any other build is run as it is; one that writes
   * somewhere else leaves the folder as it was, and copying that would look
   * like success.
   *
   * The build runs with `NODE_ENV=production`, because this server is a Vite
   * dev server and would otherwise hand the app its own `development`. React's
   * JSX transform reads that rather than the build mode, so an inherited
   * `development` ingests a dev build: slower, larger, and carrying the
   * author's absolute source paths in every element. */
  function buildApp(from: string, entry: string): Promise<string | undefined> {
    const found = projectOf(from);
    if (!found) return Promise.resolve(undefined);
    const project = found.dir;
    const command = /\bvite build\s*$/.test(found.script)
      ? `npm run build -- --base ./ --outDir ${JSON.stringify(from)} --emptyOutDir`
      : "npm run build";
    const started = Date.now();
    return new Promise((done) => {
      const env = { ...process.env, NODE_ENV: "production" };
      exec(command, { cwd: project, env, timeout: 5 * 60_000, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          const tail = `${stdout}${stderr}`.trim().split("\n").slice(-12).join("\n");
          return done(`The build in ${project} failed:\n${tail}`);
        }
        const fresh = existsSync(join(from, entry)) && statSync(join(from, entry)).mtimeMs >= started - 1000;
        done(fresh ? undefined : `The build in ${project} ran but didn't write to ${from}. Point Re-ingest at the folder it builds into`);
      });
    });
  }

  /** Build the app, then swap its files for the fresh copy, keeping its id
   * and app.json, so every step running it runs the new copy and keeps its
   * label, sizes and hidden flag. Everything else in the folder goes first,
   * or the old build's hashed assets would pile up beside the new ones. */
  async function reingest(id: string, input: any): Promise<[number, unknown]> {
    const meta = readApp(id);
    const built = builtFolder(input.path || meta.source);
    if ("error" in built) return [400, built];
    const failed = await buildApp(built.from, built.entry);
    if (failed) return [422, { error: failed }];
    for (const name of readdirSync(join(appsDir, id))) {
      if (name !== "app.json") rmSync(join(appsDir, id, name), { recursive: true, force: true });
    }
    copyIn(built.from, id);
    writeFileSync(appFile(id), `${JSON.stringify({ ...meta, entry: built.entry, source: built.from, ingestedAt: Date.now() }, null, 2)}\n`);
    return [200, { ok: true }];
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

  /** Why `id` can't be a new project's id, or null if it can. */
  function takenId(id: string) {
    if (!ID.test(id) || id.endsWith("-")) return "An id is lowercase letters, numbers and hyphens, starting with a letter or number";
    if (RESERVED.has(id)) return `"${id}" is reserved`;
    if (existsSync(join(dir, id))) return `A project already has the id "${id}"`;
    return null;
  }

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

  // ─── Ask AI Tom's document ───
  // A project's ask.md can be pulled from a Google Doc, so it's written where
  // it's easiest to keep adding to. Pulling is the only time the Doc is read:
  // answering reads ask.md, so a question never waits on Google.
  const askFile = (id: string) => join(dir, id, "ask.md");

  function askInfo(id: string) {
    const ask = read(id).ask ?? {};
    const file = askFile(id);
    const doc = existsSync(file) ? { chars: readFileSync(file, "utf8").length, updatedAt: statSync(file).mtimeMs } : null;
    return { enabled: ask.enabled === true, source: typeof ask.source === "string" ? ask.source : null, doc };
  }

  /** The Doc's id from its address (or the id itself). */
  const docId = (source: string) => source.match(/\/document\/d\/([\w-]+)/)?.[1] ?? (/^[\w-]{20,}$/.test(source) ? source : null);

  async function pullAsk(id: string): Promise<[number, unknown]> {
    const source = read(id).ask?.source;
    const doc = typeof source === "string" ? docId(source) : null;
    if (!doc) return [400, { error: "Add the Google Doc's link first" }];
    // The export address works for a Doc shared as "Anyone with the link can
    // view"; a private Doc answers with Google's sign-in page instead.
    const res = await fetch(`https://docs.google.com/document/d/${doc}/export?format=md`, { redirect: "follow" });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || type.includes("text/html")) {
      return [502, { error: "Couldn't read the Doc. Share it as \"Anyone with the link can view\", then pull again." }];
    }
    const markdown = (await res.text())
      // Pictures come as base64 data, which is no use to the model and can
      // run to megabytes: drop them, and the references to them.
      .replace(/^\[image\d+\]:\s*<?data:[^\n]*$/gm, "")
      .replace(/!\[[^\]]*\]\[image\d+\]/g, "")
      .replace(/!\[[^\]]*\]\(data:[^)]*\)/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    const note = `<!-- Pulled from ${source} on ${new Date().toISOString()}. Edit the Google Doc, not this file: the next pull replaces it. -->`;
    writeFileSync(askFile(id), `${note}\n\n${markdown}\n`);
    return [200, askInfo(id)];
  }

  function handle(path: string, input: any): [number, unknown] {
    if (path === "/__projects/create") {
      const asked = typeof input.id === "string" && input.id ? input.id : null;
      const problem = asked && takenId(asked);
      if (problem) return [409, { error: problem }];
      const id = asked ?? freeId(input.title ?? "");
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
    if (path === "/__projects/ask") {
      const data = read(id);
      const ask = { ...data.ask };
      if (typeof input.enabled === "boolean") ask.enabled = input.enabled;
      if (typeof input.source === "string") {
        const source = input.source.trim();
        if (source && !docId(source)) return [400, { error: "That isn't a Google Doc link" }];
        if (source) ask.source = source;
        else delete ask.source;
      }
      write(id, { ...data, ask });
      return [200, askInfo(id)];
    }
    if (path === "/__projects/publish") {
      write(id, { ...read(id), draft: !input.published });
      return [200, { ok: true }];
    }
    if (path === "/__projects/rename") {
      write(id, { ...read(id), title: input.title });
      return [200, { ok: true }];
    }
    if (path === "/__projects/move") {
      // The id is the folder's name and part of every image path the project
      // stores, so both move with it. Sites that load it by the old id stop
      // finding it; the list says so before a published project is moved.
      const to = String(input.to ?? "");
      if (to === id) return [200, { id }];
      const problem = takenId(to);
      if (problem) return [409, { error: problem }];
      renameSync(join(dir, id), join(dir, to));
      const text = readFileSync(projectFile(to), "utf8").split(`/projects/${id}/`).join(`/projects/${to}/`);
      writeFileSync(projectFile(to), text);
      return [200, { id: to }];
    }
    if (path === "/__projects/duplicate") {
      const copy = freeId(input.title ?? "");
      if (existsSync(imagesDir(id))) cpSync(imagesDir(id), imagesDir(copy), { recursive: true });
      // Ask AI Tom's document goes with it, so the copy answers as the original does.
      if (existsSync(join(dir, id, "ask.md"))) {
        mkdirSync(join(dir, copy), { recursive: true });
        cpSync(join(dir, id, "ask.md"), join(dir, copy, "ask.md"));
      }
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
        if (req.method === "GET" && path === "/apps/index.json") return reply(200, apps({ source: true }));

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
        if (req.method === "GET" && path === "/__projects/ask") {
          const id = url.searchParams.get("id") ?? "";
          if (!ID.test(id) || !existsSync(projectFile(id))) return reply(404, { error: "No such project" });
          return reply(200, askInfo(id));
        }
        if (req.method !== "POST") return next();

        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            const input = JSON.parse(body);
            // Pulling waits on Google and re-ingesting on the app's build;
            // everything else is a local file write.
            if (path === "/__apps/reingest") {
              if (!ID.test(input.id ?? "") || !existsSync(appFile(input.id))) return reply(404, { error: "No such app" });
              reingest(input.id, input).then(
                (result) => reply(...result),
                (err) => reply(500, { error: (err as Error).message }),
              );
              return;
            }
            if (path === "/__projects/ask-pull") {
              if (!ID.test(input.id ?? "") || !existsSync(projectFile(input.id))) return reply(404, { error: "No such project" });
              pullAsk(input.id).then(
                (result) => reply(...result),
                (err) => reply(502, { error: `Couldn't reach Google: ${(err as Error).message}` }),
              );
              return;
            }
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
        // ask.md is Ask AI Tom's document, read by the endpoint and never served.
        filter: (src) => basename(src) !== ".DS_Store" && basename(src) !== "ask.md" && !drafts.has(src),
      });
      writeFileSync(join(outDir, "projects", "index.json"), `${JSON.stringify(index({ drafts: false }), null, 2)}\n`);

      if (!existsSync(appsDir)) return;
      cpSync(appsDir, join(outDir, "apps"), { recursive: true, filter: (src) => basename(src) !== ".DS_Store" });
      // Where an app was ingested from is a path on the author's machine.
      for (const id of appIds()) {
        const { source, ...meta } = readApp(id);
        if (source) writeFileSync(join(outDir, "apps", id, "app.json"), `${JSON.stringify(meta, null, 2)}\n`);
      }
      writeFileSync(join(outDir, "apps", "index.json"), `${JSON.stringify(apps(), null, 2)}\n`);
    },
  };
}
