const TOKEN_STORAGE_KEY = "cxr.adminToken";

const state = {
  rooms: [],
  builds: null,
  connectionHints: null,
  focusedRoomId: "",
  expandedRoomIds: [],
  collapsedBuildIds: [],
  authEnabled: false,
  authError: "",
  activeTab: "services",
  requestActivity: { requests: [], roomActivity: [] },
  services: [],
  logPaused: false,
  logLines: []
};

const quickChips = ["Anatomy Lab", "Training Room", "Debug Room", "Client Join Test"];

const roomLogsById = new Map();
const pendingRoomActions = new Set();
let registryState = null;
let wsLogSocket = null;

hydrateTokenFromUrl();

const roomNameInput = document.getElementById("roomName");
const buildSelect = document.getElementById("buildSelect");
const maxParticipantsInput = document.getElementById("maxParticipants");
const roomList = document.getElementById("roomList");
const hostLog = document.getElementById("hostLog");
const hostActivity = document.getElementById("hostActivity");
const registryLog = document.getElementById("registryLog");
const registryActivity = document.getElementById("registryActivity");
const hostStatus = document.getElementById("hostStatus");
const authStatus = document.getElementById("authStatus");
const dashboardNotice = document.getElementById("dashboardNotice");
const roomCount = document.getElementById("roomCount");
const roomMonitorGrid = document.getElementById("roomMonitorGrid");
const quickChipsContainer = document.getElementById("quickChips");
const registryUrl = document.getElementById("registryUrl");
const hostManagerUrl = document.getElementById("hostManagerUrl");
const availableAddresses = document.getElementById("availableAddresses");
const networkWarning = document.getElementById("networkWarning");
const networkWarningRow = document.getElementById("networkWarningRow");
const serviceList = document.getElementById("serviceList");
const serviceCount = document.getElementById("serviceCount");
const serviceTemplateSelect = document.getElementById("serviceTemplateSelect");
const logTerminal = document.getElementById("logTerminal");
const logServiceFilter = document.getElementById("logServiceFilter");
const logStreamFilter = document.getElementById("logStreamFilter");
const logSearch = document.getElementById("logSearch");
const logConnectionStatus = document.getElementById("logConnectionStatus");
const healthServiceGrid = document.getElementById("healthServiceGrid");
const healthRegistry = document.getElementById("healthRegistry");
const healthServiceCount = document.getElementById("healthServiceCount");

quickChipsContainer.innerHTML = quickChips
  .map(name => `<button class="chip" data-room-name="${name}">${name}</button>`)
  .join("");

quickChipsContainer.addEventListener("click", event => {
  const button = event.target.closest("[data-room-name]");
  if (!button) return;
  roomNameInput.value = button.dataset.roomName;
});

setupTabNavigation();
setupLogWebSocket();

document.addEventListener("click", event => {
  const roomActionButton = event.target.closest("[data-room-action]");
  if (roomActionButton) {
    const roomId = roomActionButton.dataset.roomId;
    const roomAction = roomActionButton.dataset.roomAction;
    if (pendingRoomActions.has(roomId)) return;
    pendingRoomActions.add(roomId);
    if (roomAction === "stop") {
      stopRoom(roomId).finally(() => pendingRoomActions.delete(roomId));
    } else if (roomAction === "restart") {
      restartRoom(roomId).finally(() => pendingRoomActions.delete(roomId));
    }
    return;
  }

  const roomToggleButton = event.target.closest("[data-room-toggle]");
  if (roomToggleButton) {
    toggleRoomExpanded(roomToggleButton.dataset.roomToggle);
    return;
  }

  const toggleBuild = event.target.closest("[data-build-toggle]");
  if (toggleBuild) {
    toggleBuildCollapse(toggleBuild.dataset.buildToggle);
    return;
  }

  const svcAction = event.target.closest("[data-svc-action]");
  if (svcAction) {
    const svcId = svcAction.dataset.svcId;
    const action = svcAction.dataset.svcAction;
    handleServiceAction(svcId, action);
    return;
  }

  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;

  if (action === "refresh") {
    refreshAll();
  } else if (action === "create-default") {
    createRoom("Client Join Test", 8, getSelectedBuildId());
  } else if (action === "create-room") {
    createRoom(roomNameInput.value, Number(maxParticipantsInput.value || 8), getSelectedBuildId());
  } else if (action === "set-token") {
    promptForToken();
  } else if (action === "clear-token") {
    clearStoredToken();
  } else if (action === "start-service") {
    startServiceFromTemplate();
  } else if (action === "toggle-log-pause") {
    toggleLogPause();
  } else if (action === "clear-logs") {
    clearLogs();
  }
});

function setupTabNavigation() {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const tabName = tab.dataset.tab;
      setActiveTab(tabName);
    });
  });
}

function setActiveTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll(".tab").forEach(t => {
    t.classList.toggle("active", t.dataset.tab === tabName);
  });
  document.querySelectorAll(".tab-content").forEach(c => {
    c.classList.toggle("active", c.id === `tab${capitalize(tabName)}`);
  });
  if (tabName === "services") {
    refreshServices();
  } else if (tabName === "health") {
    refreshHealth();
  } else if (tabName === "logs") {
    connectLogWebSocket();
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function refreshAll() {
  try {
    await Promise.all([
      refreshRooms(),
      refreshHostLog(),
      refreshRegistryState(),
      refreshRequestActivity()
    ]);
    await refreshAllRoomLogs();
    renderRoomMonitors();
    updateAuthUi();
    refreshServices();
  } catch (error) {
    showDashboardError(error.message);
  }
}

async function refreshRooms() {
  const payload = await requestJson("/api/state");
  state.rooms = payload.rooms || [];
  state.builds = payload.builds || null;
  state.connectionHints = payload.connectionHints || null;
  state.authEnabled = Boolean(payload.auth?.enabled);
  state.authError = "";
  reconcileExpandedRooms();
  populateBuildSelect();
  reconcileCollapsedBuilds();
  renderRooms();
  renderConnectionHints();
  renderConnectionPanel();
}

async function refreshHostLog() {
  const payload = await requestJson("/api/logs/host-manager");
  hostLog.textContent = payload.text || "";
  hostStatus.textContent = `Host online | ${state.rooms.length} rooms`;
  roomCount.textContent = `${state.rooms.length} ${state.rooms.length === 1 ? "room" : "rooms"}`;
}

async function refreshRegistryState() {
  registryState = await requestJson("/api/registry-state");
  renderRegistryState();
}

async function refreshRequestActivity() {
  state.requestActivity = await requestJson("/api/request-activity");
  renderRequestActivity();
}

async function refreshAllRoomLogs() {
  const activeRoomIds = new Set(state.rooms.map(room => room.roomId));
  const requests = state.rooms.map(async room => {
    const payload = await requestJson(`/api/logs/rooms/${encodeURIComponent(room.roomId)}`);
    roomLogsById.set(room.roomId, {
      stdout: payload.stdout || "",
      stderr: payload.stderr || ""
    });
  });
  await Promise.all(requests);
  for (const roomId of Array.from(roomLogsById.keys())) {
    if (!activeRoomIds.has(roomId)) {
      roomLogsById.delete(roomId);
    }
  }
}

function getSelectedBuildId() {
  return buildSelect ? buildSelect.value : "";
}

function populateBuildSelect() {
  if (!buildSelect || !state.builds) return;
  const currentValue = buildSelect.value;
  const buildIds = Object.keys(state.builds);
  buildSelect.innerHTML = buildIds.map(id =>
    `<option value="${escapeHtml(id)}">${escapeHtml(state.builds[id].name || id)}</option>`
  ).join("");
  if (currentValue && buildIds.includes(currentValue)) {
    buildSelect.value = currentValue;
  }
}

function getBuildIds() {
  const rooms = state.rooms || [];
  const ids = [...new Set(rooms.map(r => r.buildId).filter(Boolean))];
  if (state.builds) {
    for (const id of Object.keys(state.builds)) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

function getRoomsByBuild(buildId) {
  return (state.rooms || []).filter(r => r.buildId === buildId);
}

function toggleBuildCollapse(buildId) {
  const idx = state.collapsedBuildIds.indexOf(buildId);
  if (idx >= 0) {
    state.collapsedBuildIds.splice(idx, 1);
  } else {
    state.collapsedBuildIds.push(buildId);
  }
  renderRooms();
  renderRoomMonitors();
}

function reconcileCollapsedBuilds() {
  const ids = getBuildIds();
  state.collapsedBuildIds = state.collapsedBuildIds.filter(id => ids.includes(id));
}

function isBuildCollapsed(buildId) {
  return state.collapsedBuildIds.includes(buildId);
}

async function createRoom(name, maxParticipants, buildId) {
  try {
    await requestJson("/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestedName: String(name || "CXR Room").trim(),
        maxParticipants,
        buildId: buildId || undefined
      })
    });
    await refreshAll();
  } catch (error) {
    alert(error.message || "Failed to create room.");
  }
}

async function stopRoom(roomId) {
  if (!roomId) return;
  try {
    await requestJson(`/rooms/${encodeURIComponent(roomId)}/stop`, { method: "POST" });
    await refreshAll();
  } catch (error) {
    alert(error.message || `Failed to stop room ${roomId}.`);
  }
}

async function restartRoom(roomId) {
  if (!roomId) return;
  try {
    await requestJson(`/rooms/${encodeURIComponent(roomId)}/restart`, { method: "POST" });
    await refreshAll();
  } catch (error) {
    alert(error.message || `Failed to restart room ${roomId}.`);
  }
}

