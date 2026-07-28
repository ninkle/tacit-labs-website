/* Gap Map — selection basket, review + brief flow, export/submit */
(function () {
  const D = window.GAPMAP;
  const Store = window.GapMapStore;
  const M = window.GapMapMeta || {};
  const { esc, el, CAPS, TOOLS } = M;
  if (!D || !Store) return;

  /* Where finished scopes are POSTed. Leave empty to fall back to the
     email + CSV handoff (works on static hosting with no backend). */
  const SUBMIT_ENDPOINT = "";
  const CONTACT_EMAIL = "evals@tacitlabs.co";

  const $ = id => document.getElementById(id);
  let step = "review";
  let sending = false;
  let lastResult = null;

  /* ====================================================== DERIVED SUMMARY */
  function summary() {
    const applied = Store.byArena("applied");
    const fundamental = Store.byArena("fundamental");
    /* Applied subtasks are concrete: one eval task each. Fundamental themes
       are commissions: our pool writes ~tasksPerCell tasks per theme. */
    const authored = fundamental.length * D.tasksPerCell;
    const caps = {}, tools = {}, verify = {};
    [...applied, ...fundamental].forEach(r => {
      (r.caps || []).forEach(k => caps[k] = (caps[k] || 0) + 1);
      (r.tools || []).forEach(k => tools[k] = (tools[k] || 0) + 1);
      if (r.verify) verify[r.verify] = (verify[r.verify] || 0) + 1;
    });
    const screens = fundamental.filter(r => r.screen);
    return {
      applied, fundamental, authored,
      totalEvals: applied.length + authored,
      caps, tools, verify, screens,
    };
  }

  const topKeys = (obj, vocab, n) => Object.entries(obj)
    .sort((a, b) => b[1] - a[1]).slice(0, n)
    .map(([k, v]) => ({ k, v, label: (vocab[k] || {}).label || k }));

  /* ============================================================== EXPORT */
  function buildRows() {
    const s = summary();
    const rows = [];
    s.applied.forEach(r => rows.push({
      "Main category": r.cat,
      "Subcategory": r.stageName,
      "Subsubcategory": r.specifics || "",
      "Task Label": r.label,
      "Arena": "Applied discovery",
      "Context": r.tab,
      "Stage": r.stage,
      "Automation status": (M.AUTO[r.auto] || {}).label || r.auto,
      "Capabilities tested": (r.caps || []).map(k => (CAPS[k] || {}).label || k).join("; "),
      "Tools required": (r.tools || []).map(k => (TOOLS[k] || {}).label || k).join("; "),
      "Verified by": "",
      "Needs wet-lab screen": "",
      "Status": "Selected by customer",
    }));
    s.fundamental.forEach(r => rows.push({
      "Main category": r.cat,
      "Subcategory": r.specifics || "",
      "Subsubcategory": r.label,
      "Task Label": `(to be authored — ~${D.tasksPerCell} tasks)`,
      "Arena": "Fundamental discovery",
      "Context": r.tab,
      "Stage": r.stage,
      "Automation status": "",
      "Capabilities tested": (r.caps || []).map(k => (CAPS[k] || {}).label || k).join("; "),
      "Tools required": (r.tools || []).map(k => (TOOLS[k] || {}).label || k).join("; "),
      "Verified by": ((M.VER || {})[r.verify] || {}).label || r.verify || "",
      "Needs wet-lab screen": r.screen ? "yes" : "no",
      "Status": "Theme selected — awaiting authoring",
    }));
    return rows;
  }

  const CSV_COLS = ["Main category", "Subcategory", "Subsubcategory", "Task Label",
                    "Arena", "Context", "Stage", "Automation status",
                    "Capabilities tested", "Tools required",
                    "Verified by", "Needs wet-lab screen", "Status"];

  function toCSV(rows) {
    const q = v => {
      v = v == null ? "" : String(v);
      return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    return [CSV_COLS.join(",")]
      .concat(rows.map(r => CSV_COLS.map(c => q(r[c])).join(",")))
      .join("\n");
  }

  function briefPayload(contact) {
    const s = summary();
    return {
      submittedAt: new Date().toISOString(),
      contact: contact,
      summary: {
        appliedSubtasks: s.applied.length,
        fundamentalThemes: s.fundamental.length,
        estimatedAuthoredTasks: s.authored,
        estimatedTotalEvals: s.totalEvals,
        modalities: [...new Set(s.applied.map(r => r.tab))],
        domains: [...new Set(s.fundamental.map(r => r.tab))],
        capabilityMix: s.caps,
        toolMix: s.tools,
        verificationMix: s.verify,
        themesNeedingWetLabScreen: s.screens.map(r => r.label),
      },
      permalink: Store.permalink(),
      rows: buildRows(),
    };
  }

  function download(name, text, mime) {
    const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  const slug = s => (s || "scope").toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "").slice(0, 40);

  /* ========================================================= BASKET BAR */
  function renderBar() {
    const bar = $("basket");
    if (!bar) return;
    const s = summary();
    const n = Store.size;
    bar.hidden = n === 0;
    document.body.classList.toggle("has-basket", n > 0);
    if (!n) return;
    const bits = [];
    if (s.applied.length) bits.push(`<b>${s.applied.length}</b> applied subtask${s.applied.length === 1 ? "" : "s"}`);
    if (s.fundamental.length) bits.push(`<b>${s.fundamental.length}</b> research theme${s.fundamental.length === 1 ? "" : "s"} (≈${s.authored} tasks)`);
    $("basket-txt").innerHTML = bits.join(" &nbsp;·&nbsp; ");
    $("basket-est").innerHTML = `≈<b>${s.totalEvals}</b> evaluations in scope`;
  }

  /* =============================================================== MODAL */
  function openModal(to) {
    step = to || "review";
    $("modal").hidden = false;
    document.documentElement.classList.add("modal-open");
    renderModal(); renderFoot();
  }
  function closeModal() {
    $("modal").hidden = true;
    document.documentElement.classList.remove("modal-open");
  }

  function groupSection(title, recs, subLabel) {
    const sec = el("div", "m-sec");
    sec.appendChild(el("h4", null, `${esc(title)}<span class="c">${recs.length}</span>`));
    const byTab = {};
    recs.forEach(r => { (byTab[r.tab] = byTab[r.tab] || {}); (byTab[r.tab][r.stage] = byTab[r.tab][r.stage] || []).push(r); });
    Object.keys(byTab).sort().forEach(tab => {
      const mg = el("div", "m-mod");
      mg.appendChild(el("div", "m-modname", esc(tab)));
      Object.keys(byTab[tab]).sort().forEach(sid => {
        const list = byTab[tab][sid];
        const g = el("div", "m-gate");
        g.appendChild(el("div", "m-gatename",
          `${esc(sid)} · ${esc(list[0].stageName)} <span class="n">${list.length}</span>`));
        list.forEach(r => {
          const row = el("div", "m-row");
          row.appendChild(el("span", "m-lbl", esc(r.label)));
          const x = el("button", "m-x", "×");
          x.title = "Remove";
          x.onclick = () => { Store.remove([r.uid]); renderModal(); renderFoot(); };
          row.appendChild(x);
          g.appendChild(row);
        });
        mg.appendChild(g);
      });
      sec.appendChild(mg);
    });
    return sec;
  }

  function renderModal() {
    const body = $("modal-body");
    const s = summary();
    body.innerHTML = "";

    if (step === "review") {
      body.appendChild(el("div", "m-head",
        `<h3>Review evaluation scope</h3><p>Review the selected stages, themes and subtasks. Remove any items that are out of scope, then continue.</p>`));

      const tiles = el("div", "m-tiles");
      const tile = (v, l) => `<div class="m-tile"><div class="v">${v}</div><div class="l">${l}</div></div>`;
      tiles.innerHTML =
        tile(s.applied.length, "Applied subtasks") +
        tile(s.fundamental.length, "Research themes") +
        tile("≈" + s.authored, "Estimated tasks to author") +
        tile("≈" + s.totalEvals, "Estimated evaluations");
      body.appendChild(tiles);

      if (!Store.size) {
        body.appendChild(el("div", "m-empty",
          "No items selected. Close this window and select subtasks or themes from either arena."));
        return;
      }

      /* what this scope stresses */
      const caps = topKeys(s.caps, CAPS, 6), tools = topKeys(s.tools, TOOLS, 6);
      if (caps.length) {
        const prof = el("div", "m-profile");
        prof.appendChild(el("div", "m-profhead", "Capabilities evaluated"));
        const bars = el("div", "m-bars");
        const max = caps[0].v;
        caps.forEach(c => {
          const row = el("div", "m-bar");
          row.innerHTML = `<span class="bl">${esc(c.label)}</span>` +
            `<span class="bt"><i style="width:${Math.round(100 * c.v / max)}%"></i></span>` +
            `<span class="bv">${c.v}</span>`;
          bars.appendChild(row);
        });
        prof.appendChild(bars);
        if (tools.length) {
          prof.appendChild(el("div", "m-profhead", "Required tools"));
          const tw = el("div", "m-chips");
          tools.forEach(t => tw.appendChild(el("span", "m-toolchip", `${esc(t.label)} <b>${t.v}</b>`)));
          prof.appendChild(tw);
        }
        body.appendChild(prof);
      }

      if (s.screens.length) {
        const w = el("div", "m-screens");
        w.innerHTML =
          `<b>${s.screens.length} selected theme${s.screens.length === 1 ? "" : "s"} ` +
          `require${s.screens.length === 1 ? "s" : ""} new wet-lab ground truth.</b> ` +
          `Existing literature or datasets are insufficient to score these tasks. ` +
          `Constructing the evaluation would therefore require a commissioned experiment or ` +
          `screen before task authoring. This will affect cost and timeline: ` +
          s.screens.map(r => esc(r.label)).join(", ") + ".";
        body.appendChild(w);
      }

      if (s.applied.length) body.appendChild(groupSection("Applied discovery", s.applied));
      if (s.fundamental.length) {
        const sec = groupSection("Fundamental discovery", s.fundamental);
        sec.appendChild(el("div", "m-cells",
          `<b>${s.fundamental.length}</b> theme${s.fundamental.length === 1 ? "" : "s"} selected. ` +
          `Our expert pool authors ~${D.tasksPerCell} evaluation tasks per theme → <b>≈${s.authored}</b> tasks.`));
        body.appendChild(sec);
      }
      return;
    }

    if (step === "brief") {
      body.appendChild(el("div", "m-head",
        `<h3>Submit evaluation scope</h3><p>Provide contact and project information. We will return a proposed coverage plan, timeline and price.</p>`));
      const f = el("form", "m-form");
      f.id = "brief-form";
      f.innerHTML = `
        <label>Name<span class="req">*</span><input name="name" required autocomplete="name"></label>
        <label>Work email<span class="req">*</span><input name="email" type="email" required autocomplete="email"></label>
        <label>Organisation<span class="req">*</span><input name="org" required autocomplete="organization"></label>
        <label>Role<input name="role" placeholder="e.g. Head of Computational Biology"></label>
        <label class="wide">Evaluation objective
          <textarea name="context" rows="3" placeholder="Models under evaluation, observed limitations, and the decisions or capabilities the evaluation should measure"></textarea>
        </label>
        <label>Target timeline<select name="timeline">
          <option value="">—</option><option>Exploring / no date</option>
          <option>This quarter</option><option>Next quarter</option><option>Urgent (&lt; 1 month)</option>
        </select></label>
        <label>Additional information<input name="notes" placeholder="Optional"></label>
      `;
      body.appendChild(f);
      body.appendChild(el("div", "m-recap",
        `Sending <b>${s.applied.length}</b> applied subtasks and <b>${s.fundamental.length}</b> research themes (≈<b>${s.totalEvals}</b> evals).`));
      return;
    }

    if (step === "sent") {
      const r = lastResult || {};
      body.appendChild(el("div", "m-head", `<h3>Scope submitted</h3><p>${esc(r.message || "")}</p>`));
      const box = el("div", "m-sent");
      box.innerHTML =
        `<div class="m-sentrow"><span class="k">Scope file</span><span class="v">${esc(r.file || "")}</span></div>` +
        `<div class="m-sentrow"><span class="k">Shareable link</span><span class="v"><input readonly id="perma" value="${esc(r.permalink || "")}"></span></div>`;
      body.appendChild(box);
      const acts = el("div", "m-sentacts");
      const copy = el("button", "btn-ghost", "Copy link");
      copy.onclick = () => {
        const i = $("perma"); i.select();
        navigator.clipboard ? navigator.clipboard.writeText(i.value) : document.execCommand("copy");
        copy.textContent = "Copied";
        setTimeout(() => copy.textContent = "Copy link", 1600);
      };
      acts.appendChild(copy);
      box.appendChild(acts);
      body.appendChild(el("div", "m-note",
        "The link encodes the complete scope. Anyone with the link can view the same selection."));
      return;
    }
  }

  function renderFoot() {
    const foot = $("modal-foot");
    foot.innerHTML = "";
    const s = summary();
    if (step === "review") {
      const clear = el("button", "btn-ghost", "Clear all");
      clear.onclick = () => { if (confirm("Remove all selections?")) { Store.clear(); renderModal(); renderFoot(); } };
      const next = el("button", "btn", "Continue →");
      next.disabled = !Store.size;
      next.onclick = () => { step = "brief"; renderModal(); renderFoot(); };
      foot.appendChild(clear);
      foot.appendChild(el("span", "spacer"));
      foot.appendChild(next);
    } else if (step === "brief") {
      const back = el("button", "btn-ghost", "← Back");
      back.onclick = () => { step = "review"; renderModal(); renderFoot(); };
      const send = el("button", "btn", sending ? "Submitting…" : "Submit scope");
      send.disabled = sending;
      send.onclick = submit;
      foot.appendChild(back);
      foot.appendChild(el("span", "spacer"));
      foot.appendChild(el("span", "m-foothint", `≈${s.totalEvals} evals`));
      foot.appendChild(send);
    } else {
      const done = el("button", "btn", "Done");
      done.onclick = closeModal;
      foot.appendChild(el("span", "spacer"));
      foot.appendChild(done);
    }
  }

  /* ============================================================== SUBMIT */
  async function submit() {
    const form = $("brief-form");
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const contact = {};
    fd.forEach((v, k) => contact[k] = String(v).trim());

    sending = true; renderFoot();
    const payload = briefPayload(contact);
    const fname = `tacit-scope-${slug(contact.org)}-${new Date().toISOString().slice(0, 10)}.csv`;

    let posted = false;
    if (SUBMIT_ENDPOINT) {
      try {
        const res = await fetch(SUBMIT_ENDPOINT, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        posted = res.ok;
      } catch (e) { posted = false; }
    }

    download(fname, toCSV(payload.rows), "text/csv;charset=utf-8");
    download(fname.replace(/\.csv$/, ".json"), JSON.stringify(payload, null, 2), "application/json");

    if (!posted) {
      const link = payload.permalink;
      const lines = [
        `Name: ${contact.name}`,
        `Organisation: ${contact.org}`,
        contact.role ? `Role: ${contact.role}` : "",
        "",
        `Applied subtasks: ${payload.summary.appliedSubtasks}`,
        `Research themes: ${payload.summary.fundamentalThemes} (≈${payload.summary.estimatedAuthoredTasks} tasks to author)`,
        `Estimated total evals: ${payload.summary.estimatedTotalEvals}`,
        "",
        contact.context ? `Context: ${contact.context}` : "",
        contact.timeline ? `Timeline: ${contact.timeline}` : "",
        contact.notes ? `Notes: ${contact.notes}` : "",
        "",
        link.length < 1500 ? `Full scope: ${link}` : "(Scope attached as CSV — link too long to inline.)",
        "",
        "— generated by the Tacit Labs evaluation scoping tool",
      ].filter(Boolean).join("\n");
      const mailto = `mailto:${CONTACT_EMAIL}` +
        `?subject=${encodeURIComponent("Evaluation scope — " + (contact.org || contact.name))}` +
        `&body=${encodeURIComponent(lines)}`;
      try { window.open(mailto, "_blank"); } catch (e) {}
    }

    lastResult = {
      file: fname,
      permalink: payload.permalink,
      message: posted
        ? "Your scope has been sent to Tacit Labs. A copy has also been downloaded for your records. We will respond within two business days."
        : "A copy of your scope has been downloaded, and an email to " + CONTACT_EMAIL +
          " has been opened. Attach the CSV if it was not added automatically, then send the email.",
    };
    sending = false;
    step = "sent";
    renderModal(); renderFoot();
  }

  /* ============================================================== WIRING */
  document.addEventListener("click", e => {
    if (e.target.closest("#basket-review")) openModal("review");
    if (e.target.closest("#basket-clear")) { if (confirm("Remove all selections?")) Store.clear(); }
    if (e.target.closest("#modal-close") || e.target.id === "modal") closeModal();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !$("modal").hidden) closeModal();
  });

  Store.onChange(() => {
    renderBar();
    if (!$("modal").hidden && step === "review") { renderModal(); renderFoot(); }
  });

  const fn = $("foot-n");
  if (fn) {
    fn.textContent = Object.values(D.arenas).reduce((a, ar) =>
      a + Object.values(ar.data).reduce((b, t) => b + t.total, 0), 0);
  }
  renderBar();
})();
