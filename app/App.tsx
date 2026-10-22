import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Copy, Eye, EyeOff, Globe, Layers, LayoutGrid, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { Button, ButtonRound, Card, InputText, Tag } from "@tomcoggia/ui";
import {
  CaseStudyProvider, ProjectBuilder, ProjectPlayer, SlideView,
  type ProjectContent,
} from "../src/index.js";
import {
  appsUsage, beaconProject, canEdit, createProject, deleteApp, deleteProject, duplicateProject, getProject, ingestApp,
  listApps, listProjects, patchApp, projectAssets, publishProject, renameProject, saveProject,
  type AppUse, type ProjectRow,
} from "./store";
import type { IngestedApp } from "../src/index.js";

// ─── ProjectBuilder ────────────────────────────────────────────────
// Create, manage and edit the projects in projects/. Hash routes:
//   #/             the project list
//   #/apps         the shared pool of ingested apps (dev only)
//   #/<id>         plays a project
//   #/<id>/edit    edits it (dev only)
//
// Both kinds of project play at #/<id>: a case study as a deck of screens, a
// walkthrough as stepped copy beside its demo.
//
// The pool is managed here rather than inside a project, because every write
// to it — ingesting, renaming, resizing, hiding, deleting — reaches every
// project at once. A project only ever chooses from it, step by step.

const go = (to: string) => (window.location.hash = to);

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

