// ─── Relay (walkthrough demo) ──────────────────────────────────────
// A throwaway fixture app, here only to be driven by a walkthrough. It is
// written to the five demo-contract rules: stable data-walkthrough ids, hash
// routes, ?wt=<state> seeding at boot, fixtures instead of network, and a
// wt:signal event for what a click alone can't express.

const SEEDS = {
  fresh: [],
  "has-projects": [
    { name: "marketing-site", env: "Production", when: "2 hours ago" },
    { name: "docs", env: "Preview", when: "yesterday" },
    { name: "api-gateway", env: "Production", when: "3 days ago" },
  ],
};

const ACTIVITY = [
  "Build succeeded — marketing-site",
  "Cache invalidated — docs",
  "Domain verified — relay.test",
  "Build succeeded — api-gateway",
  "Preview created — docs",
  "Member invited — sam@relay.test",
  "Build succeeded — docs",
  "Rollback completed — api-gateway",
  "Token rotated — deploy-bot",
  "Build succeeded — marketing-site",
  "Alias assigned — relay.test",
  "Preview expired — marketing-site",
];

const seed = new URLSearchParams(location.search).get("wt");

const state = {
  projects: [...(SEEDS[seed] ?? SEEDS.fresh)],
  autoPublish: seed === "has-projects",
  modal: false,
  draft: "",
  toast: "",
};

/** The one thing the walkthrough can't read from a click: something finished. */
const signal = (name, extra = {}) => window.dispatchEvent(new CustomEvent("wt:signal", { detail: { ...extra, name } }));

const route = () => (location.hash.replace(/^#\/?/, "").split("/")[0] || "overview");

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function overview() {
  const list = state.projects.length
    ? `<div class="list">${state.projects
        .map((p) => `<div class="item"><span class="dot"></span><b>${esc(p.name)}</b><i>${esc(p.env)} · ${esc(p.when)}</i></div>`)
        .join("")}</div>`
    : `<div class="empty">No projects yet. Create one to get started.</div>`;

  return `
    <div class="row">
      <div><h1>Overview</h1><p class="lede">Everything deployed under this team.</p></div>
      <button class="btn" data-walkthrough="new-project" data-action="open">New project</button>
    </div>
    <div class="stats">
      <div class="stat"><b>${state.projects.length}</b><i>Projects</i></div>
      <div class="stat"><b>${state.projects.length ? 128 : 0}</b><i>Deployments</i></div>
      <div class="stat"><b>99.98%</b><i>Uptime</i></div>
    </div>
    <h2>Projects</h2>
    ${list}
    <h2>Recent activity</h2>
    <div class="list">${ACTIVITY.map((a) => `<div class="item"><span class="dot"></span><b>${esc(a)}</b></div>`).join("")}</div>
  `;
}

function settings() {
  return `
    <h1>Settings</h1>
    <p class="lede">How this team ships by default.</p>
    <label class="field"><span>Team name</span><input type="text" value="Relay" data-walkthrough="team-name" /></label>
    <h2>Deployments</h2>
    <button class="toggle" data-walkthrough="auto-publish" data-action="toggle" aria-pressed="${state.autoPublish}">
      <p>Auto-publish previews<br /><small>Promote a passing preview to production.</small></p>
      <span class="switch"></span>
    </button>
    <div class="row" style="justify-content:flex-start;margin-top:24px">
      <button class="btn" data-walkthrough="save" data-action="save">Save changes</button>
      <button class="btn btn--ghost" data-action="noop">Discard</button>
    </div>
  `;
}

function render() {
  const at = route();
  document.getElementById("app").innerHTML = `
    <div class="shell">
      <aside class="side">
        <div class="brand"><span></span>Relay</div>
        <nav class="nav">
          <a href="#/overview" data-walkthrough="nav-overview" ${at === "overview" ? 'aria-current="page"' : ""}>Overview</a>
          <a href="#/settings" data-walkthrough="nav-settings" ${at === "settings" ? 'aria-current="page"' : ""}>Settings</a>
          <a href="#/overview" data-walkthrough="nav-members">Members</a>
        </nav>
      </aside>
      <main class="main">${at === "settings" ? settings() : overview()}</main>
    </div>
    ${
      state.modal
        ? `<div class="scrim"><div class="modal">
             <h3>New project</h3>
             <label class="field"><span>Name</span><input type="text" data-walkthrough="project-name" value="${esc(state.draft)}" placeholder="my-new-app" /></label>
             <div class="row">
               <button class="btn btn--ghost" data-action="cancel">Cancel</button>
               <button class="btn" data-walkthrough="create" data-action="create">Create project</button>
             </div>
           </div></div>`
        : ""
    }
    ${state.toast ? `<div class="toast">${esc(state.toast)}</div>` : ""}
  `;
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;

  if (action === "open") {
    state.modal = true;
    state.draft = "";
  } else if (action === "cancel") {
    state.modal = false;
  } else if (action === "create") {
    const name = (document.querySelector('[data-walkthrough="project-name"]')?.value || "my-new-app").trim();
    state.projects = [{ name, env: "Preview", when: "just now" }, ...state.projects];
    state.modal = false;
    render();
    signal("project-created", { name });
    return;
  } else if (action === "toggle") {
    state.autoPublish = !state.autoPublish;
  } else if (action === "save") {
    state.toast = "Settings saved";
    render();
    signal("settings-saved", { autoPublish: state.autoPublish });
    setTimeout(() => {
      state.toast = "";
      render();
    }, 2400);
    return;
  }
  render();
});

// Keep what's typed across re-renders.
document.addEventListener("input", (e) => {
  if (e.target.matches('[data-walkthrough="project-name"]')) state.draft = e.target.value;
});

window.addEventListener("hashchange", render);
render();
