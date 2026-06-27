const app = document.querySelector("#app");

const state = {
  authed: false,
  route: "signin",
  payload: null,
  selectedItemId: null,
  selectedReportId: null,
  filter: { source: "all", sentiment: "all", bucket: "all" },
  toast: "",
  setup: {
    subject: "OpenAI",
    subjectType: "company",
    description: "Public sentiment around OpenAI as an AI-native organization and enterprise platform.",
    keywords: "OpenAI, ChatGPT, enterprise AI, AI agents",
    aliases: "ChatGPT, OpenAI API",
    intent: "Brand reputation",
    region: "Global"
  },
  sourceForm: { type: "rss", name: "", url: "" },
  recommendations: []
};

const icons = {
  dashboard: "▦",
  evidence: "◈",
  sources: "⌘",
  reports: "▤",
  alerts: "!",
  settings: "⚙"
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function bootstrap() {
  state.payload = await api("/api/bootstrap");
  render();
}

function setRoute(route) {
  state.route = route;
  state.selectedItemId = null;
  render();
}

function toast(message) {
  state.toast = message;
  render();
  setTimeout(() => {
    state.toast = "";
    render();
  }, 2600);
}

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function themeName(theme) {
  if (!theme) return "Theme";
  if (typeof theme === "string") return theme;
  return theme.name || theme.theme || "Theme";
}

function stripTags(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatTime(value) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function insightFor(item) {
  return state.payload.latestRun.itemInsights.find((insight) => insight.itemId === item.id) || {};
}

function filteredItems() {
  return state.payload.items.filter((item) => {
    const insight = insightFor(item);
    return (state.filter.source === "all" || item.sourceType === state.filter.source)
      && (state.filter.sentiment === "all" || insight.sentiment === state.filter.sentiment)
      && (state.filter.bucket === "all" || item.bucket === state.filter.bucket);
  });
}

function sentimentPercent(key) {
  const distribution = state.payload.latestRun?.summary?.distribution || { positive: 0, neutral: 0, mixed: 0, negative: 0 };
  const total = Object.values(distribution).reduce((sum, value) => sum + value, 0) || 1;
  return Math.round((distribution[key] || 0) / total * 100);
}

function sentimentStats() {
  const distribution = state.payload.latestRun?.summary?.distribution || { positive: 0, neutral: 0, mixed: 0, negative: 0 };
  const total = Object.values(distribution).reduce((sum, value) => sum + value, 0) || 1;
  return ["positive", "neutral", "mixed", "negative"].map((key) => ({
    key,
    count: distribution[key] || 0,
    percent: Math.round(((distribution[key] || 0) / total) * 100)
  }));
}

function render() {
  if (!state.authed || state.route === "signin") {
    app.innerHTML = renderSignIn();
    bindSignIn();
    return;
  }
  if (state.route === "setup") {
    app.innerHTML = renderSetup();
    bindSetup();
    return;
  }
  app.innerHTML = `
    <div class="app-shell">
      ${renderRail()}
      ${renderTopbar()}
      <main class="main">${renderRoute()}</main>
      ${renderMobileNav()}
      ${""}
      ${state.toast ? `<div class="toast">${esc(state.toast)}</div>` : ""}
    </div>
  `;
  bindShell();
}

function renderSignIn() {
  return `
    <main class="login">
      <section class="login-card">
        <div class="mark">S</div>
        <div>
          <div class="brand">PRONTO</div>
          <div class="mono tiny muted">PUBLIC SENTIMENT INTEL</div>
        </div>
        <p class="muted">Turn selected public sources into cited reputation intelligence.</p>
        <button class="btn primary" data-action="signin">Sign in with SSO</button>
        <button class="btn" data-action="demo">Continue as Guest Demo</button>
        <div class="tiny faint" style="border-top:1px solid var(--line); padding-top:14px; margin-top:10px;">
          Hackathon prototype · RSS-first · Modular OSINT connectors · Vercel secrets powered
        </div>
      </section>
    </main>
  `;
}

function bindSignIn() {
  document.querySelector("[data-action='signin']").addEventListener("click", async () => {
    state.authed = true;
    state.route = "setup";
    await bootstrap();
  });
  document.querySelector("[data-action='demo']").addEventListener("click", async () => {
    state.authed = true;
    state.route = "dashboard";
    await bootstrap();
  });
}

function renderSetup() {
  const workspace = state.payload?.workspace || {};
  return `
    <main class="setup-main">
      <section class="setup-panel">
        <div class="setup-head">
          <h1>Workspace Setup</h1>
          <p class="muted">Create your first monitor. Live AI and YouTube access come from your Vercel secrets.</p>
        </div>
        <div class="grid two" style="margin-bottom:16px;">
          <div class="panel">
            <h2>Deployment secrets</h2>
            <div class="metric"><span>OpenAI</span><span class="badge ${workspace.openaiKeyConfigured ? "positive" : "neutral"}">${workspace.openaiKeyConfigured ? "configured" : "not set"}</span></div>
            <div class="metric"><span>YouTube</span><span class="badge ${workspace.youtubeKeyConfigured ? "positive" : "neutral"}">${workspace.youtubeKeyConfigured ? "configured" : "not set"}</span></div>
          </div>
          <div class="panel">
            <h2>First run</h2>
            <p class="muted">The built-in demo workspace loads automatically, even before you add sources or connect APIs.</p>
          </div>
        </div>
        <div class="grid two">
          <label>Subject name
            <input id="setup-subject" value="${esc(state.setup.subject)}" />
          </label>
          <label>Subject type
            <select id="setup-type">
              ${["company", "person", "product", "campaign", "custom"].map((type) => `<option ${state.setup.subjectType === type ? "selected" : ""}>${type}</option>`).join("")}
            </select>
          </label>
        </div>
        <label style="margin-top:16px;">Description / context
          <textarea id="setup-description">${esc(state.setup.description)}</textarea>
        </label>
        <div class="grid two" style="margin-top:16px;">
          <label>Keywords
            <input id="setup-keywords" value="${esc(state.setup.keywords)}" />
          </label>
          <label>Aliases
            <input id="setup-aliases" value="${esc(state.setup.aliases)}" />
          </label>
        </div>
        <h2 style="margin-top:20px;">Monitoring intent</h2>
        <div class="grid four">
          ${["Brand reputation", "Executive/person reputation", "Product launch", "Crisis monitoring"].map((intent) => `
            <button class="choice ${state.setup.intent === intent ? "selected" : ""}" data-intent="${intent}">
              <strong>${intent}</strong>
              <span class="muted tiny">${intent === "Crisis monitoring" ? "Watch emerging risk clusters." : "Summarize public decision indicators."}</span>
            </button>
          `).join("")}
        </div>
        <h2 style="margin-top:20px;">Source pack integration</h2>
        <div class="grid three">
          ${[
            ["rss", "News OSINT", "RSS feeds and publisher coverage.", true],
            ["youtube", "Social Video", "YouTube searches and comments.", true],
            ["reddit", "Community Forums", "Reddit and discussion boards.", false],
            ["x", "Fast Narrative", "X search query monitoring.", false],
            ["alerts", "Alert Rules", "Risk thresholds and source health.", true],
            ["reports", "Reports", "Shareable sentiment briefings.", true]
          ].map(([key, name, text, selected]) => `
            <div class="source-pack ${selected ? "selected" : ""}">
              <div class="row between">
                <strong>${name}</strong>
                <span class="badge">${key}</span>
              </div>
              <p class="muted tiny">${text}</p>
            </div>
          `).join("")}
        </div>
        <div class="setup-actions">
          <button class="btn" data-action="skip-setup">Use demo workspace</button>
          <button class="btn primary" data-action="create-monitor">Build Workspace Dashboard →</button>
        </div>
      </section>
    </main>
  `;
}

function bindSetup() {
  document.querySelectorAll("[data-intent]").forEach((button) => {
    button.addEventListener("click", () => {
      state.setup.intent = button.dataset.intent;
      render();
    });
  });
  document.querySelector("[data-action='skip-setup']").addEventListener("click", async () => {
    state.route = "dashboard";
    await bootstrap();
  });
  document.querySelector("[data-action='create-monitor']").addEventListener("click", async () => {
    state.setup.subject = document.querySelector("#setup-subject").value;
    state.setup.subjectType = document.querySelector("#setup-type").value;
    state.setup.description = document.querySelector("#setup-description").value;
    state.setup.keywords = document.querySelector("#setup-keywords").value;
    state.setup.aliases = document.querySelector("#setup-aliases").value;
    const created = await api("/api/monitors", {
      method: "POST",
      body: {
        ...state.setup,
        keywords: state.setup.keywords.split(",").map((term) => term.trim()).filter(Boolean),
        aliases: state.setup.aliases.split(",").map((term) => term.trim()).filter(Boolean)
      }
    });
    state.payload = await api(`/api/bootstrap?monitorId=${created.monitor.id}`);
    state.route = "dashboard";
    toast("Workspace ready. Add sources and start scanning.");
  });
}

function renderRail() {
  const entries = [
    ["dashboard", icons.dashboard, "Dashboard"],
    ["evidence", icons.evidence, "Evidence"],
    ["sources", icons.sources, "Sources"],
    ["reports", icons.reports, "Reports"],
    ["alerts", icons.alerts, "Alerts"],
    ["settings", icons.settings, "Settings"]
  ];
  return `
    <aside class="rail">
      <div class="logo">S</div>
      ${entries.map(([route, icon, title]) => `
        <button class="${state.route === route ? "active" : ""}" data-route="${route}" title="${title}">
          <span class="rail-icon" aria-hidden="true">${icon}</span>
          <span class="rail-label">${title}</span>
        </button>
      `).join("")}
    </aside>
  `;
}

function renderTopbar() {
  return `
    <nav class="topbar">
      <div class="topbar-title">PRONTO</div>
      <div class="search"><span>⌕</span><input placeholder="Search indicators, sources..." /></div>
      <div class="spacer"></div>
      <button class="btn ghost hide-mobile" data-action="reset-demo">Reset demo</button>
      <button class="btn primary" data-action="scan">Run scan</button>
      <button class="btn" data-route="setup">New monitor</button>
    </nav>
  `;
}

function renderMobileNav() {
  return `
    <nav class="mobile-nav">
      ${["dashboard", "evidence", "sources", "reports", "settings"].map((route) => `<button class="${state.route === route ? "active" : ""}" data-route="${route}">${icons[route]}</button>`).join("")}
    </nav>
  `;
}

function renderRoute() {
  if (!state.payload) return `<div class="panel">Loading...</div>`;
  if (state.route === "dashboard") return renderDashboard();
  if (state.route === "evidence") return renderEvidence();
  if (state.route === "sources") return renderSources();
  if (state.route === "reports") return renderReports();
  if (state.route === "alerts") return renderAlerts();
  if (state.route === "settings") return renderSettings();
  return renderDashboard();
}

function renderDashboard() {
  const { monitor, latestRun } = state.payload;
  if (!latestRun?.summary) {
    return `
      <section class="panel" style="padding:24px;">
        <div class="tiny mono muted">CURRENT STATUS</div>
        <h1 style="margin-top:8px;">Waiting for scan...</h1>
        <p class="muted" style="max-width:62ch;">Add sources, then run the first scan to generate a situational summary, themes, and evidence-backed findings.</p>
        <div class="setup-actions" style="margin-top:16px;">
          <button class="btn primary" data-route="sources">Add sources</button>
          <button class="btn" data-action="scan">Run first scan</button>
        </div>
      </section>
    `;
  }
  const summary = latestRun.summary;
  return `
    <section class="summary-strip">
      <div class="panel risk-card">
        <div class="tiny mono muted">CURRENT SENTIMENT</div>
        <h1 class="${summary.overallSentiment === "negative" ? "negative" : ""}">${summary.overallSentiment.toUpperCase()}</h1>
        <div class="row"><span class="badge">${summary.confidence}% confidence</span><span class="badge">${state.payload.items.length} evidence items</span></div>
      </div>
      <div class="panel summary-card">
        <div class="row between">
          <div>
            <div class="tiny mono muted">SITUATIONAL SUMMARY</div>
            <h2>${esc(monitor.subject)}</h2>
          </div>
          <span class="badge">${summary.generatedBy === "openai" ? "OpenAI" : "Heuristic"} · ${formatTime(latestRun.completedAt)}</span>
        </div>
        <p>${esc(summary.executiveSummary || "Waiting for scan...")}</p>
        <p class="tiny muted" style="margin-top:10px;">${esc(summary.whatChanged || "Waiting for scan...")}</p>
        <div class="row" style="margin-top:12px;">
          <span class="badge">RECENT ${state.payload.items.filter((item) => item.bucket === "recent").length}</span>
          <span class="badge">TOP ${state.payload.items.filter((item) => item.bucket === "top").length}</span>
          <span class="badge">CONFIDENCE ${summary.confidence}%</span>
        </div>
      </div>
    </section>
    <section class="dashboard-grid">
      <div>
        <div class="section-title">
          <h2>Live Signal Feed</h2>
          <button class="btn ghost" data-route="evidence">Filter</button>
        </div>
        <div class="signal-feed">
          ${filteredItems().slice(0, 8).map(renderSignalCard).join("")}
        </div>
      </div>
      <aside class="grid">
        <div class="panel">
          <h2>Sentiment Overview</h2>
          <div class="sentiment-overview" style="margin-top:12px;">
            ${sentimentStats().map(({ key, count, percent }) => `
              <div class="sentiment-row">
                <div class="row between tiny muted">
                  <span>${key}</span>
                  <span>${count} items · ${percent}%</span>
                </div>
                <div class="sentiment-track">
                  <div class="sentiment-fill ${key}" style="width:${percent}%"></div>
                </div>
              </div>
            `).join("")}
          </div>
          <div class="row" style="margin-top:12px; flex-wrap:wrap;">
            <span class="badge">Overall ${summary.overallSentiment}</span>
            <span class="badge">${summary.confidence}% confidence</span>
          </div>
        </div>
        <div class="panel">
          <h2>Themes</h2>
          ${summary.themes.length ? summary.themes.map((theme) => `
            <div class="metric">
              <span>${esc(themeName(theme))}</span>
              <span class="badge ${theme.sentiment || "neutral"}">${theme.sentiment || "neutral"}</span>
            </div>
          `).join("") : `<p class="muted">Waiting for scan data to build themes.</p>`}
        </div>
        <div class="panel">
          <h2>Source Breakdown</h2>
          ${summary.sourceBreakdown?.length ? summary.sourceBreakdown.map((source) => `
            <div class="metric">
              <span>${esc(source.type.toUpperCase())}</span>
              <span class="badge">${source.count} · ${esc(source.sentiment)}</span>
            </div>
          `).join("") : `<p class="muted">No source breakdown yet.</p>`}
        </div>
        <div class="panel">
          <h2>Risks & Opportunities</h2>
          ${summary.risks.slice(0, 3).map((risk) => `<p class="muted" style="margin-bottom:8px;">${esc(risk)}</p>`).join("")}
          <button class="btn" data-route="reports" style="margin-top:8px;">Generate briefing</button>
        </div>
      </aside>
    </section>
  `;
}

function renderSignalCard(item) {
  const insight = insightFor(item);
  return `
    <article class="card signal-card">
      <div class="row between">
        <div class="signal-meta">
          <span>${sourceIcon(item.sourceType)}</span>
          <span class="mono tiny muted">${formatTime(item.publishedAt)}</span>
        </div>
        <div class="row">
          <span class="badge">${item.sourceType.toUpperCase()}</span>
          <span class="badge ${insight.sentiment}">${insight.sentiment || "neutral"}</span>
        </div>
      </div>
      <h3 style="margin-top:8px;">${esc(item.title)}</h3>
      <p class="muted">${esc(stripTags(item.text)).slice(0, 190)}${stripTags(item.text).length > 190 ? "..." : ""}</p>
      <div class="evidence-grid">
        <div><div class="tiny muted">Source node</div><div>${esc(item.author)}</div></div>
        <div><div class="tiny muted">Relevance</div><div>${insight.relevance || item.engagement.score}%</div></div>
      </div>
      <div class="setup-actions" style="margin-top:12px;">
        <a class="btn" target="_blank" rel="noreferrer" href="${esc(item.url)}">Open original</a>
      </div>
    </article>
  `;
}

function renderEvidence() {
  return `
    <section>
      <div class="section-title">
        <div>
          <h1>Evidence Feed</h1>
          <p class="muted">Recent and top items with item-level sentiment reasoning.</p>
        </div>
        <button class="btn primary" data-action="scan">Refresh scan</button>
      </div>
      <div class="panel" style="margin-bottom:16px;">
        <div class="grid three">
          <label>Source
            <select data-filter="source">
              ${["all", "rss", "youtube", "reddit", "x"].map((value) => `<option ${state.filter.source === value ? "selected" : ""}>${value}</option>`).join("")}
            </select>
          </label>
          <label>Sentiment
            <select data-filter="sentiment">
              ${["all", "positive", "neutral", "mixed", "negative"].map((value) => `<option ${state.filter.sentiment === value ? "selected" : ""}>${value}</option>`).join("")}
            </select>
          </label>
          <label>Set
            <select data-filter="bucket">
              ${["all", "recent", "top"].map((value) => `<option ${state.filter.bucket === value ? "selected" : ""}>${value}</option>`).join("")}
            </select>
          </label>
        </div>
      </div>
      <div class="signal-feed">
        ${filteredItems().length ? filteredItems().map(renderSignalCard).join("") : `<div class="panel"><p class="muted">No closely related items matched this filter set yet.</p></div>`}
      </div>
    </section>
  `;
}

function renderSources() {
  return `
    <section>
      <div class="section-title">
        <div>
          <h1>Source Library</h1>
          <p class="muted">Manage source packs and connector health.</p>
        </div>
        <button class="btn primary" data-action="recommend">Recommend sources</button>
      </div>
      <div class="grid three">
        ${state.payload.sources.map(renderSourceCard).join("")}
        <button class="source-card card add" data-action="show-source-form">
          <strong>＋</strong>
          <span>Configure source pack</span>
        </button>
      </div>
      <div class="grid two" style="margin-top:16px;">
        <div class="panel">
          <h2>Configure Source Pack</h2>
          <div class="grid two">
            <label>Type
              <select id="source-type">
                ${["rss", "youtube", "reddit", "x"].map((type) => `<option ${state.sourceForm.type === type ? "selected" : ""}>${type}</option>`).join("")}
              </select>
            </label>
            <label>Name
              <input id="source-name" placeholder="e.g., Global News RSS" value="${esc(state.sourceForm.name)}" />
            </label>
          </div>
          <label style="margin-top:12px;">URL / query
            <input id="source-url" placeholder="https://example.com/feed.xml or youtube:query" value="${esc(state.sourceForm.url)}" />
          </label>
          <div class="setup-actions">
            <button class="btn" data-action="recommend">AI recommendations</button>
            <button class="btn primary" data-action="add-source">Save source</button>
          </div>
        </div>
        <div class="panel">
          <div class="row between">
            <h2>Test Preview</h2>
            <span class="badge positive">CONNECTED</span>
          </div>
          <pre class="code-preview">${esc(JSON.stringify({
            normalizedShape: {
              source: "rss | youtube | reddit | x",
              recentLimit: 20,
              topLimit: 20,
              analysis: ["sentiment", "themes", "riskFlags", "summary"],
              failureMode: "source-level errors do not fail monitor"
            },
            recommendations: state.recommendations.slice(0, 3)
          }, null, 2))}</pre>
        </div>
      </div>
      ${state.recommendations.length ? renderRecommendations() : ""}
    </section>
  `;
}

function renderSourceCard(source) {
  return `
    <article class="source-card card">
      <div>
        <div class="row between">
          <h3>${esc(source.name)}</h3>
          <span class="badge ${source.status === "active" ? "positive" : source.status === "error" ? "negative" : "neutral"}">${source.status}</span>
        </div>
        <p class="muted tiny">${esc(source.url)}</p>
        ${source.error ? `<p class="tiny" style="color:var(--danger); margin-top:8px;">${esc(source.error)}</p>` : ""}
      </div>
      <div>
        <div class="row between tiny muted">
          <span>${source.type.toUpperCase()}</span>
          <span>${source.itemCount} items</span>
        </div>
        <div class="row between tiny muted" style="margin-top:8px;">
          <span>${esc(source.health)}</span>
          <span>${formatTime(source.lastFetchedAt)}</span>
        </div>
      </div>
    </article>
  `;
}

function renderRecommendations() {
  return `
    <div class="panel" style="margin-top:16px;">
      <div class="section-title">
        <h2>AI Source Recommendations</h2>
        <span class="badge">${state.recommendations.length} suggested</span>
      </div>
      <div class="grid three">
        ${state.recommendations.map((rec, index) => `
          <article class="card">
            <div class="row between"><strong>${esc(rec.name)}</strong><span class="badge">${rec.type}</span></div>
            <p class="muted tiny" style="margin:8px 0;">${esc(rec.reason)}</p>
            <button class="btn" data-add-rec="${index}">Add selected</button>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function renderReports() {
  const reports = state.payload.reports || [];
  const selectedReport = reports.find((report) => report.id === state.selectedReportId) || reports[0] || null;
  return `
    <section>
      <div class="section-title">
        <div>
          <h1>Reports</h1>
          <p class="muted">Create shareable sentiment briefings from the latest run.</p>
        </div>
        <button class="btn primary" data-action="report">Generate report</button>
      </div>
      <div class="grid two">
        <div class="panel">
          <h2>Saved reports</h2>
          ${reports.length ? reports.map((report) => `
            <article class="card" data-report="${report.id}" style="margin-top:10px; cursor:pointer;">
              <div class="row between"><strong>${esc(report.title)}</strong><span class="badge">${formatTime(report.createdAt)}</span></div>
              <button class="btn" data-copy-report="${report.id}" style="margin-top:10px;">Copy markdown</button>
            </article>
          `).join("") : `<p class="muted">No reports generated yet.</p>`}
        </div>
        <div class="panel">
          <h2>${selectedReport ? esc(selectedReport.title) : "Report preview"}</h2>
          <p class="muted tiny">${selectedReport ? `Generated ${formatTime(selectedReport.createdAt)}. Click another report to inspect its saved markdown.` : "Select or generate a report to preview it here."}</p>
          <pre class="code-preview">${esc(selectedReport ? selectedReport.markdown : renderReportPreview())}</pre>
        </div>
      </div>
    </section>
  `;
}

function renderReportPreview() {
  const summary = state.payload.latestRun?.summary;
  if (!summary) return `# ${state.payload.monitor.subject} Sentiment Report\n\nWaiting for scan data...`;
  return `# ${state.payload.monitor.subject} Sentiment Report

Overall sentiment: ${summary.overallSentiment}
Confidence: ${summary.confidence}%

${summary.executiveSummary}

Themes:
${summary.themes.map((theme) => `- ${themeName(theme)}: ${theme.sentiment || "neutral"}`).join("\n")}

Recommended actions:
${summary.recommendedActions.map((action) => `- ${action}`).join("\n")}`;
}

function renderAlerts() {
  return `
    <section>
      <div class="section-title">
        <div>
          <h1>Alerts</h1>
          <p class="muted">Lightweight rules for demo and scalable monitoring.</p>
        </div>
        <button class="btn primary">Create alert rule</button>
      </div>
      <div class="grid two">
        ${state.payload.alerts.map((alert) => `
          <article class="card">
            <div class="row between">
              <h3>${esc(alert.name)}</h3>
              <span class="badge positive">${alert.status}</span>
            </div>
            <p class="muted">${esc(alert.trigger)}</p>
            <div class="tiny muted" style="margin-top:12px;">Last triggered: ${formatTime(alert.lastTriggeredAt)}</div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderSettings() {
  const workspace = state.payload.workspace;
  const monitor = state.payload.monitor;
  return `
    <section>
      <h1>Settings</h1>
      <div class="grid two" style="margin-top:16px;">
        <div class="panel">
          <h2>Workspace</h2>
          <label>Name <input id="workspace-name" value="${esc(workspace.name)}" /></label>
          <label style="margin-top:12px;">Team members <input value="analyst@demo.local, founder@demo.local" /></label>
        </div>
        <div class="panel">
          <h2>Analysis defaults</h2>
          <label>Recent item count <input id="recent-count" type="number" value="${monitor.scanSettings.recentCount}" /></label>
          <label style="margin-top:12px;">Top item count <input id="top-count" type="number" value="${monitor.scanSettings.topCount}" /></label>
        </div>
        <div class="panel">
          <h2>Connectors</h2>
          <div class="metric"><span>OpenAI</span><span class="badge ${workspace.openaiKeyConfigured ? "positive" : "neutral"}">${workspace.openaiKeyConfigured ? "configured in Vercel" : "add env secret"}</span></div>
          <div class="metric"><span>YouTube</span><span class="badge ${workspace.youtubeKeyConfigured ? "positive" : "neutral"}">${workspace.youtubeKeyConfigured ? "configured in Vercel" : "add env secret"}</span></div>
          <div class="metric"><span>RSS</span><span class="badge positive">enabled</span></div>
          <div class="metric"><span>Reddit</span><span class="badge">planned</span></div>
          <div class="metric"><span>X</span><span class="badge">planned</span></div>
        </div>
        <div class="panel">
          <h2>Deployment</h2>
          <p class="muted">The app reads OpenAI and YouTube secrets from Vercel environment variables. No per-user key entry is needed.</p>
          <div class="setup-actions" style="margin-top:16px;">
            <button class="btn primary" data-action="save-settings">Save settings</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function sourceIcon(type) {
  return { rss: "◉", youtube: "▶", reddit: "◎", x: "𝕏" }[type] || "•";
}

function bindShell() {
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => setRoute(button.dataset.route));
  });
  document.querySelectorAll("[data-filter]").forEach((select) => {
    select.addEventListener("change", () => {
      state.filter[select.dataset.filter] = select.value;
      render();
    });
  });
  document.querySelectorAll("[data-action='scan']").forEach((button) => button.addEventListener("click", runScan));
  document.querySelectorAll("[data-action='recommend']").forEach((button) => button.addEventListener("click", loadRecommendations));
  document.querySelectorAll("[data-action='add-source']").forEach((button) => button.addEventListener("click", addSource));
  document.querySelectorAll("[data-add-rec]").forEach((button) => button.addEventListener("click", () => addRecommendation(Number(button.dataset.addRec))));
  document.querySelectorAll("[data-action='report']").forEach((button) => button.addEventListener("click", generateReport));
  document.querySelectorAll("[data-action='reset-demo']").forEach((button) => button.addEventListener("click", resetDemo));
  document.querySelectorAll("[data-action='save-settings']").forEach((button) => button.addEventListener("click", saveSettings));
  document.querySelectorAll("[data-copy-report]").forEach((button) => {
    button.addEventListener("click", () => {
      const report = state.payload.reports.find((entry) => entry.id === button.dataset.copyReport);
      navigator.clipboard?.writeText(report.markdown);
      toast("Report markdown copied.");
    });
  });
  document.querySelectorAll("[data-report]").forEach((card) => {
    card.addEventListener("click", () => {
      state.selectedReportId = card.dataset.report;
      render();
    });
  });
}

async function runScan() {
  toast("Scan started. Fetching sources and analyzing sentiment...");
  const data = await api("/api/scans", { method: "POST", body: { monitorId: state.payload.monitor.id } });
  state.payload = data.payload;
  state.route = "dashboard";
  toast("Scan complete. Dashboard updated.");
  render();
}

async function loadRecommendations() {
  const monitor = state.payload.monitor;
  const data = await api("/api/recommendations", {
    method: "POST",
    body: {
      subject: monitor.subject,
      subjectType: monitor.subjectType,
      description: monitor.description,
      keywords: monitor.keywords,
      aliases: monitor.aliases,
      intent: monitor.intent,
      region: monitor.region,
      existingSources: state.payload.sources
    }
  });
  state.recommendations = data.recommendations;
  state.route = "sources";
  toast("AI source recommendations ready.");
  render();
}

async function addSource() {
  try {
    const body = {
      monitorId: state.payload.monitor.id,
      type: document.querySelector("#source-type").value,
      name: document.querySelector("#source-name").value,
      url: document.querySelector("#source-url").value
    };
    const result = await api("/api/sources", { method: "POST", body });
    state.payload = await api(`/api/bootstrap?monitorId=${state.payload.monitor.id}`);
    state.sourceForm = { type: "rss", name: "", url: "" };
    toast(result.source.status === "error" ? `Source saved with warning: ${result.source.error}` : "Source saved and validated.");
    render();
  } catch (error) {
    toast(`Source was not saved: ${error.message}`);
  }
}

async function addRecommendation(index) {
  const rec = state.recommendations[index];
  await api("/api/sources", {
    method: "POST",
    body: { monitorId: state.payload.monitor.id, type: rec.type, name: rec.name, url: rec.url }
  });
  state.payload = await api(`/api/bootstrap?monitorId=${state.payload.monitor.id}`);
  toast("Recommended source added.");
  render();
}

async function generateReport() {
  const result = await api("/api/reports", { method: "POST", body: { monitorId: state.payload.monitor.id } });
  state.payload = await api(`/api/bootstrap?monitorId=${state.payload.monitor.id}`);
  state.selectedReportId = result.report.id;
  state.route = "reports";
  toast("Report generated.");
  render();
}

async function resetDemo() {
  state.payload = await api("/api/demo/reset", { method: "POST" });
  state.route = "dashboard";
  state.recommendations = [];
  toast("Demo workspace reset.");
  render();
}

async function saveSettings() {
  const body = {
    workspaceName: document.querySelector("#workspace-name")?.value || "",
    recentCount: Number(document.querySelector("#recent-count")?.value || 20),
    topCount: Number(document.querySelector("#top-count")?.value || 20)
  };
  const result = await api("/api/settings", { method: "POST", body });
  state.payload.workspace.name = result.workspace.name;
  state.payload.monitor.scanSettings.recentCount = result.monitor.scanSettings.recentCount;
  state.payload.monitor.scanSettings.topCount = result.monitor.scanSettings.topCount;
  toast("Settings saved.");
  render();
}

render();
