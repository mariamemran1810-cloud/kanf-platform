/* لوحة تحكم كنف — SPA بسيط بدون اعتماديات */
(() => {
  const S = {
    user: null,
    T: {},
    view: "overview",
    stats: null,
    projects: [],
    sessions: [],
    activeSession: null,
    msgs: [],
    activity: [],
    members: [],
    billing: null,
    model: { live: false, name: "" },
  };

  // ---------- أدوات ----------
  const $ = (s, r = document) => r.querySelector(s);
  const root = () => $("#view-root");
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const t = (k) => S.T[k] ?? k;
  const fmtDate = (ms) => (ms ? new Date(Number(ms)).toLocaleString(S.T.lang === "en" ? "en-GB" : "ar-EG", { dateStyle: "medium", timeStyle: "short" }) : "—");
  const fmtNum = (n) => Number(n ?? 0).toLocaleString(S.T.lang === "en" ? "en-GB" : "ar-EG");

  function toast(msg, bad) {
    const el = document.createElement("div");
    el.className = "toast" + (bad ? " bad" : "");
    el.textContent = msg;
    $("#toast-host").appendChild(el);
    setTimeout(() => el.remove(), 3400);
  }

  function modal(html) {
    const back = document.createElement("div");
    back.className = "modal-back";
    back.innerHTML = `<div class="modal">${html}</div>`;
    back.addEventListener("click", (e) => e.target === back && back.remove());
    $("#modal-host").appendChild(back);
    return back;
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      headers: { "content-type": "application/json", ...opts.headers },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      location.href = "/login.html";
      throw new Error("unauthorized");
    }
    if (!res.ok) throw Object.assign(new Error(data.error || "error"), { key: data.error });
    return data;
  }

  const roleTag = (r) =>
    `<span class="tag ${r === "owner" ? "tag-warn" : r === "admin" ? "tag-info" : "tag-mute"}">${t(r)}</span>`;
  const statusTag = (s) =>
    `<span class="tag ${s === "active" ? "tag-ok" : "tag-off"}">${t(s)}</span>`;
  const planTag = (p) =>
    `<span class="tag ${p === "enterprise" ? "tag-warn" : p === "pro" ? "tag-info" : "tag-mute"}">${t(p)}</span>`;

  // ---------- التهيئة ----------
  async function boot() {
    try {
      const me = await api("/api/me");
      S.user = me.user;
      S.T = { ...me.strings, lang: me.strings?.brand === "Kanf" ? "en" : "ar" };
      S.T.lang = window.KanfLang.get();
      renderShell();
      wireNav();
      await go(location.hash.replace("#", "") || "overview");
    } catch (e) {
      // لا يوجد خادم (موقع ثابت) أو انتهت الجلسة → صفحة الدخول تعرض الملاحظة المناسبة
      console.warn("[kanf] boot:", e?.message ?? e);
      location.href = "/login.html";
    }
  }

  function renderShell() {
    $("#me-name").textContent = S.user.name;
    $("#me-role").textContent = `${t(S.user.role)} · ${t(S.user.plan)}`;
    const av = $("#me-avatar");
    av.textContent = (S.user.name || "?").trim().charAt(0);
    av.style.background = S.user.avatar_color || "#0f766e";
    if (["admin", "owner"].includes(S.user.role)) $("#nav-members").style.display = "";
    $("#quick-new").style.display = "";
  }

  function wireNav() {
    document.querySelectorAll(".nav-item[data-view]").forEach((el) =>
      el.addEventListener("click", () => go(el.dataset.view)),
    );
    $("#lang-item").addEventListener("click", () => {
      window.KanfLang.toggle();
      location.reload();
    });
    $("#theme-item").addEventListener("click", () => window.KanfTheme.toggle());
    $("#logout-item").addEventListener("click", async () => {
      await api("/api/auth/logout", { method: "POST" });
      location.href = "/";
    });
    $("#quick-new").addEventListener("click", () => projectModal());
    window.addEventListener("hashchange", () => go(location.hash.replace("#", "") || "overview"));
    window.addEventListener("kanf:lang", () => {
      document.querySelectorAll("[data-ar]").forEach((el) => {
        const lang = window.KanfLang.get();
        el.textContent = el.getAttribute(lang === "ar" ? "data-ar" : "data-en");
      });
    });
  }

  async function go(view) {
    S.view = view;
    location.hash = view;
    document.querySelectorAll(".nav-item[data-view]").forEach((el) =>
      el.classList.toggle("active", el.dataset.view === view),
    );
    const titles = {
      overview: ["نظرة عامة", "Overview"],
      projects: ["المشاريع", "Projects"],
      agent: ["الوكيل البرمجي", "Coding agent"],
      activity: ["سجل النشاط", "Activity"],
      members: ["الأعضاء", "Members"],
      billing: ["الاشتراك", "Subscription"],
      settings: ["الإعدادات", "Settings"],
    };
    const lang = window.KanfLang.get();
    $("#view-title").textContent = titles[view]?.[lang === "ar" ? 0 : 1] ?? view;
    root().innerHTML = `<div class="skel" style="width:50%"></div><div class="skel" style="width:80%;margin-top:14px"></div>`;

    try {
      if (view === "overview") await viewOverview();
      else if (view === "projects") await viewProjects();
      else if (view === "agent") await viewAgent();
      else if (view === "activity") await viewActivity();
      else if (view === "members") await viewMembers();
      else if (view === "billing") await viewBilling();
      else if (view === "settings") await viewSettings();
    } catch (e) {
      console.error("[kanf] view error:", view, e);
      root().innerHTML = `<div class="empty"><div class="big">⚠️</div>${t(e.key || "errorPermission")}</div>`;
    }
  }

  // ---------- نظرة عامة ----------
  async function viewOverview() {
    const stats = await api("/api/stats");
    S.stats = stats;
    $("#cnt-projects").textContent = stats.projects;
    $("#cnt-sessions").textContent = stats.sessions;

    const pct = (v, max) => Math.min(100, Math.round((v / (max || 1)) * 100));
    const anns = (stats.announcements || [])
      .map(
        (a) =>
          `<div class="banner ${a.level === "success" ? "ok" : ""}"><span>📢</span><div><b>${esc(a.title)}</b><br/>${esc(a.body)}</div></div>`,
      )
      .join("");

    root().innerHTML = `
      ${anns}
      <div class="stats">
        <div class="stat"><div class="lbl">👥 ${t("totalUsers")}</div><div class="val">${fmtNum(stats.users)}</div><div class="bar"><i style="width:${pct(stats.users, 50)}%"></i></div></div>
        <div class="stat"><div class="lbl">🗂️ ${t("totalProjects")}</div><div class="val">${fmtNum(stats.projects)}</div><div class="bar"><i style="width:${pct(stats.projects, 20)}%"></i></div></div>
        <div class="stat"><div class="lbl">🤖 ${t("totalSessions")}</div><div class="val">${fmtNum(stats.sessions)}</div><div class="bar"><i style="width:${pct(stats.sessions, 40)}%"></i></div></div>
        <div class="stat"><div class="lbl">⚡ ${t("tokensUsed")}</div><div class="val">${fmtNum(stats.tokens)}</div><div class="bar"><i style="width:${pct(stats.tokens, 50000)}%"></i></div></div>
      </div>

      <div class="grid grid-2">
        <div class="panel" style="margin:0">
          <div class="panel-head"><h3>🚀 ${window.KanfLang.get()==="ar"?"بداية سريعة":"Quick start"}</h3></div>
          <div class="panel-body">
            <ol class="muted" style="padding-inline-start:20px; line-height:2.2; margin:0; font-size:15px">
              <li>${window.KanfLang.get()==="ar"?"أنشئ مشروعاً جديداً من زر «مشروع جديد»":"Create a project from the “New project” button"}</li>
              <li>${window.KanfLang.get()==="ar"?"افتح «الوكيل» وابدأ ساحة حوار":"Open “Agent” and start a chat thread"}</li>
              <li>${window.KanfLang.get()==="ar"?"أضف KANF_AI_API_KEY لتفعيل نموذج حقيقي":"Set KANF_AI_API_KEY to enable a real model"}</li>
              <li>${window.KanfLang.get()==="ar"?"راقب النشاط في «سجل النشاط»":"Watch actions in the Activity log"}</li>
            </ol>
          </div>
        </div>

        <div class="panel" style="margin:0">
          <div class="panel-head"><h3>🕓 ${window.KanfLang.get()==="ar"?"آخر النشاطات":"Recent activity"}</h3><div class="spacer"></div>
            <button class="btn btn-sm" id="ov-all">${window.KanfLang.get()==="ar"?"الكل":"All"}</button></div>
          <div class="panel-body" id="ov-act"><div class="skel"></div></div>
        </div>
      </div>`;

    $("#ov-all").addEventListener("click", () => go("activity"));
    const { activity } = await api("/api/activity");
    const box = $("#ov-act");
    box.innerHTML = activity.length
      ? activity.slice(0, 6).map((a) => actRow(a)).join("")
      : `<div class="empty" style="padding:22px">${t("emptyActivity")}</div>`;
  }

  function actRow(a) {
    return `<div class="row" style="padding:10px 0; border-bottom:1px solid var(--line); gap:12px">
      <div class="avatar" style="width:30px;height:30px;font-size:13px;background:${esc(a.avatar_color || "#64748b")}">${esc((a.user_name || "?").charAt(0))}</div>
      <div style="flex:1; min-width:0"><b style="font-size:14.3px">${esc(a.user_name || "—")}</b>
        <span class="mono muted"> ${esc(a.action)}</span>
        ${a.target ? `<span class="muted"> · ${esc(a.target)}</span>` : ""}</div>
      <div class="muted" style="font-size:12.5px; white-space:nowrap">${fmtDate(a.created_at)}</div>
    </div>`;
  }

  // ---------- المشاريع ----------
  async function viewProjects() {
    const { projects } = await api("/api/projects");
    S.projects = projects;
    $("#cnt-projects").textContent = projects.length;

    root().innerHTML = `
      <div class="panel">
        <div class="panel-head"><h3>🗂️ ${t("projects")}</h3><div class="spacer"></div>
          <button class="btn btn-primary btn-sm" id="new-p">＋ ${t("createProject")}</button></div>
        ${
          projects.length
            ? `<table><thead><tr>
                <th>${t("projectName")}</th><th>${t("description")}</th><th>${t("status")}</th>
                <th>${t("updatedAt")}</th><th>${t("actions")}</th></tr></thead>
              <tbody>${projects
                .map(
                  (p) => `<tr>
                    <td><b>${esc(p.name)}</b><div class="mono muted">${esc(p.language)}</div></td>
                    <td class="muted" style="max-width:320px">${esc(p.description || "—")}</td>
                    <td>${statusTag(p.status)}</td>
                    <td class="muted" style="white-space:nowrap">${fmtDate(p.updated_at)}</td>
                    <td><div class="row" style="gap:6px">
                      <button class="btn btn-sm" data-edit="${p.id}">${t("edit")}</button>
                      <button class="btn btn-sm btn-danger" data-del="${p.id}">${t("delete")}</button>
                    </div></td></tr>`,
                )
                .join("")}</tbody></table>`
            : `<div class="empty"><div class="big">🗂️</div>${t("emptyProjects")}</div>`
        }
      </div>`;

    $("#new-p").addEventListener("click", () => projectModal());
    root().querySelectorAll("[data-edit]").forEach((b) =>
      b.addEventListener("click", () => projectModal(S.projects.find((p) => p.id === b.dataset.edit))),
    );
    root().querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm(t("delete") + "؟")) return;
        await api(`/api/projects/${b.dataset.del}`, { method: "DELETE" });
        toast("✓ " + t("delete"));
        void viewProjects();
      }),
    );
  }

  function projectModal(p) {
    const back = modal(`
      <h3>${p ? t("edit") : t("createProject")}</h3>
      <form id="pform">
        <div class="field"><label>${t("projectName")}</label>
          <input class="input" name="name" required value="${esc(p?.name ?? "")}" /></div>
        <div class="field"><label>${t("description")}</label>
          <textarea class="textarea" name="description" rows="3">${esc(p?.description ?? "")}</textarea></div>
        <div class="field"><label>لغة المشروع</label>
          <select class="select" name="language">
            ${["typescript","javascript","python","php","go","rust","other"]
              .map((l) => `<option value="${l}" ${p?.language === l ? "selected" : ""}>${l}</option>`)
              .join("")}
          </select></div>
        ${p ? `<div class="field"><label>${t("status")}</label>
          <select class="select" name="status">
            <option value="active" ${p.status === "active" ? "selected" : ""}>${t("active")}</option>
            <option value="archived" ${p.status === "archived" ? "selected" : ""}>${t("archived")}</option>
          </select></div>` : ""}
        <div class="modal-actions">
          <button type="button" class="btn" id="pcancel">${t("cancel")}</button>
          <button type="submit" class="btn btn-primary">${t("save")}</button>
        </div>
      </form>`);
    $("#pcancel", back).addEventListener("click", () => back.remove());
    $("#pform", back).addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target).entries());
      try {
        if (p) await api(`/api/projects/${p.id}`, { method: "PATCH", body });
        else await api("/api/projects", { method: "POST", body });
        back.remove();
        toast("✓ " + t("save"));
        void viewProjects();
      } catch (err) {
        toast(t(err.key || "errorPermission"), true);
      }
    });
  }

  // ---------- الوكيل ----------
  async function viewAgent() {
    const data = await api("/api/agent/sessions");
    S.sessions = data.sessions;
    S.model = { live: data.live, name: data.model };
    $("#cnt-sessions").textContent = S.sessions.length;
    if (!S.activeSession && S.sessions.length) S.activeSession = S.sessions[0].id;

    root().innerHTML = `
      ${S.model.live ? `<div class="banner ok">✅ ${t("connected")} — <span class="mono">${esc(S.model.name)}</span></div>`
                     : `<div class="banner">💡 ${t("demoMode")}</div>`}
      <div class="agent-layout">
        <div class="chat-list">
          <button class="btn btn-primary btn-sm" id="new-s" style="width:100%; margin-bottom:10px">＋ ${window.KanfLang.get()==="ar"?"ساحة جديدة":"New thread"}</button>
          <div id="s-list"></div>
        </div>
        <div class="chat">
          <div class="msgs" id="msgs"><div class="empty">${t("emptySessions")}</div></div>
          <form class="composer" id="composer">
            <textarea class="textarea" id="prompt" rows="2" placeholder="${t("typeMessage")}"></textarea>
            <button class="btn btn-primary" type="submit" id="send">${t("send")}</button>
          </form>
        </div>
      </div>`;

    renderSessionList();
    if (S.activeSession) void loadMessages(S.activeSession);

    $("#new-s").addEventListener("click", async () => {
      const s = await api("/api/agent/sessions", { method: "POST", body: { title: window.KanfLang.get()==="ar"?"ساحة جديدة":"New thread" } });
      S.sessions.unshift(s.session);
      S.activeSession = s.session.id;
      renderSessionList();
      void loadMessages(s.session.id);
      $("#cnt-sessions").textContent = S.sessions.length;
    });

    $("#composer").addEventListener("submit", async (e) => {
      e.preventDefault();
      const box = $("#prompt");
      const content = box.value.trim();
      if (!content || !S.activeSession) return;
      box.value = "";
      appendMsg({ role: "user", content });
      $("#send").disabled = true;
      try {
        const r = await api(`/api/agent/sessions/${String(S.activeSession)}/messages`, { method: "POST", body: { content } });
        S.msgs = r.messages;
        renderMsgs();
        await refreshSessions();
      } catch (err) {
        toast(t(err.key || "errorPermission"), true);
      } finally {
        $("#send").disabled = false;
        box.focus();
      }
    });
  }

  function renderSessionList() {
    const host = $("#s-list");
    if (!host) return;
    host.innerHTML = S.sessions.length
      ? S.sessions
          .map(
            (s) => `<div class="chat-item ${s.id === S.activeSession ? "active" : ""}" data-s="${s.id}">
              <span>💬</span><span class="t">${esc(s.title)}</span>
              <span class="muted" style="font-size:11px">${fmtNum(Number(s.tokens_in) + Number(s.tokens_out))}</span></div>`,
          )
          .join("")
      : `<div class="empty" style="padding:20px">${t("emptySessions")}</div>`;
    host.querySelectorAll("[data-s]").forEach((el) =>
      el.addEventListener("click", () => {
        S.activeSession = el.dataset.s;
        renderSessionList();
        void loadMessages(el.dataset.s);
      }),
    );
  }

  async function refreshSessions() {
    const data = await api("/api/agent/sessions");
    S.sessions = data.sessions;
    $("#cnt-sessions").textContent = S.sessions.length;
    renderSessionList();
  }

  async function loadMessages(id) {
    const data = await api(`/api/agent/sessions/${id}`);
    S.msgs = data.messages;
    renderMsgs();
  }

  function appendMsg(m) {
    S.msgs.push(m);
    renderMsgs();
  }

  function renderMsgs() {
    const host = $("#msgs");
    if (!host) return;
    host.innerHTML = S.msgs.length
      ? S.msgs
          .map(
            (m) => `<div class="msg ${m.role === "user" ? "user" : "assistant"}">
              <span class="who">${m.role === "user" ? t("you") : t("assistant")}</span>${esc(m.content)}</div>`,
          )
          .join("")
      : `<div class="empty">${t("emptySessions")}</div>`;
    host.scrollTop = host.scrollHeight;
  }

  // ---------- سجل النشاط ----------
  async function viewActivity() {
    const { activity } = await api("/api/activity");
    S.activity = activity;
    root().innerHTML = `
      <div class="panel">
        <div class="panel-head"><h3>🕓 ${t("activity")}</h3><div class="spacer"></div>
          <span class="muted" style="font-size:13px">${fmtNum(activity.length)}</span></div>
        ${
          activity.length
            ? `<div class="panel-body" style="padding-top:6px">${activity.map(actRow).join("")}</div>`
            : `<div class="empty"><div class="big">🕓</div>${t("emptyActivity")}</div>`
        }
      </div>`;
  }

  // ---------- الأعضاء ----------
  async function viewMembers() {
    const { members } = await api("/api/members");
    S.members = members;
    $("#cnt-members").textContent = members.length;

    root().innerHTML = `
      <div class="panel">
        <div class="panel-head"><h3>👥 ${t("members")}</h3></div>
        <table><thead><tr>
          <th>${t("name")}</th><th>${t("email")}</th><th>${t("role")}</th>
          <th>${t("plan")}</th><th>${t("status")}</th><th>${t("actions")}</th>
        </tr></thead>
        <tbody>${members
          .map(
            (m) => `<tr data-id="${m.id}">
              <td><div class="row" style="gap:9px">
                <div class="avatar" style="width:30px;height:30px;font-size:13px;background:${esc(m.avatar_color)}">${esc(m.name.charAt(0))}</div>
                <b>${esc(m.name)}</b></div></td>
              <td class="mono muted">${esc(m.email)}</td>
              <td>${roleTag(m.role)}</td>
              <td>${planTag(m.plan)}</td>
              <td>${statusTag(m.status)}</td>
              <td><div class="row" style="gap:6px">
                <button class="btn btn-sm" data-edit="${m.id}">${t("edit")}</button>
                ${m.id !== S.user.id ? `<button class="btn btn-sm btn-danger" data-del="${m.id}">${t("delete")}</button>` : ""}
              </div></td></tr>`,
          )
          .join("")}</tbody></table>
      </div>`;

    root().querySelectorAll("[data-edit]").forEach((b) =>
      b.addEventListener("click", () => memberModal(S.members.find((m) => m.id === b.dataset.edit))),
    );
    root().querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm(t("delete") + "؟")) return;
        try {
          await api(`/api/members/${b.dataset.del}`, { method: "DELETE" });
          toast("✓ " + t("delete"));
          void viewMembers();
        } catch (e) {
          toast(t(e.key || "errorPermission"), true);
        }
      }),
    );
  }

  function memberModal(m) {
    const isOwner = S.user.role === "owner";
    const back = modal(`
      <h3>${t("edit")} — ${esc(m.name)}</h3>
      <form id="mform">
        <div class="field"><label>${t("role")}</label>
          <select class="select" name="role" ${isOwner ? "" : "disabled"}>
            <option value="member" ${m.role === "member" ? "selected" : ""}>${t("member")}</option>
            <option value="admin" ${m.role === "admin" ? "selected" : ""}>${t("admin")}</option>
            <option value="owner" ${m.role === "owner" ? "selected" : ""} ${isOwner ? "" : "disabled"}>${t("owner")}</option>
          </select></div>
        <div class="field"><label>${t("plan")}</label>
          <select class="select" name="plan">
            <option value="trial" ${m.plan === "trial" ? "selected" : ""}>${t("trial")}</option>
            <option value="pro" ${m.plan === "pro" ? "selected" : ""}>${t("pro")}</option>
            <option value="enterprise" ${m.plan === "enterprise" ? "selected" : ""}>${t("enterprise")}</option>
          </select></div>
        <div class="field"><label>${t("status")}</label>
          <select class="select" name="status">
            <option value="active" ${m.status === "active" ? "selected" : ""}>${t("active")}</option>
            <option value="suspended" ${m.status === "suspended" ? "selected" : ""}>${t("suspended")}</option>
          </select></div>
        <div class="field"><label>${t("password")} (${window.KanfLang.get()==="ar"?"اختياري":"optional"})</label>
          <input class="input" type="password" name="password" dir="ltr" placeholder="••••••••" /></div>
        <div class="modal-actions">
          <button type="button" class="btn" id="mcancel">${t("cancel")}</button>
          <button type="submit" class="btn btn-primary">${t("save")}</button>
        </div>
      </form>`);
    $("#mcancel", back).addEventListener("click", () => back.remove());
    $("#mform", back).addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target).entries());
      if (!body.password) delete body.password;
      try {
        await api(`/api/members/${m.id}`, { method: "PATCH", body });
        back.remove();
        toast("✓ " + t("save"));
        void viewMembers();
      } catch (err) {
        toast(t(err.key || "errorPermission"), true);
      }
    });
  }

  // ---------- الاشتراك ----------
  async function viewBilling() {
    const data = await api("/api/billing");
    S.billing = data;
    const plans = [
      { id: "trial", price: 0, feats: [window.KanfLang.get()==="ar"?"مشروع واحد":"1 project", window.KanfLang.get()==="ar"?"١٠ ساحات حوار":"10 threads", window.KanfLang.get()==="ar"?"وضع العرض":"Demo mode"] },
      { id: "pro", price: 4900, feats: [window.KanfLang.get()==="ar"?"١٠ مشاريع":"10 projects", window.KanfLang.get()==="ar"?"٥٠٠ ساحة حوار":"500 threads", window.KanfLang.get()==="ar"?"نموذج حقيقي":"Real model"] },
      { id: "enterprise", price: 19900, feats: [window.KanfLang.get()==="ar"?"مشاريع بلا حدود":"Unlimited projects", window.KanfLang.get()==="ar"?"فريق وصلاحيات":"Team & roles", "SSO"] },
    ];

    root().innerHTML = `
      <div class="banner ${S.user.plan !== "trial" ? "ok" : ""}">
        💳 ${window.KanfLang.get()==="ar" ? `خطتك الحالية: <b>${t(S.user.plan)}</b>` : `Current plan: <b>${t(S.user.plan)}</b>`}
      </div>
      <div class="grid grid-3">
        ${plans
          .map(
            (p) => `<div class="card price-card ${S.user.plan === p.id ? "featured" : ""}">
              ${S.user.plan === p.id ? `<span class="badge">${t("current")}</span>` : ""}
              <div class="plan-name">${t(p.id)}</div>
              <div class="amount">${fmtNum(p.price)} <span>${t("currency")} ${t("perMonth")}</span></div>
              <ul class="feat">${p.feats.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
              <button class="btn ${S.user.plan === p.id ? "" : "btn-primary"}" style="width:100%" data-plan="${p.id}" ${S.user.plan === p.id ? "disabled" : ""}>
                ${S.user.plan === p.id ? t("current") : t("upgrade")}
              </button></div>`,
          )
          .join("")}
      </div>
      ${
        S.billing.subscription
          ? `<div class="panel"><div class="panel-head"><h3>🧾 ${window.KanfLang.get()==="ar"?"بيانات الاشتراك":"Subscription details"}</h3></div>
             <div class="panel-body"><table><tbody>
               <tr><th>${t("plan")}</th><td>${planTag(S.billing.subscription.plan)}</td></tr>
               <tr><th>${window.KanfLang.get()==="ar"?"السعر":"Price"}</th><td class="mono">${fmtNum(S.billing.subscription.price)} ${t("currency")}</td></tr>
               <tr><th>${window.KanfLang.get()==="ar"?"يتجدد في":"Renews on"}</th><td>${fmtDate(S.billing.subscription.renews_at)}</td></tr>
             </tbody></table></div></div>`
          : ""
      }`;

    root().querySelectorAll("[data-plan]").forEach((b) =>
      b.addEventListener("click", async () => {
        await api("/api/billing/upgrade", { method: "POST", body: { plan: b.dataset.plan } });
        toast("✓ " + t("upgrade"));
        const me = await api("/api/me");
        S.user = me.user;
        renderShell();
        void viewBilling();
      }),
    );
  }

  // ---------- الإعدادات ----------
  async function viewSettings() {
    const colors = ["#0f766e", "#7c3aed", "#b45309", "#be123c", "#1d4ed8", "#047857", "#a21caf"];
    root().innerHTML = `
      <div class="grid grid-2">
        <div class="panel" style="margin:0">
          <div class="panel-head"><h3>👤 ${t("profile")}</h3></div>
          <div class="panel-body">
            <form id="pf">
              <div class="field"><label>${t("name")}</label>
                <input class="input" name="name" value="${esc(S.user.name)}" required /></div>
              <div class="field"><label>${t("email")}</label>
                <input class="input" value="${esc(S.user.email)}" dir="ltr" disabled /></div>
              <div class="field"><label>${t("language")}</label>
                <select class="select" name="locale">
                  <option value="ar" ${S.user.locale === "ar" ? "selected" : ""}>العربية</option>
                  <option value="en" ${S.user.locale === "en" ? "selected" : ""}>English</option>
                </select></div>
              <div class="field"><label>اللون</label>
                <div class="row">${colors.map((c) => `<label style="cursor:pointer">
                  <input type="radio" name="avatar_color" value="${c}" ${S.user.avatar_color === c ? "checked" : ""} style="display:none"/>
                  <span class="avatar" style="width:32px;height:32px;background:${c};display:grid"></span></label>`).join("")}
                </div></div>
              <button class="btn btn-primary" type="submit">${t("save")}</button>
            </form>
          </div>
        </div>

        <div class="panel" style="margin:0">
          <div class="panel-head"><h3>🔑 ${window.KanfLang.get()==="ar"?"تغيير كلمة المرور":"Change password"}</h3></div>
          <div class="panel-body">
            <form id="pwf">
              <div class="field"><label>${t("password")}</label>
                <input class="input" type="password" name="password" dir="ltr" minlength="8" required />
                <div class="hint">${t("passwordHint")}</div></div>
              <button class="btn btn-primary" type="submit">${t("save")}</button>
            </form>
            <hr style="border:0;border-top:1px solid var(--line); margin:22px 0"/>
            <div class="muted" style="font-size:14px">
              <b>${window.KanfLang.get()==="ar"?"الحسابات التجريبية":"Demo accounts"}</b><br/>
              <span class="mono" dir="ltr">owner@kanf.dev · admin@kanf.dev · member@kanf.dev</span><br/>
              <span class="mono" dir="ltr">Kanf#2026</span>
            </div>
          </div>
        </div>
      </div>`;

    $("#pf").addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target).entries());
      try {
        await api("/api/me", { method: "PATCH", body });
        toast("✓ " + t("save"));
        const me = await api("/api/me");
        S.user = me.user;
        renderShell();
        if (body.locale) location.reload();
      } catch (err) {
        toast(t(err.key || "errorPermission"), true);
      }
    });

    $("#pwf").addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target).entries());
      try {
        await api("/api/me", { method: "PATCH", body });
        toast("✓ " + t("save"));
        e.target.reset();
      } catch (err) {
        toast(t(err.key || "passwordShort"), true);
      }
    });
  }

  void boot();
})();
