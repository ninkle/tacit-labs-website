/* Gap Map — scoping tool: arena rendering + selection store */
(function () {
  const D = window.GAPMAP;
  if (!D) return;

  const AUTO = {
    insilico:   { label: "Currently AI-addressable",     color: "var(--auto-insilico)",   sw: "sw-insilico" },
    human:      { label: "Requires human judgement",     color: "var(--auto-human)",      sw: "sw-human" },
    physical:   { label: "Requires physical execution",  color: "var(--auto-physical)",   sw: "sw-physical" },
    regulatory: { label: "Requires regulatory sign-off", color: "var(--auto-regulatory)", sw: "sw-regulatory" },
    other:      { label: "Other",                     color: "var(--muted)",           sw: "" },
  };
  const AUTO_ORDER = ["insilico", "human", "physical", "regulatory", "other"];
  const PHASE = {
    discovery:   { label: "Discovery",      color: "#232323" },
    preclinical: { label: "Preclinical",    color: "#5F7470" },
    clinical:    { label: "Clinical",       color: "#B0542F" },
    regulatory:  { label: "Regulatory",     color: "#C0871C" },
    postmarket:  { label: "Post-market",    color: "#8A8B84" },
    framing:     { label: "Framing",        color: "#232323" },
    experiment:  { label: "Experiment",     color: "#5F7470" },
    inference:   { label: "Inference",      color: "#B0542F" },
    rigor:       { label: "Rigour",         color: "#C0871C" },
    impact:      { label: "Impact",         color: "#8A8B84" },
  };

  const CAPS = {}; D.vocab.capabilities.forEach(c => CAPS[c.k] = c);
  const TOOLS = {}; D.vocab.tools.forEach(t => TOOLS[t.k] = t);
  const VER = {}; (D.vocab.verification || []).forEach(v => VER[v.k] = v);
  /* how a theme gets graded — drives cost more than anything else here */
  const VER_STYLE = {
    rubric:        { color: "var(--ver-rubric)",        sw: "sw-rubric" },
    retrospective: { color: "var(--ver-retrospective)", sw: "sw-retrospective" },
    computational: { color: "var(--ver-computational)", sw: "sw-computational" },
    experimental:  { color: "var(--ver-experimental)",  sw: "sw-experimental" },
  };
  const VER_ORDER = ["rubric", "retrospective", "computational", "experimental"];

  /* Where an example came from. These make three different claims and a
     customer should be able to tell them apart without knowing anything about
     us — "from our benchmark" means nothing to someone landing here cold. */
  const EX_KIND = {
    task: {
      btn: "View task", badge: "EXISTING TASK", cls: "real",
      note: "An existing task authored and graded by a scientist in the relevant field.",
    },
    taxonomy: {
      btn: "View example", badge: "PRIOR ENGAGEMENT", cls: "past",
      note: "Representative of tasks delivered for this theme in a prior engagement.",
    },
    sketch: {
      btn: "View example", badge: "ILLUSTRATIVE", cls: "illus",
      note: "A placeholder generated before expert task authoring; not a completed evaluation task.",
    },
  };

  const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
  const esc = s => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  /* ================================================================ LOOKUP */
  const LOOKUP = Object.create(null);
  Object.values(D.arenas).forEach(arena => {
    Object.keys(arena.data).forEach(tab => {
      arena.data[tab].stages.forEach(s => {
        s.tasks.forEach(t => {
          LOOKUP[t.uid] = {
            kind: "task", uid: t.uid, arena: arena.id, arenaLabel: arena.label,
            tab: tab, stage: s.id, stageName: s.name, phase: s.phase,
            label: t.label, cat: t.cat, specifics: t.specifics, auto: t.auto,
            caps: t.caps || [], tools: t.tools || [], proposed: !!t.proposed,
            verify: t.verify || null, screen: !!t.screen,
          };
        });
      });
    });
  });

  /* ================================================================= STORE */
  const KEY = "gapmap_selection_v3";
  const IDX = D.index;
  const POS = Object.create(null);
  IDX.forEach((u, i) => POS[u] = i);

  function encode(uids) {
    const pos = uids.map(u => POS[u]).filter(p => p != null).sort((a, b) => a - b);
    let prev = 0;
    return pos.map(p => { const d = p - prev; prev = p; return d.toString(36); }).join(".");
  }
  function decode(str) {
    if (!str) return [];
    const out = []; let cur = 0;
    str.split(".").forEach(tok => {
      const d = parseInt(tok, 36);
      if (isNaN(d)) return;
      cur += d;
      if (IDX[cur]) out.push(IDX[cur]);
    });
    return out;
  }

  const listeners = [];
  const Store = {
    sel: new Set(),
    lookup: LOOKUP,
    has(u) { return this.sel.has(u); },
    toggle(u) { this.sel.has(u) ? this.sel.delete(u) : this.sel.add(u); this.changed(); },
    add(list) { list.forEach(u => this.sel.add(u)); this.changed(); },
    remove(list) { list.forEach(u => this.sel.delete(u)); this.changed(); },
    clear() { this.sel.clear(); this.changed(); },
    get size() { return this.sel.size; },
    records() { return [...this.sel].map(u => LOOKUP[u]).filter(Boolean); },
    byArena(a) { return this.records().filter(r => r.arena === a); },
    permalink() {
      const u = new URL(location.href);
      u.hash = "s=" + encode([...this.sel]);
      return u.toString();
    },
    onChange(cb) { listeners.push(cb); },
    changed() {
      try { localStorage.setItem(KEY, JSON.stringify([...this.sel])); } catch (e) {}
      listeners.forEach(cb => cb(this));
    },
  };
  window.GapMapStore = Store;
  window.GapMapMeta = { AUTO, AUTO_ORDER, PHASE, CAPS, TOOLS, VER, VER_ORDER, esc, el };

  (function restore() {
    const m = /(?:^|[#&])s=([^&]+)/.exec(location.hash);
    let uids = [];
    if (m) uids = decode(m[1]);
    else { try { uids = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) {} }
    uids.forEach(u => { if (LOOKUP[u]) Store.sel.add(u); });
  })();

  /* ================================================================= STATE */
  const state = {};   // per-arena: {tab, stage}
  Object.values(D.arenas).forEach(a => {
    state[a.id] = { tab: a.tabs[0], stage: null };
  });
  /* Capability/tool filtering. No UI drives this today — the standalone filter
     section was removed — but the tags are still on every subtask and the spine
     and drawer respect this, so re-adding a control is just wiring. Exposed on
     window.GapMapRender.filters. */
  const filters = { caps: new Set(), tools: new Set() };

  function matchesFilter(t) {
    if (!filters.caps.size && !filters.tools.size) return true;
    const c = t.caps || [], w = t.tools || [];
    for (const k of filters.caps) if (!c.includes(k)) return false;
    for (const k of filters.tools) if (!w.includes(k)) return false;
    return true;
  }

  /* ============================================================== RENDERING */
  function arenaHost(arenaId, part) {
    return document.querySelector(`[data-arena="${arenaId}"] [data-part="${part}"]`);
  }

  function renderTabs(arena) {
    const host = arenaHost(arena.id, "tabs");
    host.innerHTML = "";
    arena.tabs.forEach(tab => {
      const b = el("button", "tab", esc(tab));
      b.setAttribute("role", "tab");
      b.dataset.tab = tab;
      b.onclick = () => {
        state[arena.id].tab = tab;
        state[arena.id].stage = null;
        renderArena(arena);
      };
      host.appendChild(b);
    });
  }

  function renderStats(arena) {
    const host = arenaHost(arena.id, "stats");
    if (!host) return;
    const d = arena.data[state[arena.id].tab];
    host.innerHTML = "";
    const stat = (v, l) => { const s = el("div", "stat"); s.appendChild(el("div", "v", v)); s.appendChild(el("div", "l", l)); return s; };
    const all = d.stages.reduce((a, s) => a.concat(s.tasks), []);
    const sel = all.filter(t => Store.has(t.uid)).length;

    if (arena.id === "applied") {
      const counts = {};
      all.forEach(t => counts[t.auto] = (counts[t.auto] || 0) + 1);
      const pct = k => Math.round(100 * (counts[k] || 0) / (all.length || 1));
      host.appendChild(stat(all.length, "Subtasks in scope"));
      host.appendChild(stat(pct("insilico") + "<small>%</small>", "Currently AI-addressable"));
      host.appendChild(stat(d.stages.filter(s => s.decision).length, "Go / no-go decisions"));
    } else {
      const rub = all.filter(t => t.verify === "rubric").length;
      const scr = all.filter(t => t.screen).length;
      host.appendChild(stat(all.length, "Themes in scope"));
      host.appendChild(stat(Math.round(100 * rub / (all.length || 1)) + "<small>%</small>",
                            "Rubric-scored"));
      host.appendChild(stat(scr, "Require a wet-lab screen"));
    }
    host.appendChild(stat(sel, "Selected"));
  }

  function renderSpine(arena) {
    const host = arenaHost(arena.id, "spine");
    host.innerHTML = "";
    const d = arena.data[state[arena.id].tab];
    d.stages.forEach(s => {
      const card = el("div", "gate");
      card.dataset.stage = s.id;
      card.dataset.arena = arena.id;
      const ph = PHASE[s.phase] || {};
      card.appendChild(el("div", "phase",
        `<span class="phase-dot" style="background:${ph.color}"></span>${esc((ph.label || s.phase).toUpperCase())}`));
      card.appendChild(el("div", "gid", esc(s.id)));
      card.appendChild(el("div", "gname", esc(s.name)));

      const visible = s.tasks.filter(matchesFilter).length;
      const label = arena.id === "applied" ? "subtasks" : "themes";
      card.appendChild(el("div", "count",
        `${visible}<small>${visible === s.n ? label : label + " of " + s.n}</small>`));

      if (arena.mix) {
        const keys = arena.mix === "auto" ? AUTO_ORDER : VER_ORDER;
        const meta = k => arena.mix === "auto"
          ? { label: AUTO[k].label, color: AUTO[k].color }
          : { label: (VER[k] || {}).label || k, color: VER_STYLE[k].color };
        const mix = el("div", "mix");
        keys.forEach(k => {
          if (!s.counts[k]) return;
          const m = meta(k);
          const sp = el("span");
          sp.style.width = (100 * s.counts[k] / s.n) + "%";
          sp.style.background = m.color;
          sp.title = `${m.label}: ${s.counts[k]}`;
          mix.appendChild(sp);
        });
        card.appendChild(mix);
      }

      if (s.blurb) card.appendChild(el("div", "gblurb", esc(s.blurb)));

      if (s.decision) {
        const head = arena.id === "applied" ? "KEY DECISION" : "KEY QUESTION";
        card.appendChild(el("div", "decision",
          `<span class="dmark"></span><span class="dtxt"><b>${head}</b>${esc(s.decision)}</span>`));
      }

      const foot = el("div", "gate-foot");
      const badge = el("span", "gsel", "");
      badge.dataset.badge = arena.id + "-" + s.id;
      const addBtn = el("button", "gadd", "");
      addBtn.dataset.add = arena.id + "-" + s.id;
      addBtn.onclick = e => {
        e.stopPropagation();
        const uids = s.tasks.filter(matchesFilter).map(t => t.uid);
        uids.every(u => Store.has(u)) ? Store.remove(uids) : Store.add(uids);
      };
      foot.appendChild(badge); foot.appendChild(addBtn);
      card.appendChild(foot);

      card.onclick = () => {
        state[arena.id].stage = state[arena.id].stage === s.id ? null : s.id;
        renderDrawer(arena);
        syncSpine(arena);
        if (state[arena.id].stage) scrollTo(arenaHost(arena.id, "drawer"));
      };
      host.appendChild(card);
    });
    syncSpine(arena);
  }

  function syncSpine(arena) {
    const d = arena.data[state[arena.id].tab];
    d.stages.forEach(s => {
      const vis = s.tasks.filter(matchesFilter);
      const n = vis.filter(t => Store.has(t.uid)).length;
      const badge = document.querySelector(`[data-badge="${arena.id}-${s.id}"]`);
      const btn = document.querySelector(`[data-add="${arena.id}-${s.id}"]`);
      if (badge) {
        badge.textContent = n ? `${n}/${vis.length} selected` : "";
        badge.classList.toggle("on", n > 0);
      }
      if (btn) {
        btn.textContent = (vis.length && n === vis.length) ? "Clear" : "Add all";
        btn.disabled = !vis.length;
      }
      const card = document.querySelector(`.gate[data-arena="${arena.id}"][data-stage="${s.id}"]`);
      if (card) {
        card.classList.toggle("haspick", n > 0);
        card.classList.toggle("empty", !vis.length);
        card.setAttribute("aria-selected", state[arena.id].stage === s.id);
      }
    });
  }

  function tagRow(t) {
    const bits = [];
    (t.caps || []).forEach(k => {
      const c = CAPS[k];
      if (c) bits.push(`<span class="tag cap" title="${esc(c.desc)}">${esc(c.label)}</span>`);
    });
    (t.tools || []).forEach(k => {
      const w = TOOLS[k];
      if (w) bits.push(`<span class="tag tool" title="${esc(w.desc)}">${esc(w.label)}</span>`);
    });
    return bits.length ? `<div class="tags">${bits.join("")}</div>` : "";
  }

  function renderDrawer(arena) {
    const drawer = arenaHost(arena.id, "drawer");
    const sid = state[arena.id].stage;
    if (!sid) { drawer.hidden = true; drawer.innerHTML = ""; return; }
    const d = arena.data[state[arena.id].tab];
    const s = d.stages.find(x => x.id === sid);
    if (!s) { drawer.hidden = true; return; }
    drawer.hidden = false;
    drawer.innerHTML = "";

    const head = el("div", "drawer-head");
    head.appendChild(el("span", "gid", esc(s.id)));
    head.appendChild(el("h3", null, esc(s.name)));
    const vis = s.tasks.filter(matchesFilter);
    head.appendChild(el("span", "meta",
      `${vis.length}${vis.length !== s.n ? " of " + s.n : ""} · ${esc(state[arena.id].tab)}`));
    const uids = vis.map(t => t.uid);
    const all = el("button", "drawer-all", "");
    const syncAll = () => {
      all.textContent = uids.length && uids.every(u => Store.has(u))
        ? "Clear all" : `Select all ${uids.length}`;
      all.disabled = !uids.length;
    };
    all.onclick = () => {
      uids.every(u => Store.has(u)) ? Store.remove(uids) : Store.add(uids);
      syncAll();
    };
    syncAll();
    all.dataset.drawerAll = arena.id + "|" + s.id;
    head.appendChild(all);
    drawer.appendChild(head);

    if (s.blurb) drawer.appendChild(el("div", "drawer-blurb", esc(s.blurb)));

    if (s.decision) {
      const dec = el("div", "drawer-decision");
      dec.appendChild(el("span", "dmark"));
      const head2 = arena.id === "applied"
        ? "Decision at this stage" : "Question at this stage";
      dec.appendChild(el("div", "t", `<b>${head2}</b>${esc(s.decision)}`));
      drawer.appendChild(dec);
    }

    const groups = el("div", "catgroups");
    const order = arena.cats.filter(c => c !== "Decision (Go/No-Go)");
    order.forEach(cat => {
      const items = vis.filter(t => t.cat === cat);
      if (!items.length) return;
      const grp = el("div", "catgroup");
      grp.appendChild(el("h4", null, `${esc(cat)}<span class="c">${items.length}</span>`));
      const list = el("div", "tasklist");
      items.forEach(t => {
        const a = (arena.mix === "verify" && t.verify)
          ? { color: VER_STYLE[t.verify].color,
              label: (VER[t.verify] || {}).label || t.verify,
              sw: VER_STYLE[t.verify].sw }
          : (AUTO[t.auto] || AUTO.other);
        const task = el("div", "task");
        task.setAttribute("role", "button");
        task.tabIndex = 0;
        task.onkeydown = e => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); Store.toggle(t.uid); }
        };
        task.dataset.uid = t.uid;
        const bar = el("span", "bar"); bar.style.background = a.color; task.appendChild(bar);

        const body = el("div", "body");
        body.appendChild(el("div", "tl",
          esc(t.label) + (t.proposed ? '<span class="pill-proposed" title="Proposed by Tacit Labs; not derived from prior customer data">proposed</span>' : "")));
        const meta = [];
        meta.push(`<span class="st" title="${esc((VER[t.verify] || {}).desc || "")}">` +
          `<i class="swatch ${a.sw}"></i>${esc(a.label)}</span>`);
        if (t.screen) meta.push(`<span class="st needs-screen">requires a wet-lab screen</span>`);
        if (t.specifics) meta.push(`<span class="st">${esc(t.specifics)}</span>`);
        body.appendChild(el("div", "ts", meta.join("")));
        if (t.caps || t.tools) body.insertAdjacentHTML("beforeend", tagRow(t));

        if (t.ex) {
          const k = EX_KIND[t.ex.kind] || EX_KIND.sketch;
          const btn = el("button", "exbtn", k.btn + " ↓");
          btn.setAttribute("aria-expanded", "false");
          const panel = el("div", "expanel");
          panel.hidden = true;
          const title = (t.ex.kind === "task" && t.ex.title)
            ? `<div class="extitle">${esc(t.ex.title)}` +
              (t.ex.id ? `<span class="exref">${esc(t.ex.id)}</span>` : "") + `</div>`
            : "";
          const hdr = `<div class="exhead"><span class="exid ${k.cls}">${k.badge}</span>` +
            `<span class="exnote">${k.note}</span></div>` + title;
          const more = (t.ex.more && t.ex.more.length)
            ? `<div class="exmore"><b>Additional examples in this theme</b>${t.ex.more.map(m => `<div>· ${esc(m)}</div>`).join("")}</div>`
            : "";
          panel.innerHTML = hdr + `<div class="exq">${esc(t.ex.q)}</div>` + more;
          btn.onclick = e => {
            e.stopPropagation();
            const open = panel.hidden;
            panel.hidden = !open;
            btn.textContent = k.btn + (open ? " ↑" : " ↓");
            btn.setAttribute("aria-expanded", String(open));
          };
          body.appendChild(btn);
          body.appendChild(panel);
        }

        task.appendChild(body);
        task.appendChild(el("span", "tick", "✓"));
        task.onclick = () => Store.toggle(t.uid);
        list.appendChild(task);
      });
      grp.appendChild(list);
      groups.appendChild(grp);
    });
    drawer.appendChild(groups);
    syncTicks();
  }

  function syncTicks() {
    document.querySelectorAll(".task[data-uid]").forEach(n =>
      n.classList.toggle("on", Store.has(n.dataset.uid)));
    document.querySelectorAll("[data-drawer-all]").forEach(all => {
      const [aid, sid] = all.dataset.drawerAll.split("|");
      const arena = D.arenas[aid];
      const st = arena.data[state[aid].tab].stages.find(x => x.id === sid);
      if (!st) return;
      const uids = st.tasks.filter(matchesFilter).map(t => t.uid);
      all.textContent = uids.length && uids.every(u => Store.has(u))
        ? "Clear all" : `Select all ${uids.length}`;
    });
  }

  function scrollTo(node) {
    requestAnimationFrame(() => {
      window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" });
    });
  }

  function renderArena(arena) {
    document.querySelectorAll(`[data-arena="${arena.id}"] [data-part="tabs"] .tab`)
      .forEach(b => b.setAttribute("aria-selected", b.dataset.tab === state[arena.id].tab));
    renderStats(arena);
    renderSpine(arena);
    renderDrawer(arena);
  }

  /* ================================================================== INIT */
  Object.values(D.arenas).forEach(arena => {
    renderTabs(arena);
    renderArena(arena);
  });

  Store.onChange(() => {
    Object.values(D.arenas).forEach(syncSpine);
    Object.values(D.arenas).forEach(renderStats);
    syncTicks();
  });

  window.GapMapRender = { renderArena, arenas: D.arenas, state, filters };
})();