async function requestJson(url, options) {
  const response = await authorizedFetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) {
    state.authError = "Admin token required or invalid.";
    updateAuthUi();
    throw new Error(state.authError);
  }
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}.`);
  }
  return payload;
}

function authorizedFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getStoredToken();
  if (token) {
    headers.set("x-cxr-admin-token", token);
  }
  return fetch(url, { ...options, headers });
}

function getStoredToken() {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY) || "";
}

function hydrateTokenFromUrl() {
  const currentUrl = new URL(window.location.href);
  const tokenFromUrl = currentUrl.searchParams.get("token");
  if (!tokenFromUrl) return;
  window.localStorage.setItem(TOKEN_STORAGE_KEY, tokenFromUrl.trim());
  currentUrl.searchParams.delete("token");
  window.history.replaceState({}, document.title, currentUrl.pathname + currentUrl.search + currentUrl.hash);
}

function promptForToken() {
  const nextValue = window.prompt("Enter the CXR admin token for this dashboard.", getStoredToken());
  if (nextValue === null) return;
  if (nextValue.trim()) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, nextValue.trim());
  } else {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
  state.authError = "";
  updateAuthUi();
  refreshAll();
}

function clearStoredToken() {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  state.authError = "";
  updateAuthUi();
  refreshAll();
}

function updateAuthUi() {
  const tokenLoaded = Boolean(getStoredToken());
  if (state.authError) {
    authStatus.textContent = state.authError;
    dashboardNotice.textContent = "This dashboard is protected. Click Admin Token and paste the current CXR_ADMIN_TOKEN.";
    return;
  }
  if (state.authEnabled && tokenLoaded) {
    authStatus.textContent = "Admin token loaded";
    dashboardNotice.textContent = "Protected mode is on. API calls are using the stored admin token.";
    return;
  }
  if (state.authEnabled) {
    authStatus.textContent = "Admin token required";
    dashboardNotice.textContent = "Protected mode is on. Click Admin Token and paste the current CXR_ADMIN_TOKEN.";
    return;
  }
  if (tokenLoaded) {
    authStatus.textContent = "Auth open | token saved";
    dashboardNotice.textContent = "The dashboard is open right now, but the saved token will still be used automatically if auth is enabled later.";
    return;
  }
  authStatus.textContent = "Auth open";
  dashboardNotice.textContent = "Manage services, monitor rooms, view logs, and check system health.";
}

function showDashboardError(message) {
  hostStatus.textContent = "Dashboard attention needed";
  hostLog.textContent = message;
  registryLog.textContent = message;
  if (!state.rooms.length) {
    roomList.innerHTML = `
      <div class="room-item">
        <div class="room-meta">
          <div class="room-title">Dashboard unavailable</div>
          <div class="room-sub">${escapeHtml(message)}</div>
        </div>
      </div>
    `;
    roomMonitorGrid.innerHTML = `
      <div class="card">
        <h3>Dashboard unavailable</h3>
        <p class="card-sub">${escapeHtml(message)}</p>
      </div>
    `;
  }
  updateAuthUi();
}

function renderRooms() {
  const buildIds = getBuildIds();
  if (buildIds.length === 0) {
    roomList.innerHTML = `<div class="room-item"><div class="room-meta"><div class="room-title">No rooms yet</div><div class="room-sub">Create one from the shortcuts above.</div></div></div>`;
    return;
  }
  roomList.innerHTML = buildIds.map(buildId => {
    const build = state.builds?.[buildId];
    const buildName = build ? (build.name || buildId) : buildId;
    const buildRooms = getRoomsByBuild(buildId);
    const collapsed = isBuildCollapsed(buildId);
    const icon = collapsed ? "\u25B6" : "\u25BC";
    const contentHidden = collapsed ? " hidden" : "";
    const roomItems = buildRooms.length
      ? buildRooms.map(renderRoomItem).join("")
      : `<div class="room-item"><div class="room-meta"><div class="room-sub">No rooms for this build.</div></div></div>`;
    return `
      <div class="build-section">
        <div class="build-header" data-build-toggle="${escapeHtml(buildId)}">
          <span class="collapse-icon">${icon}</span>
          <strong class="build-name">${escapeHtml(buildName)}</strong>
          <span class="pill">${buildRooms.length} ${buildRooms.length === 1 ? "room" : "rooms"}</span>
        </div>
        <div class="build-content${contentHidden}">
          ${roomItems}
        </div>
      </div>
    `;
  }).join("");
  roomList.querySelectorAll("[data-room-jump]").forEach(item => {
    item.addEventListener("click", () => {
      focusRoomDashboard(item.dataset.roomJump);
    });
  });
}

function renderConnectionHints() {
  const hints = state.connectionHints;
  if (!hints) return;
  registryUrl.textContent = hints.xrMultiplayerDebugGui?.remoteRegistryUrl || "";
  hostManagerUrl.textContent = hints.hostManagerUrl || "";
  availableAddresses.textContent = (hints.availableAddresses || []).join(", ");
  networkWarning.textContent = hints.warning || "None";
  networkWarningRow.style.display = hints.warning ? "grid" : "none";
}

function renderConnectionPanel() {
  const hints = state.connectionHints;
  if (!hints) return;
  document.getElementById("panelRegistryUrl").textContent = hints.xrMultiplayerDebugGui?.remoteRegistryUrl || "—";
  document.getElementById("panelHostManagerUrl").textContent = hints.hostManagerUrl || "—";

  const runningRooms = (state.rooms || []).filter(r => r.status === "running");
  const roomCount = document.getElementById("panelRoomCount");
  const roomList = document.getElementById("panelRoomList");

  roomCount.textContent = `${runningRooms.length} ${runningRooms.length === 1 ? "room" : "rooms"}`;

  if (runningRooms.length === 0) {
    roomList.innerHTML = `<div class="hint-row"><span>No rooms running</span><code>—</code></div>`;
    return;
  }

  roomList.innerHTML = runningRooms.map(room => `
    <div class="hint-row">
      <span>${escapeHtml(room.requestedName)}</span>
      <code class="select-all">${escapeHtml(room.ip)}:${room.port}</code>
    </div>
  `).join("");
}

function renderRegistryState() {
  if (!registryState) {
    registryLog.textContent = "Loading registry state...";
    registryActivity.textContent = "Loading registry activity...";
    return;
  }
  const lines = [
    "REGISTRY MONITOR",
    `URL: ${registryState.url || "not configured"}`,
    `Reachable: ${registryState.ok ? "yes" : "no"}`,
    ""
  ];
  if (registryState.error) {
    lines.push("ERROR", registryState.error, "");
  }
  if (registryState.health) {
    lines.push("HEALTH", JSON.stringify(registryState.health, null, 2), "");
  }
  lines.push(
    `PUBLISHED ROOMS (${Array.isArray(registryState.rooms) ? registryState.rooms.length : 0})`,
    JSON.stringify(registryState.rooms || [], null, 2)
  );
  registryLog.textContent = lines.join("\n");
  const requestCounts = registryState.requestCounts || {};
  const events = Array.isArray(registryState.events) ? registryState.events : [];
  const activityLines = [
    "REGISTRY HTTP ACTIVITY",
    `staleAfterMs=${registryState.health?.staleAfterMs ?? "-"}`,
    "",
    "REQUEST COUNTS",
    JSON.stringify(requestCounts, null, 2),
    "",
    "RECENT EVENTS",
    ...events.slice(-20).map(formatRegistryEvent)
  ];
  registryActivity.textContent = activityLines.join("\n");
}

function renderRequestActivity() {
  const requestLines = [
    "HOST MANAGER HTTP ACTIVITY",
    ...(state.requestActivity.requests || []).slice(-20).map(event =>
      `${event.timestamp} | ${event.method} ${event.path} -> ${event.statusCode} | ${event.durationMs}ms | ${event.remoteAddress}`
    ),
    "",
    "ROOM LIFECYCLE",
    ...(state.requestActivity.roomActivity || []).slice(-20).map(event =>
      `${event.timestamp} | ${event.type} | ${formatRoomActivity(event)}`
    )
  ];
  hostActivity.textContent = requestLines.join("\n");
}

function renderRoomItem(room) {
  const focusedClass = room.roomId === state.focusedRoomId ? " selected" : "";
  const build = state.builds?.[room.buildId];
  const buildName = build ? (build.name || room.buildId) : (room.buildId || "");
  return `
    <div class="room-item${focusedClass}" data-room-jump="${escapeHtml(room.roomId)}">
      <div class="room-meta">
        <div class="room-title">${escapeHtml(room.requestedName)}</div>
        <div class="room-sub">${escapeHtml(room.roomId)} | ${escapeHtml(room.ip)}:${room.port}</div>
        <div class="room-sub">Status: ${escapeHtml(room.status)} | PID: ${room.pid ?? "-"} ${buildName ? "| " + escapeHtml(buildName) : ""}</div>
      </div>
      <div class="pill ${room.status}">${escapeHtml(room.status)}</div>
    </div>
  `;
}

function renderRoomMonitors() {
  const buildIds = getBuildIds();
  if (buildIds.length === 0) {
    roomMonitorGrid.innerHTML = `<div class="card"><h3>No Room Dashboards Yet</h3><p class="card-sub">Add a room above and its dashboard will appear here automatically.</p></div>`;
    return;
  }
  roomMonitorGrid.innerHTML = buildIds.map(buildId => {
    const build = state.builds?.[buildId];
    const buildName = build ? (build.name || buildId) : buildId;
    const buildRooms = getRoomsByBuild(buildId);
    const collapsed = isBuildCollapsed(buildId);
    const icon = collapsed ? "\u25B6" : "\u25BC";
    const contentHidden = collapsed ? " hidden" : "";
    if (buildRooms.length === 0 && collapsed) return "";
    const cards = buildRooms.length
      ? buildRooms.map(renderRoomMonitorCard).join("")
      : `<div class="card"><h3>${escapeHtml(buildName)}</h3><p class="card-sub">No rooms for this build yet.</p></div>`;
    return `
      <div class="build-section monitor-build-section">
        <div class="build-header" data-build-toggle="${escapeHtml(buildId)}">
          <span class="collapse-icon">${icon}</span>
          <strong class="build-name">${escapeHtml(buildName)}</strong>
          <span class="pill">${buildRooms.length} ${buildRooms.length === 1 ? "room" : "rooms"}</span>
        </div>
        <div class="build-content${contentHidden}">
          ${cards}
        </div>
      </div>
    `;
  }).join("");
}

function renderRoomMonitorCard(room) {
  const logs = roomLogsById.get(room.roomId) || { stdout: "", stderr: "" };
  const focusedClass = room.roomId === state.focusedRoomId ? " focused" : "";
  const expandedClass = isRoomExpanded(room.roomId) ? " expanded" : "";
  const health = getRoomHealth(room);
  const healthDot = health.isHealthy ? "\u{1F7E2}" : health.status === "running" ? "\u{1F7E1}" : "\u{1F534}";
  const postActivity = getRoomPostActivity(room.roomId);
  const getActivity = getRoomGetActivity(room.roomId);
  const clientEvents = deriveClientEvents(room.roomId);
  const connLogs = parseConnectionLogs(room.roomId);
  const restActivityLines = [
    ...(postActivity.length ? ["-- POST (Room \u2192 Registry) --", ...postActivity] : []),
    ...(getActivity.length ? ["-- GET (Client \u2192 Server) --", ...getActivity] : [])
  ].join("\n") || "(no activity yet)";
  const clientLines = [
    ...(clientEvents.length ? ["-- Derived Events --", ...clientEvents] : []),
    ...(connLogs.length ? ["-- Connection Logs --", ...connLogs] : [])
  ].join("\n") || "(no client activity yet)";
  const roomOutputLines = [
    "STDOUT",
    logs.stdout || "(no stdout yet)",
    "",
    "STDERR",
    logs.stderr || "(no stderr yet)"
  ].join("\n");
  return `
    <article class="card room-monitor-card${focusedClass}${expandedClass}" id="room-dashboard-${escapeHtml(room.roomId)}" data-room-dashboard="${escapeHtml(room.roomId)}">
      <div class="room-dashboard-shell">
        <div class="room-dashboard-summary">
          <div class="room-dashboard-summary-main">
            <h3>${escapeHtml(room.requestedName)}</h3>
            <p class="card-sub">${escapeHtml(room.roomId)} | ${escapeHtml(room.status)} | ${escapeHtml(room.ip)}:${room.port} <span class="build-badge">${escapeHtml(room.buildId || "")}</span></p>
          </div>
          <div class="room-dashboard-summary-side">
            <div class="pill ${room.status}">${escapeHtml(room.status)}</div>
            <button class="room-toggle" data-room-toggle="${escapeHtml(room.roomId)}">${isRoomExpanded(room.roomId) ? "Hide Dashboard" : "Open Dashboard"}</button>
          </div>
        </div>
        <div class="room-dashboard-content">
          <div class="health-bar">
            <span class="health-dot">${healthDot}</span>
            <span class="health-status">${escapeHtml(health.status)}</span>
            <span class="health-divider">|</span>
            <span class="health-item">PID: ${escapeHtml(health.pid ?? "-")}</span>
            <span class="health-divider">|</span>
            <span class="health-item">Players: ${health.playerCount !== null ? health.playerCount + "/" + health.maxPlayers : "-"}</span>
            ${health.heartbeatAge !== null ? `<span class="health-divider">|</span><span class="health-item">Heartbeat: ${health.heartbeatAge}s ago</span>` : ""}
            ${health.uptime ? `<span class="health-divider">|</span><span class="health-item">Uptime: ${escapeHtml(health.uptime)}</span>` : ""}
            <span class="health-spacer"></span>
            <button class="room-stop-button" data-room-action="restart" data-room-id="${escapeHtml(room.roomId)}">Restart</button>
            <button class="room-stop-button" data-room-action="stop" data-room-id="${escapeHtml(room.roomId)}">Stop</button>
          </div>
          <pre class="terminal rest-activity">${escapeHtml(restActivityLines)}</pre>
          <pre class="terminal clients-log">${escapeHtml(clientLines)}</pre>
          <pre class="terminal room-output-terminal">${escapeHtml(roomOutputLines)}</pre>
        </div>
      </div>
    </article>
  `;
}

function findRegistryRoom(room) {
  const registryRooms = Array.isArray(registryState?.rooms) ? registryState.rooms : [];
  return registryRooms.find(item =>
    item?.roomId === room.roomId ||
    (item?.ipAddress === room.ip && Number(item?.port) === Number(room.port))
  ) || null;
}

function focusRoomDashboard(roomId) {
  state.focusedRoomId = roomId;
  ensureRoomExpanded(roomId);
  const dashboard = document.querySelector(`[data-room-dashboard="${cssEscape(roomId)}"]`);
  if (dashboard) {
    dashboard.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function isRoomExpanded(roomId) {
  return state.expandedRoomIds.includes(roomId);
}

function ensureRoomExpanded(roomId) {
  if (!isRoomExpanded(roomId)) {
    state.expandedRoomIds = [...state.expandedRoomIds, roomId];
  }
}

function toggleRoomExpanded(roomId) {
  if (isRoomExpanded(roomId)) {
    state.expandedRoomIds = state.expandedRoomIds.filter(item => item !== roomId);
  } else {
    state.expandedRoomIds = [...state.expandedRoomIds, roomId];
    state.focusedRoomId = roomId;
  }
  renderRoomMonitors();
}

function reconcileExpandedRooms() {
  const roomIds = new Set(state.rooms.map(room => room.roomId));
  const previousExpanded = state.expandedRoomIds.filter(roomId => roomIds.has(roomId));
  const newRoomIds = state.rooms
    .map(room => room.roomId)
    .filter(roomId => !previousExpanded.includes(roomId));
  state.expandedRoomIds = [...previousExpanded, ...newRoomIds];
  if (state.focusedRoomId && !roomIds.has(state.focusedRoomId)) {
    state.focusedRoomId = "";
  }
}

function cssEscape(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return String(value).replaceAll('"', '\\"');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatRegistryEvent(event) {
  if (!event) return "(missing event)";
  if (event.type === "http-request") {
    return `${event.timestamp} | ${event.method} ${event.path} -> ${event.statusCode} | rooms=${event.roomCount}`;
  }
  if (event.type === "room-upsert") {
    return `${event.timestamp} | heartbeat | ${event.roomId} | ${event.ipAddress}:${event.port} | players=${event.playerCount}/${event.maxPlayers} | ${event.status}`;
  }
  if (event.type === "room-delete" || event.type === "stale-room-removed") {
    return `${event.timestamp} | ${event.type} | ${event.roomId} | ${event.ipAddress}:${event.port}`;
  }
  return JSON.stringify(event);
}

function formatRoomActivity(event) {
  const parts = [];
  if (event.roomId) parts.push(event.roomId);
  if (event.requestedName) parts.push(event.requestedName);
  if (event.port) parts.push(`port=${event.port}`);
  if (event.pid) parts.push(`pid=${event.pid}`);
  if (event.code !== undefined && event.code !== null) parts.push(`code=${event.code}`);
  if (event.signal) parts.push(`signal=${event.signal}`);
  if (event.message) parts.push(event.message);
  if (event.restartCount !== undefined) parts.push(`restarts=${event.restartCount}`);
  return parts.join(" | ");
}

function getRoomPostActivity(roomId) {
  if (!Array.isArray(registryState?.events)) return [];
  return registryState.events
    .filter(e => e.type === "room-upsert" && e.roomId === roomId)
    .slice(-10)
    .map(e => `${e.timestamp || ""} | heartbeat | players=${e.playerCount}/${e.maxPlayers} | ${e.status}`);
}

function getRoomGetActivity(roomId) {
  if (!Array.isArray(state.requestActivity?.requests)) return [];
  return state.requestActivity.requests
    .filter(e => e.roomId === roomId && e.method === "GET")
    .slice(-10)
    .map(e => `${e.timestamp || ""} | ${e.originalPath || ""} -> ${e.statusCode} | ${e.durationMs}ms | ${e.remoteAddress || ""}`);
}

function deriveClientEvents(roomId) {
  if (!Array.isArray(registryState?.events)) return [];
  const events = registryState.events.filter(e => e.type === "room-upsert" && e.roomId === roomId);
  const derived = [];
  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1];
    const curr = events[i];
    const prevCount = Number(prev.playerCount) || 0;
    const currCount = Number(curr.playerCount) || 0;
    if (currCount > prevCount) {
      derived.push(`${curr.timestamp || ""} | Player joined (${prevCount}\u2192${currCount}/${curr.maxPlayers})`);
    } else if (currCount < prevCount) {
      derived.push(`${curr.timestamp || ""} | Player left (${prevCount}\u2192${currCount}/${curr.maxPlayers})`);
    }
  }
  return derived.slice(-10);
}

function parseConnectionLogs(roomId) {
  const stdout = roomLogsById.get(roomId)?.stdout || "";
  const keywords = /connected|disconnected|joined|left|client/i;
  return stdout
    .split("\n")
    .filter(line => keywords.test(line))
    .map(line => line.length > 120 ? line.slice(0, 120) + "..." : line)
    .slice(-10);
}

function getRoomHealth(room) {
  const registryRoom = findRegistryRoom(room);
  const playerCount = registryRoom?.playerCount ?? null;
  const maxPlayers = registryRoom?.maxPlayers ?? null;
  const lastSeenUnixMs = registryRoom?.lastSeenUnixMs ?? null;
  const heartbeatAge = lastSeenUnixMs ? Math.floor((Date.now() - lastSeenUnixMs) / 1000) : null;
  let uptime = null;
  if (room.createdAtUtc) {
    const created = new Date(room.createdAtUtc).getTime();
    if (!isNaN(created)) {
      const diffSec = Math.floor((Date.now() - created) / 1000);
      const h = Math.floor(diffSec / 3600);
      const m = Math.floor((diffSec % 3600) / 60);
      const s = diffSec % 60;
      uptime = h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
    }
  }
  const isHealthy = room.status === "running" && heartbeatAge !== null && heartbeatAge < 120;
  return { status: room.status, pid: room.pid, playerCount, maxPlayers, lastSeenUnixMs, heartbeatAge, uptime, isHealthy };
}

updateAuthUi();
refreshAll();
setInterval(refreshAll, 3000);

// === Services Tab ===

async function refreshServices() {
  try {
    const [svcPayload, tmplPayload] = await Promise.all([
      requestJson("/services"),
      requestJson("/api/templates")
    ]);
    state.services = svcPayload.services || [];
    const templates = tmplPayload.templates || [];

    if (serviceTemplateSelect) {
      const currentVal = serviceTemplateSelect.value;
      serviceTemplateSelect.innerHTML = templates
        .filter(t => t.type !== "built-in")
        .map(t => `<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)} ${t.description ? "- " + escapeHtml(t.description) : ""}</option>`)
        .join("");
      if (currentVal) serviceTemplateSelect.value = currentVal;
    }

    renderServices();
    updateServiceFilterOptions();
  } catch (e) {
  }
}

function renderServices() {
  if (!serviceList) return;
  if (state.services.length === 0) {
    serviceList.innerHTML = `<div class="service-item"><div class="service-meta"><div class="service-title">No services running</div><div class="service-sub">Start a service from a template above.</div></div></div>`;
    serviceCount.textContent = "0 services";
    return;
  }
  serviceList.innerHTML = state.services.map(s => {
    const dotClass = s.status;
    return `
      <div class="service-item">
        <div class="service-meta">
          <div class="service-title">
            <span class="status-dot ${dotClass}"></span>
            ${escapeHtml(s.label || s.templateName || s.serviceId)}
          </div>
          <div class="service-sub">
            ${escapeHtml(s.serviceId)} | ${escapeHtml(s.templateName)} | PID: ${s.pid ?? "-"} | Port: ${s.port ?? "-"}
          </div>
          <div class="service-sub">
            Status: ${escapeHtml(s.status)} | CPU: ${s.cpu != null ? s.cpu + "%" : "-"} | Mem: ${s.memory != null ? s.memory + " MB" : "-"} | Uptime: ${formatUptime(s.uptime)}
          </div>
        </div>
        <div class="service-actions">
          <button data-svc-action="restart" data-svc-id="${escapeHtml(s.serviceId)}">Restart</button>
          <button class="${s.status === "running" ? "" : "danger"}" data-svc-action="${s.status === "running" ? "stop" : "remove"}" data-svc-id="${escapeHtml(s.serviceId)}">${s.status === "running" ? "Stop" : "Remove"}</button>
        </div>
      </div>
    `;
  }).join("");
  serviceCount.textContent = `${state.services.length} ${state.services.length === 1 ? "service" : "services"}`;
}

function updateServiceFilterOptions() {
  if (!logServiceFilter) return;
  const current = logServiceFilter.value;
  const svcIds = state.services.map(s => s.serviceId);
  const existing = Array.from(logServiceFilter.options).map(o => o.value);
  for (const id of svcIds) {
    if (!existing.includes(id)) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = id;
      logServiceFilter.appendChild(opt);
    }
  }
  if (current && svcIds.includes(current)) {
    logServiceFilter.value = current;
  }
}

async function startServiceFromTemplate() {
  const templateName = serviceTemplateSelect?.value;
  if (!templateName) {
    alert("Select a template first.");
    return;
  }
  try {
    await requestJson("/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: templateName, overrides: {} })
    });
    await refreshServices();
  } catch (error) {
    alert(error.message || "Failed to start service.");
  }
}

async function handleServiceAction(serviceId, action) {
  try {
    if (action === "stop") {
      await requestJson(`/services/${encodeURIComponent(serviceId)}/stop`, { method: "POST" });
    } else if (action === "restart") {
      await requestJson(`/services/${encodeURIComponent(serviceId)}/restart`, { method: "POST" });
    } else if (action === "remove") {
      const resp = await authorizedFetch(`/services/${encodeURIComponent(serviceId)}`, { method: "DELETE" });
      if (!resp.ok) {
        const payload = await resp.json().catch(() => ({}));
        throw new Error(payload.error || `Remove failed with status ${resp.status}`);
      }
    }
    await refreshServices();
  } catch (error) {
    alert(error.message || `Failed to ${action} service.`);
  }
}

function formatUptime(seconds) {
  if (seconds == null) return "-";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

// === Logs Tab ===

function setupLogWebSocket() {
  if (logSearch) {
    logSearch.addEventListener("input", () => {
      if (wsLogSocket && wsLogSocket.readyState === WebSocket.OPEN) {
        const params = new URLSearchParams();
        if (logServiceFilter.value) params.set("service", logServiceFilter.value);
        if (logStreamFilter.value) params.set("stream", logStreamFilter.value);
        if (logSearch.value) params.set("search", logSearch.value);
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = window.location.host;
        wsLogSocket.close();
        wsLogSocket = new WebSocket(`${protocol}//${host}/logs?${params.toString()}`);
        setupWsHandlers();
      }
    });
  }
  if (logServiceFilter) {
    logServiceFilter.addEventListener("change", reconnectLogWs);
  }
  if (logStreamFilter) {
    logStreamFilter.addEventListener("change", reconnectLogWs);
  }
}

