import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Copy, EyeOff, Globe, LayoutGrid, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { Button, ButtonRound, Card, InputText, Tag } from "@tomcoggia/ui";
import {
  CaseStudyBuilder, CaseStudyPlayer, CaseStudyProvider, Stage, ScreenView,
  WalkthroughBuilder, WalkthroughPlayer, bleedBg, backdropFor, isWalkthrough,
  type CaseStudyContent, type ProjectContent, type ProjectKind, type WalkthroughContent,
} from "../src/index.js";
import {
  beaconProject, canEdit, createProject, deleteApp, deleteProject, duplicateProject, getProject, ingestApp,
  listApps, listProjects, patchApp, projectAssets, publishProject, renameProject, saveProject, type ProjectRow,
} from "./store";
import type { IngestedApp } from "../src/index.js";

// ─── ProjectBuilder ────────────────────────────────────────────────
// Create, manage and edit the projects in projects/. Hash routes:
//   #/             the project list
//   #/<id>         plays a project
//   #/<id>/edit    edits it (dev only)
//
// Both kinds of project play at #/<id>: a case study as a deck of screens, a
// walkthrough as stepped copy beside its demo.

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
  if (mode === "edit" && canEdit) return <ProjectEditor key={id} id={id} />;
  return <ProjectPlayer key={id} id={id} />;
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

  async function create(title: string, kind: ProjectKind) {
    try {
      const { id } = await createProject(title, kind);
      // Walkthroughs have no editor yet, so a new one opens in the player,
      // which says what it still needs.
      go(kind === "walkthrough" ? `#/${id}` : `#/${id}/edit`);
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
        {canEdit && !creating && (
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
            New project
          </Button>
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

function NewProjectForm({ onCreate, onCancel }: { onCreate: (title: string, kind: ProjectKind) => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const name = title.trim();
  return (
    <form
      className="new"
      onSubmit={(e) => {
        e.preventDefault();
        if (name) onCreate(name, "case-study");
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
        <Button variant="primary" type="submit" disabled={!name}>Case study</Button>
        <Button variant="secondary" type="button" disabled={!name} onClick={() => onCreate(name, "walkthrough")}>Walkthrough</Button>
        <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
      </div>
      <p className="new__hint">
        Its id will be <code>{slugPreview(name)}</code>. Other sites load the project by its id, so the id stays the same if you rename the project later. A case study is a deck of screens; a walkthrough is stepped copy beside a live demo.
      </p>
    </form>
  );
}

const unit = ({ kind, count }: ProjectRow) => {
  const noun = kind === "walkthrough" ? "step" : "screen";
  return count === 1 ? noun : `${noun}s`;
};

// Mirrors freeId() in projects-plugin.ts (the server adds a suffix if the id is taken).
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
    return (
      <Stage background={bleedBg(row.cover)} backdrop={backdropFor(row.cover)}>
        <ScreenView screen={row.cover} play reduced />
      </Stage>
    );
  }
  if (row.preview?.image) return <img className="tile__cover" src={row.preview.image} alt="" />;
  return <div className="tile__empty">{row.kind === "walkthrough" ? "No preview image" : "No screens"}</div>;
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
function DeleteButton({ onDelete }: { onDelete: () => void }) {
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
      title={armed ? "Click again to delete" : "Delete the project and its images"}
      aria-label={armed ? "Confirm delete" : "Delete"}
    />
  );
}

function ago(ms: number) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "Edited just now";
  const units: [number, string][] = [[60, "minute"], [24, "hour"], [30, "day"], [12, "month"], [Infinity, "year"]];
  let n = s / 60;
  for (const [size, unit] of units) {
    if (n < size) {
      const whole = Math.floor(n);
      return `Edited ${whole} ${unit}${whole === 1 ? "" : "s"} ago`;
    }
    n /= size;
  }
  return "";
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

function ProjectPlayer({ id }: { id: string }) {
  const state = useProject(id);
  const { apps } = useApps();
  if (!state) return null;
  if ("error" in state) return <Status>{state.error}</Status>;
  const { project } = state;
  if (isWalkthrough(project)) return <WalkthroughPlayer content={project} apps={apps} onExit={() => go("#/")} />;
  return <CaseStudyPlayer screens={project.screens} logoSrc={project.preview?.logo} onExit={() => go("#/")} />;
}

// ─── Edit ──────────────────────────────────────────────────────────

function ProjectEditor({ id }: { id: string }) {
  const state = useProject(id);
  if (!state) return null;
  if ("error" in state) return <Status>{state.error}</Status>;
  return <Editor id={id} initial={state.project} />;
}

// A builder only ever edits the kind it was handed, so its updater can be
// narrowed from the union the editor holds.
const narrow = <T extends ProjectContent>(set: (u: (prev: ProjectContent) => ProjectContent) => void) =>
  (u: (prev: T) => T) => set((prev) => u(prev as T));

// Autosaves every change to projects/<id>/project.json, 300ms after typing stops.
// A pending save is sent on the way out if the tab closes first.
function Editor({ id, initial }: { id: string; initial: ProjectContent }) {
  const [content, setContent] = useState(initial);
  const { apps, refresh: refreshApps } = useApps();
  // Ingesting reaches the filesystem, so the builder hands it back here. Each
  // one reloads the pool, which is what puts a new app in the step's dropdown.
  const after = <A extends unknown[]>(run: (...a: A) => Promise<unknown>) =>
    (...args: A) => run(...args).then(refreshApps);
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
      {isWalkthrough(content) ? (
        <WalkthroughBuilder
          content={content}
          setContent={narrow<WalkthroughContent>(setContent)}
          apps={apps}
          onIngestApp={after(ingestApp)}
          onPatchApp={after(patchApp)}
          onDeleteApp={after(deleteApp)}
          projectName={content.title || id}
          onClose={() => go("#/")}
        />
      ) : (
        <CaseStudyBuilder
          content={content}
          setContent={narrow<CaseStudyContent>(setContent)}
          projectName={content.title || id}
          onClose={() => go("#/")}
        />
      )}
      {error && (
        <div className="toast" role="alert">
          {error}
          <button onClick={() => setError(null)} aria-label="Dismiss">×</button>
        </div>
      )}
    </CaseStudyProvider>
  );
}