export function App() {
  const [id, mode] = useHash().replace(/^#\/?/, "").split("/").filter(Boolean);
  if (!id) return <ProjectList />;
  // Reserved: a project called "apps" would be reached at #/apps-2.
  if (id === "apps" && canEdit) return <AppsScreen />;
  if (mode === "edit" && canEdit) return <ProjectEditor key={id} id={id} />;
  return <PlayProject key={id} id={id} />;
}

/** Loads one project; null while loading. */
function useProject(id: string) {
  const [state, setState] = useState<{ project: ProjectContent } | { error: string } | null>(null);
  useEffect(() => {
    let live = true;
    getProject(id)
      .then((project) => live && setState({ project }))
      .catch(() => live && setState({ error: `There's no project called “${id}”.` }));
    return () => {
      live = false;
    };
  }, [id]);
  return state;
}

function Status({ children }: { children: ReactNode }) {
  return (
    <div className="status">
      <p>{children}</p>
      <a href="#/">All projects</a>
    </div>
  );
}

// ─── The project list ──────────────────────────────────────────────

function ProjectList() {
  const [rows, setRows] = useState<ProjectRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => listProjects().then(setRows).catch(() => setRows([]));
  useEffect(() => {
    refresh();
  }, []);

  // Runs a change, then reloads the list; a failure shows in the toast.
  async function act(change: () => Promise<unknown>) {
    try {
      await change();
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
    await refresh();
  }

  async function create(title: string) {
    try {
      const { id } = await createProject(title);
      go(`#/${id}/edit`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="list">
      <header className="list__header">
        <h1 className="wordmark">
          <LayoutGrid size={20} /> ProjectBuilder
        </h1>
        {canEdit && (
          <div className="list__actions">
            <Button asChild variant="tertiary" icon={<Layers size={16} />}>
              <a href="#/apps" title="The apps every project's steps can run">Apps</a>
            </Button>
            {!creating && (
              <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
                New project
              </Button>
            )}
          </div>
        )}
      </header>

      {creating && <NewProjectForm onCreate={create} onCancel={() => setCreating(false)} />}

      {rows?.length === 0 && !creating && (
        <p className="list__empty">{canEdit ? "No projects yet. Start one with New project." : "No projects published yet."}</p>
      )}

      <div className="grid">
        {rows?.map((row) => (
          <ProjectTile
            key={row.id}
            row={row}
            onRename={(title) => act(() => renameProject(row.id, title))}
            onPublish={(published) => act(() => publishProject(row.id, published))}
            onDuplicate={() => act(() => duplicateProject(row.id, `${row.title} copy`))}
            onDelete={() => act(() => deleteProject(row.id))}
          />
        ))}
      </div>

      {error && (
        <div className="toast" role="alert">
          {error}
          <button onClick={() => setError(null)} aria-label="Dismiss">×</button>
        </div>
      )}
    </div>
  );
}

function NewProjectForm({ onCreate, onCancel }: { onCreate: (title: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const name = title.trim();
  return (
    <form
      className="new"
      onSubmit={(e) => {
        e.preventDefault();
        if (name) onCreate(name);
      }}
    >
      <div className="new__row">
        <InputText
          id="new-title"
          className="new__input"
          label="Project name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onCancel()}
          placeholder="e.g. SimpleScreen CRC"
          autoFocus
        />
        <Button variant="primary" type="submit" disabled={!name}>Create</Button>
        <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
      </div>
      <p className="new__hint">
        Its id will be <code>{slugPreview(name)}</code>. Other sites load the project by its id, so the id stays the same if you rename the project later. A project is a list of steps, each showing a slide, an app, a URL or an image.
      </p>
    </form>
  );
}

const unit = ({ count }: ProjectRow) => (count === 1 ? "step" : "steps");

// Mirrors freeId() in projects-plugin.ts (the server adds a suffix if the id is taken or reserved).
const slugPreview = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "project";

function ProjectTile({ row, onRename, onPublish, onDuplicate, onDelete }: {
  row: ProjectRow;
  onRename: (title: string) => void;
  onPublish: (published: boolean) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  return (
    <Card variant="flat" className="tile">
      <a href={`#/${row.id}`} className="tile__thumb" aria-label={`Play ${row.title}`}>
        <Thumb row={row} />
        <span className="tile__play"><Play size={18} /></span>
      </a>
      <div className="tile__body">
        <div className="tile__title-row">
          {renaming ? (
            <RenameInput
              initial={row.title}
              onDone={(title) => {
                setRenaming(false);
                if (title && title !== row.title) onRename(title);
              }}
            />
          ) : canEdit ? (
            <button className="tile__title tile__title--editable" onClick={() => setRenaming(true)} title="Rename">
              {row.title}
            </button>
          ) : (
            <h2 className="tile__title">{row.title}</h2>
          )}
          {row.draft && <Tag title="Not published: other sites can't load it">Draft</Tag>}
        </div>
        <p className="tile__meta">
          <code>{row.id}</code> · {row.count} {unit(row)} · {ago(row.updatedAt)}
        </p>
        <div className="tile__actions">
          {/* asChild keeps these real links: cmd-click and "open in new tab" still work. */}
          {canEdit && (
            <Button asChild size="sm" variant="tertiary" icon={<Pencil size={14} />}>
              <a href={`#/${row.id}/edit`}>Edit</a>
            </Button>
          )}
          <Button asChild size="sm" variant="tertiary" icon={<Play size={14} />}>
            <a href={`#/${row.id}`}>Play</a>
          </Button>
          {canEdit && (
            <Button
              size="sm"
              variant="tertiary"
              icon={row.draft ? <Globe size={14} /> : <EyeOff size={14} />}
              onClick={() => onPublish(row.draft)}
              title={row.draft ? "Include it in the published site on the next push" : "Leave it out of the published site"}
            >
              {row.draft ? "Publish" : "Unpublish"}
            </Button>
          )}
          {canEdit && (
            <ButtonRound
              size="sm"
              variant="tertiary"
              icon={<Copy size={14} />}
              onClick={onDuplicate}
              title="Duplicate: make an independent copy"
              aria-label="Duplicate"
            />
          )}
          {canEdit && <DeleteButton onDelete={onDelete} />}
        </div>
      </div>
    </Card>
  );
}

/** The first screen, drawn at stage size and scaled into the tile. */
function Thumb({ row }: { row: ProjectRow }) {
  if (row.cover) {
    return <SlideView screen={row.cover} play reduced />;
  }
  if (row.preview?.image) return <img className="tile__cover" src={row.preview.image} alt="" />;
  return <div className="tile__empty">No preview image</div>;
}

function RenameInput({ initial, onDone }: { initial: string; onDone: (title: string) => void }) {
  const [title, setTitle] = useState(initial);
  const done = useRef(false);
  const finish = (value: string) => {
    if (done.current) return;
    done.current = true;
    onDone(value.trim());
  };
  return (
    <InputText
      className="tile__rename"
      label="Project name"
      hideLabel
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={() => finish(title)}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(title);
        if (e.key === "Escape") finish(initial);
      }}
      autoFocus
    />
  );
}

// Asks before deleting: the first click arms it ("Delete?"), a second click within 3 seconds deletes.
function DeleteButton({ onDelete, title = "Delete the project and its images" }: { onDelete: () => void; title?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <ButtonRound
      size="sm"
      tone="danger"
      variant={armed ? "primary" : "tertiary"}
      icon={<Trash2 size={14} />}
      onClick={() => (armed ? onDelete() : setArmed(true))}
      title={armed ? `Click again to delete. ${title}` : title}
      aria-label={armed ? "Confirm delete" : "Delete"}
    />
  );
}

/** "3 days ago", or "just now" under a minute. */
function since(ms: number) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  const units: [number, string][] = [[60, "minute"], [24, "hour"], [30, "day"], [12, "month"], [Infinity, "year"]];
  let n = s / 60;
  for (const [size, unit] of units) {
    if (n < size) {
      const whole = Math.floor(n);
      return `${whole} ${unit}${whole === 1 ? "" : "s"} ago`;
    }
    n /= size;
  }
  return "";
}

function ago(ms: number) {
  const when = since(ms);
  return when ? `Edited ${when}` : "";
}

// ─── The shared pool ───────────────────────────────────────────────
// Managing the pool lives here, away from any one project, because every
// write to it reaches all of them at once: a rename changes the label every
// step's picker shows, a resize changes the viewport every run gets, and a
// delete leaves every step that pointed at it running nothing. A project only
// ever chooses from what the pool holds, which is what its step picker is for.

function AppsScreen() {
  const [apps, setApps] = useState<IngestedApp[] | null>(null);
  const [usage, setUsage] = useState<Record<string, AppUse[]>>({});
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      Promise.all([listApps(), appsUsage()])
        .then(([pool, used]) => {
          setApps(pool);
          setUsage(used);
        })
        .catch(() => setApps([])),
    [],
  );
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Runs a change, then reloads the pool and its usage; a failure shows in the toast.
  async function act(change: () => Promise<unknown>) {
    try {
      await change();
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
    await refresh();
  }

  return (
    <div className="list">
      <header className="list__header">
        <h1 className="wordmark">
          <a href="#/" title="All projects"><LayoutGrid size={20} /> ProjectBuilder</a>
          <span className="wordmark__sep">/</span>
          <span className="wordmark__here">Apps</span>
        </h1>
      </header>

      <p className="apps__intro">
        The pool every project draws from. Each app is a copy of a built output, frozen at the moment it was ingested,
        so a demo can&rsquo;t break because the app it runs moved on. Everything here is shared: renaming, resizing and
        hiding reach every project at once, and deleting leaves every step that ran it running nothing.
      </p>

      <IngestForm onIngest={(path, label) => act(() => ingestApp(path, label))} />

      {apps?.length === 0 && <p className="list__empty">No apps yet. Ingest a built folder above and every project can run it.</p>}

      <div className="apps">
        {apps?.map((app) => (
          <AppCard
            key={app.id}
            app={app}
            used={usage[app.id] ?? []}
            onPatch={(patch) => act(() => patchApp(app.id, patch))}
            onDelete={() => act(() => deleteApp(app.id))}
          />
        ))}
      </div>

      {error && (
        <div className="toast" role="alert">
          {error}
          <button onClick={() => setError(null)} aria-label="Dismiss">×</button>
        </div>
      )}
    </div>
  );
}

function IngestForm({ onIngest }: { onIngest: (path: string, label: string) => void }) {
  const [path, setPath] = useState("");
  const [label, setLabel] = useState("");
  return (
    <form
      className="new"
      onSubmit={(e) => {
        e.preventDefault();
        if (path.trim()) {
          onIngest(path.trim(), label.trim());
          setPath("");
          setLabel("");
        }
      }}
    >
      <div className="new__row">
        <InputText
          id="ingest-label"
          className="new__input"
          label="App name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Provider Portal"
        />
        <InputText
          id="ingest-path"
          className="new__input"
          label="Built folder on this machine"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="/Users/you/Sites/provider-portal/dist"
        />
        <Button variant="primary" type="submit" icon={<Plus size={16} />} disabled={!path.trim()}>Ingest</Button>
      </div>
      <p className="new__hint">
        The folder its build wrote &mdash; the one with <code>index.html</code> in it, not the source. It has to be built
        with <code>base: "./"</code> and use hash routes. Anything in it can be pointed at; a <code>data-walkthrough</code> id
        on an element keeps a step finding it even after the app is re-ingested with a changed layout.
      </p>
    </form>
  );
}

function AppCard({ app, used, onPatch, onDelete }: {
  app: IngestedApp;
  used: AppUse[];
  onPatch: (patch: Partial<IngestedApp>) => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const steps = used.reduce((n, use) => n + use.steps.length, 0);
  return (
    <Card variant="flat" className="app">
      <div className="tile__title-row">
        {renaming ? (
          <RenameInput
            initial={app.label}
            onDone={(label) => {
              setRenaming(false);
              if (label && label !== app.label) onPatch({ label });
            }}
          />
        ) : (
          <button className="tile__title tile__title--editable" onClick={() => setRenaming(true)} title="Rename">
            {app.label}
          </button>
        )}
        {app.hidden && <Tag title="Left out of every step's picker; steps already running it still run it">Hidden</Tag>}
      </div>

      <p className="tile__meta">
        <code>{app.id}</code>
        {app.ingestedAt ? ` · Ingested ${since(app.ingestedAt)}` : ""}
      </p>

      <div className="app__sizes">
        <InputText
          type="number"
          size="md"
          label="Min width"
          placeholder="None"
          defaultValue={app.minWidth ?? ""}
          onBlur={(e) => onPatch({ minWidth: e.target.value ? Number(e.target.value) : undefined })}
          title="The narrowest the app lays itself out, in px. It takes the pane's width and reflows, but never below this; nothing is scaled, so a narrower pane scrolls sideways. Blank: it follows the pane all the way down"
        />
        <InputText
          type="number"
          size="md"
          label="Max width"
          placeholder="None"
          defaultValue={app.maxWidth ?? ""}
          onBlur={(e) => onPatch({ maxWidth: e.target.value ? Number(e.target.value) : undefined })}
          title="The widest the app lays itself out, in px. A pane wider than this centers the app in it. Blank: it fills the pane however wide it gets"
        />
        <InputText
          type="number"
          size="md"
          label="Min window"
          placeholder="900"
          defaultValue={app.minWindow ?? ""}
          onBlur={(e) => onPatch({ minWindow: e.target.value ? Number(e.target.value) : undefined })}
          title="The narrowest reader window worth running a demo in. Below it the player drops the frame and shows the copy alone. Measured against the browser window, not the pane"
        />
      </div>

      <Usage used={used} steps={steps} />

      <div className="tile__actions">
        <Button
          size="sm"
          variant="tertiary"
          icon={app.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
          onClick={() => onPatch({ hidden: !app.hidden })}
          title={app.hidden
            ? "Offer it again in every step's picker"
            : "Keep it out of every step's picker. Steps already running it carry on"}
        >
          {app.hidden ? "Show" : "Hide"}
        </Button>
        <DeleteButton
          onDelete={onDelete}
          title={steps
            ? `${steps} ${steps === 1 ? "step" : "steps"} run it — they'd be left running nothing`
            : "Delete the app and its files"}
        />
      </div>
    </Card>
  );
}

/** What a deletion would cost, counted across every project rather than the
 * one that happens to be open — the pool belongs to all of them. */
function Usage({ used, steps }: { used: AppUse[]; steps: number }) {
  if (!used.length) return <p className="app__usage app__usage--none">No project runs it.</p>;
  return (
    <div className="app__usage">
      <p>
        {steps} {steps === 1 ? "step" : "steps"} across {used.length} {used.length === 1 ? "project" : "projects"}
      </p>
      <ul>
        {used.map((use) => (
          <li key={use.id}>
            <a href={`#/${use.id}/edit`}>{use.title}</a>
            <span>{use.steps.length === 1 ? "step" : "steps"} {use.steps.join(", ")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Play ──────────────────────────────────────────────────────────

/** The shared pool, reloaded whenever something changes it. */
function useApps() {
  const [apps, setApps] = useState<IngestedApp[]>([]);
  const refresh = useCallback(() => listApps().then(setApps).catch(() => setApps([])), []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { apps, refresh };
}

function PlayProject({ id }: { id: string }) {
  const state = useProject(id);
  const { apps } = useApps();
  if (!state) return null;
  if ("error" in state) return <Status>{state.error}</Status>;
  const { project } = state;
  return <ProjectPlayer content={project} apps={apps} onExit={() => go("#/")} />;
}

// ─── Edit ──────────────────────────────────────────────────────────

function ProjectEditor({ id }: { id: string }) {
  const state = useProject(id);
  if (!state) return null;
  if ("error" in state) return <Status>{state.error}</Status>;
  return <Editor id={id} initial={state.project} />;
}

// Autosaves every change to projects/<id>/project.json, 300ms after typing stops.
// A pending save is sent on the way out if the tab closes first.
function Editor({ id, initial }: { id: string; initial: ProjectContent }) {
  const [content, setContent] = useState(initial);
  // Read-only here: the pool is shared, so it is managed at #/apps and a
  // project's steps only choose from what it holds.
  const { apps } = useApps();
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<ProjectContent | null>(null);
  const assets = useMemo(() => projectAssets(id), [id]);

  useEffect(() => {
    if (content === initial) return;
    pending.current = content;
    const t = window.setTimeout(() => {
      pending.current = null;
      saveProject(id, content).then(
        () => setError(null),
        (err) => setError(`Couldn't save: ${(err as Error).message}. Your next change will try again.`),
      );
    }, 300);
    return () => window.clearTimeout(t);
  }, [content, initial, id]);

  useEffect(() => {
    const flush = () => {
      if (pending.current) beaconProject(id, pending.current);
      pending.current = null;
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush(); // leaving the editor in-app (Done, or a hash change)
    };
  }, [id]);

  return (
    <CaseStudyProvider assets={assets}>
      <ProjectBuilder
        content={content}
        setContent={setContent}
        apps={apps}
        projectName={content.title || id}
        onClose={() => go("#/")}
      />
      {error && (
        <div className="toast" role="alert">
          {error}
          <button onClick={() => setError(null)} aria-label="Dismiss">×</button>
        </div>
      )}
    </CaseStudyProvider>
  );
}