function connectLogWebSocket() {
  if (wsLogSocket && wsLogSocket.readyState === WebSocket.OPEN) return;
  const params = new URLSearchParams();
  if (logServiceFilter?.value) params.set("service", logServiceFilter.value);
  if (logStreamFilter?.value) params.set("stream", logStreamFilter.value);
  if (logSearch?.value) params.set("search", logSearch.value);
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  if (wsLogSocket) {
    try { wsLogSocket.close(); } catch (e) {}
  }
  wsLogSocket = new WebSocket(`${protocol}//${host}/logs?${params.toString()}`);
  setupWsHandlers();
}

function reconnectLogWs() {
  if (state.activeTab !== "logs") return;
  if (wsLogSocket) {
    try { wsLogSocket.close(); } catch (e) {}
  }
  connectLogWebSocket();
}

function setupWsHandlers() {
  if (!wsLogSocket) return;
  wsLogSocket.onopen = () => {
    if (logConnectionStatus) logConnectionStatus.textContent = "Connected to log stream";
  };
  wsLogSocket.onclose = () => {
    if (logConnectionStatus) logConnectionStatus.textContent = "Disconnected. Reconnecting...";
    setTimeout(() => {
      if (state.activeTab === "logs") connectLogWebSocket();
    }, 3000);
  };
  wsLogSocket.onerror = () => {
    if (logConnectionStatus) logConnectionStatus.textContent = "WebSocket error";
  };
  wsLogSocket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === "log" && !state.logPaused) {
        const line = `${msg.timestamp || ""} [${msg.serviceId}] [${msg.stream}] ${msg.data}`;
        state.logLines.push(line);
        if (state.logLines.length > 500) {
          state.logLines.splice(0, state.logLines.length - 500);
        }
        if (logTerminal) {
          logTerminal.textContent = state.logLines.join("\n");
          logTerminal.scrollTop = logTerminal.scrollHeight;
        }
      } else if (msg.type === "builds") {
        state.builds = msg.builds;
        populateBuildSelect();
        reconcileCollapsedBuilds();
        renderRooms();
        renderRoomMonitors();
        renderConnectionHints();
      } else if (msg.type === "connected" && logConnectionStatus) {
        logConnectionStatus.textContent = "Connected to log stream";
      }
    } catch (e) {
    }
  };
}

