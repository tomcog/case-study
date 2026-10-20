import { loadProject, migrate, type CaseStudyAssets, type CaseStudyContent, type ProjectSummary } from "../src/index.js";

// ─── Talking to projects/ ──────────────────────────────────────────
// Reads work anywhere the app is served. Writes go to the dev server's
// project-files plugin (app/projects-plugin.ts), so editing is dev only.

export const canEdit = import.meta.env.DEV;

export type ProjectRow = ProjectSummary;

export async function listProjects(): Promise<ProjectRow[]> {
  const res = await fetch("/projects/index.json", { cache: "no-store" });
  return res.ok ? res.json() : [];
}

export const getProject = (id: string) => loadProject(`/projects/${id}/project.json`);

async function post<T = { ok: true }>(action: string, body: unknown): Promise<T> {
  const res = await fetch(`/__projects/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Couldn't ${action} (${res.status})`);
  return json;
}

/** A new project starts from the package's starter deck, so it opens fully composed. */
export const createProject = (title: string) => post<{ id: string }>("create", { title, data: migrate(null) });
export const saveProject = (id: string, data: CaseStudyContent) => post("save", { id, data });
export const renameProject = (id: string, title: string) => post("rename", { id, title });
export const publishProject = (id: string, published: boolean) => post("publish", { id, published });
export const duplicateProject = (id: string, title: string) => post<{ id: string }>("duplicate", { id, title });
export const deleteProject = (id: string) => post("delete", { id });

/** Send a pending save even while the page is closing. */
export function beaconProject(id: string, data: CaseStudyContent) {
  navigator.sendBeacon("/__projects/save", new Blob([JSON.stringify({ id, data })], { type: "application/json" }));
}

/** Upload and Browse for one project: its images live in projects/<id>/images/. */
export function projectAssets(id: string): CaseStudyAssets {
  return {
    async upload(file) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const { path } = await post<{ path: string }>("upload", { id, fileName: file.name, dataUrl });
      return path;
    },
    list: () => fetch(`/__projects/images?id=${encodeURIComponent(id)}`).then((r) => (r.ok ? r.json() : [])),
    libraryUrl: (name) => `/projects/${id}/images/${name}`,
  };
}
