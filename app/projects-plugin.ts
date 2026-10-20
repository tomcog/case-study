import type { Plugin } from "vite";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

// ─── Project files ─────────────────────────────────────────────────
// Every project lives in projects/<id>/: project.json plus an images/ folder.
// That folder is the one copy of the project; other sites load it from here.
// Saving is dev only, so a change goes live the usual way: commit and push.
//
//   GET  /projects/index.json                       one row per project, built from disk
//   GET  /projects/<id>/…                           project files, straight from disk
//   POST /__projects/create     { title, data }     → { id }  new folder, id from the title
//   POST /__projects/save       { id, data }        → overwrites project.json
//   POST /__projects/rename     { id, title }       → sets the title (the id never changes)
//   POST /__projects/duplicate  { id, title }       → { id }  copies the folder, images included
//   POST /__projects/delete     { id }              → removes the folder
//   POST /__projects/upload     { id, fileName, dataUrl } → { path }  into projects/<id>/images/
//   GET  /__projects/images?id=<id>                 image names in projects/<id>/images/
//
// A build copies projects/ into the output with a static index.json, giving a
// read-only site that other apps can load projects from.

const MIME: Record<string, string> = {
  ".json": "application/json",
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

export function projectsPlugin(dir: string): Plugin {
  const projectFile = (id: string) => join(dir, id, "project.json");
  const imagesDir = (id: string) => join(dir, id, "images");
  const ids = () => (existsSync(dir) ? readdirSync(dir).filter((f) => ID.test(f) && existsSync(projectFile(f))) : []);
  const read = (id: string) => JSON.parse(readFileSync(projectFile(id), "utf8"));
  const write = (id: string, data: unknown) => {
    mkdirSync(join(dir, id), { recursive: true });
    writeFileSync(projectFile(id), `${JSON.stringify(data, null, 2)}\n`);
  };

  // What the project list needs, without loading every project in full.
  function index() {
    return ids()
      .map((id) => {
        const data = read(id);
        return {
          id,
          title: data.title || data.preview?.title || id,
          screens: data.screens?.length ?? 0,
          cover: data.screens?.[0] ?? null,
          show: data.preview?.show !== false,
          updatedAt: statSync(projectFile(id)).mtimeMs,
        };
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // A new id from a title: "SimpleScreen CRC" → "simplescreen-crc", suffixed if taken.
  function freeId(title: string) {
    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "project";
    let id = base;
    for (let i = 2; existsSync(join(dir, id)); i++) id = `${base}-${i}`;
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
      write(id, { ...input.data, title: input.title });
      return [200, { id }];
    }

    // Everything else acts on an existing project.
    if (!ID.test(input.id ?? "") || !existsSync(projectFile(input.id))) return [404, { error: "No such project" }];
    const { id } = input;

    if (path === "/__projects/save") {
      write(id, input.data);
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
      write(copy, { ...JSON.parse(text), title: input.title });
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

        if (req.method === "GET" && path === "/projects/index.json") return reply(200, index());

        // Read from disk on every request: files saved since the server started are never stale.
        if (req.method === "GET" && path.startsWith("/projects/")) {
          const file = join(dir, decodeURIComponent(path.slice("/projects/".length)));
          if (!file.startsWith(dir + "/") || !existsSync(file) || statSync(file).isDirectory()) return next();
          const type = MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
          res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" }).end(readFileSync(file));
          return;
        }

        if (!path.startsWith("/__projects/")) return next();

        if (req.method === "GET" && path === "/__projects/images") {
          const id = url.searchParams.get("id") ?? "";
          if (!ID.test(id) || !existsSync(imagesDir(id))) return reply(200, []);
          return reply(200, readdirSync(imagesDir(id)).filter((name) => IMAGE.test(name)));
        }
        if (req.method !== "POST") return next();

        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            reply(...handle(path, JSON.parse(body)));
          } catch (err) {
            reply(400, { error: (err as Error).message });
          }
        });
      });
    },

    writeBundle() {
      if (!existsSync(dir)) return;
      cpSync(dir, join(outDir, "projects"), { recursive: true, filter: (src) => basename(src) !== ".DS_Store" });
      writeFileSync(join(outDir, "projects", "index.json"), `${JSON.stringify(index(), null, 2)}\n`);
    },
  };
}