function toggleLogPause() {
  state.logPaused = !state.logPaused;
  const btn = document.getElementById("logPauseBtn");
  if (btn) btn.textContent = state.logPaused ? "Resume" : "Pause";
}

function clearLogs() {
  state.logLines = [];
  if (logTerminal) logTerminal.textContent = "";
}

// === Health Tab ===

async function refreshHealth() {
  try {
    const [svcPayload, telemetryPayload, registryPayload] = await Promise.all([
      requestJson("/services"),
      requestJson("/api/telemetry"),
      requestJson("/api/registry-state")
    ]);
    const services = svcPayload.services || [];
    renderHealthServices(services);
    renderHealthRegistry(registryPayload);
  } catch (e) {
  }
}

function renderHealthServices(services) {
  if (!healthServiceGrid) return;
  if (services.length === 0) {
    healthServiceGrid.innerHTML = `<div class="health-card"><div class="health-card-meta"><div class="health-card-name">No services running</div></div></div>`;
    if (healthServiceCount) healthServiceCount.textContent = "0 services";
    return;
  }
  healthServiceGrid.innerHTML = services.map(s => {
    const dotClass = s.status;
    const uptime = formatUptime(s.uptime);
    return `
      <div class="health-card">
        <div class="health-card-meta">
          <div class="health-card-name">
            <span class="status-dot ${dotClass}"></span>
            ${escapeHtml(s.label || s.templateName || s.serviceId)}
          </div>
          <div class="health-card-sub">${escapeHtml(s.serviceId)} | PID: ${s.pid ?? "-"}</div>
        </div>
        <div class="health-metrics">
          <div class="health-metric">
            <div class="health-metric-value">${escapeHtml(s.status)}</div>
            <div class="health-metric-label">Status</div>
          </div>
          <div class="health-metric">
            <div class="health-metric-value">${s.cpu != null ? s.cpu + "%" : "-"}</div>
            <div class="health-metric-label">CPU</div>
          </div>
          <div class="health-metric">
            <div class="health-metric-value">${s.memory != null ? s.memory + " MB" : "-"}</div>
            <div class="health-metric-label">Memory</div>
          </div>
          <div class="health-metric">
            <div class="health-metric-value">${uptime}</div>
            <div class="health-metric-label">Uptime</div>
          </div>
          <div class="health-metric">
            <div class="health-metric-value">${s.lastExitCode != null ? s.lastExitCode : "-"}</div>
            <div class="health-metric-label">Last Exit</div>
          </div>
        </div>
      </div>
    `;
  }).join("");
  if (healthServiceCount) healthServiceCount.textContent = `${services.length} ${services.length === 1 ? "service" : "services"}`;
}

function renderHealthRegistry(registry) {
  if (!healthRegistry) return;
  const lines = [
    "REGISTRY STATUS",
    `URL: ${registry.url || "not configured"}`,
    `Reachable: ${registry.ok ? "yes" : "no"}`,
    `Published Rooms: ${Array.isArray(registry.rooms) ? registry.rooms.length : 0}`,
    ""
  ];
  if (registry.error) {
    lines.push("ERROR:", registry.error);
  }
  if (registry.health) {
    lines.push("", "HEALTH:", JSON.stringify(registry.health, null, 2));
  }
  healthRegistry.textContent = lines.join("\n");
}
