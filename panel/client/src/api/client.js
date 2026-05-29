async function fetchJson(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'include',   // always send httpOnly session cookie
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (res.status === 401) {
    window.dispatchEvent(new Event('cxr:logout'));
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  login:           (username, password) => fetchJson('/api/auth/login',  { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout:          ()                   => fetchJson('/api/auth/logout', { method: 'POST' }),
  me:              ()                   => fetchJson('/api/auth/me'),
  listUsers:       ()                   => fetchJson('/api/auth/users'),
  createUser:      (data)               => fetchJson('/api/auth/users',                                               { method: 'POST',   body: JSON.stringify(data) }),
  deleteUser:      (username)           => fetchJson(`/api/auth/users/${encodeURIComponent(username)}`,               { method: 'DELETE' }),
  updateRole:      (username, role)     => fetchJson(`/api/auth/users/${encodeURIComponent(username)}/role`,          { method: 'PUT',    body: JSON.stringify({ role }) }),
  changePassword:  (username, password) => fetchJson(`/api/auth/users/${encodeURIComponent(username)}/password`,     { method: 'PUT',    body: JSON.stringify({ password }) }),
  changeMyPassword:(password)           => fetchJson('/api/auth/me/password',                                        { method: 'PUT',    body: JSON.stringify({ password }) }),
};

// ── Host Manager ──────────────────────────────────────────────────────────────
export const hm = {
  health:          ()     => fetchJson('/health'),
  state:           ()     => fetchJson('/api/state'),
  builds:          ()     => fetchJson('/builds'),
  telemetry:       ()     => fetchJson('/api/telemetry'),
  system:          ()     => fetchJson('/api/system'),
  requestActivity: ()     => fetchJson('/api/request-activity'),

  listRooms:   ()         => fetchJson('/rooms'),
  createRoom:  (body)     => fetchJson('/rooms',                  { method: 'POST',   body: JSON.stringify(body) }),
  stopRoom:    (id)       => fetchJson(`/rooms/${id}/stop`,      { method: 'POST'   }),
  restartRoom: (id)       => fetchJson(`/rooms/${id}/restart`,   { method: 'POST'   }),
  removeRoom:  (id)       => fetchJson(`/rooms/${id}`,           { method: 'DELETE' }),
  clearRooms:  ()         => fetchJson('/rooms/clear',          { method: 'POST'   }),
  roomLogs:    (id)       => fetchJson(`/api/logs/rooms/${id}`),

  templates:      ()      => fetchJson('/templates'),
  listServices:   ()      => fetchJson('/services'),
  startService:   (body)  => fetchJson('/services',               { method: 'POST',   body: JSON.stringify(body) }),
  stopService:    (id)    => fetchJson(`/services/${id}/stop`,   { method: 'POST'   }),
  restartService: (id)    => fetchJson(`/services/${id}/restart`,{ method: 'POST'   }),
  deleteService:  (id)    => fetchJson(`/services/${id}`,        { method: 'DELETE' }),
  serviceLogs:    (id)    => fetchJson(`/api/logs/services/${id}`),

  registryStatus:      ()  => fetchJson('/api/registry/status'),
  startRegistry:       ()  => fetchJson('/api/registry/start',   { method: 'POST'   }),
  stopRegistry:        ()  => fetchJson('/api/registry/stop',    { method: 'POST'   }),
  restartRegistry:     ()  => fetchJson('/api/registry/restart', { method: 'POST'   }),

  registryState:       ()  => fetchJson('/api/registry-state'),
  orphanRooms:         ()  => fetchJson('/api/registry-orphans'),
  deleteRegistryRoom:  (id)=> fetchJson(`/api/registry/rooms/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  hostLogs: () => fetchJson('/api/logs/host-manager'),
};

// ── Build Upload ──────────────────────────────────────────────────────────────
export const buildsApi = {
  list:   ()     => fetchJson('/api/builds/list'),
  delete: (name) => fetchJson(`/api/builds/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  upload: (file, onProgress) => new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('build', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/builds/upload');
    xhr.withCredentials = true;   // send session cookie
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || `HTTP ${xhr.status}`));
      } catch (e) { reject(e); }
    };
    xhr.onerror = () => reject(new Error('Upload failed (network error)'));
    xhr.send(formData);
  }),
};

// ── Events ────────────────────────────────────────────────────────────────────
export const events = {
  list:      (params = {}) => { const qs = new URLSearchParams(params).toString(); return fetchJson(`/api/events${qs ? '?' + qs : ''}`); },
  write:     (event)       => fetchJson('/api/events', { method: 'POST', body: JSON.stringify(event)  }),
  writeMany: (evts)        => fetchJson('/api/events', { method: 'POST', body: JSON.stringify(evts)   }),
  stats:     ()            => fetchJson('/api/events/stats'),
  replay:    (sessionId)   => fetchJson(`/api/events/replay/${encodeURIComponent(sessionId)}`),
};
