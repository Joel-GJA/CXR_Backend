# CXR Observability — Prometheus + Grafana

This folder contains the monitoring stack for the CXR Multiplayer Infrastructure
(Phase 3, Track B — Telemetry & Observability).

The **CXR Backend Panel** exposes a single Prometheus-compatible metrics endpoint:

```
GET http://<panel-host>:4000/metrics
```

It aggregates the whole control plane into one scrape target — rooms, players,
services, CPU/memory/disk, and persisted event counts — so you don't need to
scrape each Unity room individually.

> The Unity room exporter (`RuntimeMetricsExporter.cs`) still writes a local
> `cxr_runtime_metrics.prom` snapshot for embedded/air-gapped scenarios. The
> panel endpoint is the authoritative aggregated view for dashboards.

---

## Exposed metrics

| Metric | Type | Labels | Meaning |
|--------|------|--------|---------|
| `cxr_panel_up` | gauge | — | Panel server is up (always 1 when scraped) |
| `cxr_panel_uptime_seconds` | gauge | — | Panel process uptime |
| `cxr_registry_up` | gauge | — | Room registry running (1/0) |
| `cxr_rooms_total` | gauge | — | Rooms tracked by the host manager |
| `cxr_rooms_running` | gauge | — | Rooms running or starting |
| `cxr_services_total` | gauge | — | Managed services total |
| `cxr_services_running` | gauge | — | Services running or starting |
| `cxr_room_players` | gauge | `room_id`, `room_name`, `status` | Current players per room |
| `cxr_room_max_players` | gauge | `room_id`, `room_name` | Max capacity per room |
| `cxr_service_cpu_percent` | gauge | `service_id`, `label` | Per-service CPU |
| `cxr_service_memory_mb` | gauge | `service_id`, `label` | Per-service memory |
| `cxr_cpu_usage_percent` | gauge | — | Overall host CPU |
| `cxr_load1` | gauge | — | Load average (1m) |
| `cxr_memory_used_bytes` / `cxr_memory_total_bytes` | gauge | — | System memory |
| `cxr_disk_used_bytes` / `cxr_disk_total_bytes` | gauge | — | Root/`C:` disk |
| `cxr_events_total` | counter | — | Total persisted runtime events |
| `cxr_event_type_total` | counter | `event_type` | Persisted events by type |

---

## Quick start (Docker)

```bash
# From this folder
docker run -d --name cxr-prometheus -p 9090:9090 \
  -v "$(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml" \
  prom/prometheus

docker run -d --name cxr-grafana -p 3000:3000 grafana/grafana
```

1. Open Prometheus at **http://localhost:9090** → Status → Targets → confirm
   `cxr-panel` is **UP**. Try a query: `cxr_rooms_running`.
2. Open Grafana at **http://localhost:3000** (default `admin` / `admin`).
3. Add a **Prometheus** data source → URL `http://host.docker.internal:9090`
   (or your Prometheus host).
4. **Dashboards → Import** → upload `grafana-dashboard.json` → pick the
   Prometheus data source when prompted.

## Quick start (binaries, no Docker)

```bash
prometheus --config.file=prometheus.yml      # serves :9090
grafana server                                # serves :3000
```

Edit `prometheus.yml` and change the target from `localhost:4000` to the
panel's LAN address if Prometheus runs on a different machine.

---

## Verifying the endpoint by hand

```bash
curl -s http://localhost:4000/metrics | head -40
```

You should see Prometheus text like:

```
# HELP cxr_rooms_running Rooms currently running or starting.
# TYPE cxr_rooms_running gauge
cxr_rooms_running 1
cxr_room_players{room_id="room-ab12cd",room_name="CXR_room_1",status="running"} 3
...
```
