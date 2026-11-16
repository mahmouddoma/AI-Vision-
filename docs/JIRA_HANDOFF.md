# AI Camera Analytics — Frontend Jira Master Backlog & UX/API Handoff

**Source:** https://github.com/LoaiSaberC4r/AI_Analytical (branch `master`, inspected code snapshot commit `0865fdc3cc079f62cce9043b83f48f5c57b7a361`, 2026-11-16).  
**Audience:** Frontend Lead, Angular Developers, UI/UX Designer, QA.  
**Status:** Jira-ready proposed backlog based on existing backend source code, not proof of production runtime verification.  
**Backend:** ASP.NET Core 10, SQL Server/EF Core, MQTTnet, SignalR; **Frontend target:** Angular 22.  
**Core HTTP operations:** 37. **Hub methods:** 4. **Server-to-client events:** 4.  
**Scope:** Core management + live monitoring + reports + sessions + basic health. Advanced Alerts CRUD, detailed ingestion diagnostics, user management, authentication, video playback, cross-camera tracking excluded.

> **Repository state caveat:** There is already Angular source code under `frontend/camera-analytics-web`. Its existence does not prove the team has completed, deployed or signed off the UI. Team should inspect and reuse/rework it when appropriate, rather than blindly overwrite or treat the work as done.

> **Jira access:** Direct Jira creation was unavailable because the Atlassian search connector returned 403 `The app is not installed on this instance`. The accompanying CSV is a backlog import aid; map columns to your actual Jira project manually. Do not assume stories have already been created.

## Epic (create first in Jira)

**Summary:** `FE | AI Camera Analytics — Core Dashboard, Administration, Live Monitoring & Reports`  
**Issue type:** Epic  
**Suggested priority:** Highest  
**Objective:** Build and validate a cohesive, responsive Angular frontend powered by the existing 37 backend REST operations and four SignalR streams; let operators register sites/cameras/zones, monitor current readings, analyze valid historical metrics, and inspect recorded-video sessions. No invented metrics; respect data quality and event time.  
**Definition of Done:** All child stories meet acceptance criteria; typed HTTP integration; SignalR reconnect/REST recovery; responsive accessibility; negative/loading/empty states; tests; real end-to-end data via MQTT → SQL → API → UI; documentation.

## Backend integration endpoints

- Base URL on developer machine: `http://localhost:5080/api/v1` (runtime configurable; not hardcoded).
- Swagger UI: `http://localhost:5080/swagger/index.html`.
- OpenAPI JSON: `http://localhost:5080/swagger/v1/swagger.json`.
- SignalR Hub: `http://localhost:5080/hubs/analytics` (not prefixed with `/api/v1`).
- Frontend config example: `/public/config.json`: `apiBaseUrl`, `signalREnabled`, `hubPath`, `refreshIntervalSeconds`.
- Development CORS allows `http://localhost:4200`; environment overrides may differ.
- Internal IDs are GUIDs. `externalCameraId`/`externalZoneId` are **case-sensitive strings**. For actual MQTT inputs, camera external IDs include `cam1` and `2`; they are **not** the GUIDs used in API paths.

## Global API request/response rules

1. HTTP JSON names use camelCase. Display timestamps in site-local time when meaningful, with timezone label; preserve UTC ISO values for filters/API.
2. Every catalog `POST` returns `201 Created` and Location; `PUT` returns updated entity; status `PATCH` returns `204 No Content`.
3. Catalog updates require `rowVersion`, a Base64-encoded SQL Server 8-byte rowversion token; status patch body `{"isActive":true,"rowVersion":"..."}`. After successful mutation, refresh entity/list for new version.
4. `400`: invalid input; `404`: missing entity; `409`: duplicate business key or optimistic concurrency conflict; unexpected `500` shows generic safe message. ProblemDetails contains at least `status`, `detail`, `code` and `traceId`; show actionable UX and retain trace ID for support.
5. List pagination: `page` default 1, `pageSize` default 20 (1–100), optional `search`; shape `{items,page,pageSize,totalCount,totalPages}`. Cameras additionally accept `siteId`. Sessions additionally accept `cameraId`, `sourceType`.
6. ReportFilter supported: `{siteId?,cameraId?,zoneId?,from?,to?,interval?,sourceType?,sessionId?,fromSourceTimeMs?,toSourceTimeMs?}`.
7. `live` reporting: choose `sourceType=live`, `from` & `to` as ISO timestamps with timezone/UTC; half-open `[from,to)` interval; `minute|hour|day` buckets; max minute range default 7 days, hour/day default 90 days. These limits are backend-configurable.
8. `video_file` reporting: **must** provide `sessionId` and optionally `fromSourceTimeMs`/`toSourceTimeMs` as *milliseconds inside the video*. Do not send `from`/`to` clock time for video reports. Do not render recording playback time as the actual time a customer visited the site.
9. Response periods: `period` = `{sourceType,timeBasis,interval,timeZoneId,from,to,fromSourceTimeMs,toSourceTimeMs}`. When `timeBasis=sourceTime`, render `startSourceTimeMs/endSourceTimeMs` using mm:ss or hh:mm:ss.
10. Quality metadata: `{kind,sampleCount,coveragePercent,observationDurationSeconds,counterResetCount,baselineCount,gapCount}`. `kind` may be `Reported`, `Derived`, `Estimated`, `InsufficientData`. Display unknown/null as N/A; **never default to zero**.
11. The source's cumulative `zoneArrivals/zoneDepartures/entry/exit` values in live responses are not per-second deltas. Historical traffic endpoints already return derived period totals. Do not sum current snapshot counters in the browser.
12. `zone_arrivals` and `entry` are different concepts; UI labels must not conflate them. `occupancy` is directly reported and **not necessarily** `arrivals-departures`.
13. Site-level sum of zone occupancy is **not unique people**; camera views/zones may overlap. Historical dwell and completed visits are estimates from tracks; no cross-camera identities.
14. Server does not expose raw video streams, spatial heatmap coordinates, authenticated user roles, Alerts CRUD or new AI telemetry fields (`video_loop`, `unverified_losses`, etc.) through the current REST contract. Do not design working buttons for unsupported functionality.

## Verified API operation inventory (37)

Each row describes source-derived existing endpoint behavior. The frontend should generate its final TypeScript model from, or compare it against, the actual `Swagger /swagger/v1/swagger.json` of the running version before release.


### Sites (5)

| Method | Route after `/api/v1` | Purpose | Inputs | Output / errors | UI usage |
|---|---|---|---|---|---|
| **POST** | `/sites` | Create site | Body: name, code, description?, timeZoneId. rowVersion omitted. | 201 SiteData + Location; 400 required/invalid timezone, 409 duplicate code. | Sites create dialog |
| **GET** | `/sites` | List/search sites | Query: page=1, pageSize=20 (max100), search?. | 200 Page<SiteData>; items/page/pageSize/totalCount/totalPages. | Site list, site dropdowns, overview |
| **GET** | `/sites/{id}` | Get site | Path: internal site GUID. | 200 SiteData; 404 site missing. | Edit site, details |
| **PUT** | `/sites/{id}` | Update site | Body: name, code, description?, timeZoneId, rowVersion (Base64). | 200 SiteData; 400 invalid/rowVersion, 409 concurrency or unique code. | Site editor |
| **PATCH** | `/sites/{id}/status` | Activate/deactivate site | Body: {isActive:boolean,rowVersion:string}. | 204; 409 stale rowVersion. | Sites status action |

### Cameras (5)

| Method | Route after `/api/v1` | Purpose | Inputs | Output / errors | UI usage |
|---|---|---|---|---|---|
| **POST** | `/cameras` | Register camera | Body: siteId GUID, externalCameraId string, name, description?. | 201 CameraData + Location; 400 invalid segment,404 missing site,409 duplicate external ID. | Camera create |
| **GET** | `/cameras` | List cameras | Query page/pageSize/search/siteId?. | 200 Page<CameraData>. | Camera table, selectors |
| **GET** | `/cameras/{id}` | Get camera | Path internal camera GUID, not cam1/2. | 200 CameraData;404. | Camera editor, zone header |
| **PUT** | `/cameras/{id}` | Edit camera | Body: siteId, externalCameraId, name, description?, rowVersion. | 200 CameraData;409 concurrency; external ID/site stable after ingestion. | Camera editor |
| **PATCH** | `/cameras/{id}/status` | Enable/disable camera | Body {isActive,rowVersion}. | 204;409 concurrency. | Camera list |

### Zones (5)

| Method | Route after `/api/v1` | Purpose | Inputs | Output / errors | UI usage |
|---|---|---|---|---|---|
| **POST** | `/cameras/{cameraId}/zones` | Register zone for camera | Path internal camera GUID. Body externalZoneId,name,description?,capacity?,warningThresholdPercent?,criticalThresholdPercent?. | 201 ZoneData;400 capacity/thresholds,409 duplicate zone per camera. | Zone create |
| **GET** | `/cameras/{cameraId}/zones` | List camera zones | Path internal camera GUID. Query page/pageSize/search. | 200 Page<ZoneData>;404 camera missing. | Zone list, analytics filters |
| **GET** | `/zones/{id}` | Get zone | Path internal zone GUID. | 200 ZoneData;404. | Zone edit/details |
| **PUT** | `/zones/{id}` | Edit zone | Body externalZoneId?,name,description?,capacity?,warningThresholdPercent?,criticalThresholdPercent?,rowVersion. | 200 ZoneData;409 concurrency/stable ID conflict. | Zone editor |
| **PATCH** | `/zones/{id}/status` | Enable/disable zone | Body {isActive,rowVersion}. | 204;409 concurrency. | Zone status |

### Live monitoring (4)

| Method | Route after `/api/v1` | Purpose | Inputs | Output / errors | UI usage |
|---|---|---|---|---|---|
| **GET** | `/sites/{siteId}/live` | Get current site-wide live state | Path internal site GUID. | 200 LiveSite: siteId/siteName/isActive/cameras[];404. | Overview, Live site |
| **GET** | `/cameras/{cameraId}/live` | Get current camera snapshot | Path internal camera GUID. | 200 LiveCamera incl zones[], freshness, sequence, stateVersion;404. | Live camera detail, reconnect |
| **GET** | `/zones/{zoneId}/live` | Get current zone snapshot | Path internal zone GUID. | 200 LiveZone including capacity and previousSession;404. | Zone drawer |
| **GET** | `/monitoring/status` | Global monitoring summary | No query. | 200 MonitoringStatus with counts and mqttEnabled/mqttSubscribed. | Header, overview, operations |

### Analytics overview / zone (4)

| Method | Route after `/api/v1` | Purpose | Inputs | Output / errors | UI usage |
|---|---|---|---|---|---|
| **GET** | `/analytics/overview` | Site/zone headline KPIs | ReportFilter; live from/to or video session + source offsets. | 200 OverviewReport incl rankings, observedZoneAverageOccupancy, traffic, dataQuality. | Overview |
| **GET** | `/analytics/zones/rankings` | Rank zones by selected metric | ReportFilter + metric (arrivals, entries, departures, exits, averageOccupancy, peakOccupancy, utilization, reportedAverageDwell, estimatedAverageDwell, longestActiveDwell, wrongWayEvents). | 200 RankingReport period/metric/unit/items[] with rank/value/quality;400 metric invalid. | Rankings tab |
| **GET** | `/analytics/zones/{zoneId}/summary` | Single zone report summary | Path internal zone GUID + ReportFilter. | 200 ZoneResult;404 for invalid zone. | Zone analytical drawer |
| **GET** | `/analytics/zones/{zoneId}/timeseries` | Time series for selected zone | Path internal zone GUID + ReportFilter/interval. | 200 ReportResult with zones[].series[] (PeriodPoint, occupancy, traffic, quality). | Zone detail charts |

### Occupancy / peaks (3)

| Method | Route after `/api/v1` | Purpose | Inputs | Output / errors | UI usage |
|---|---|---|---|---|---|
| **GET** | `/analytics/occupancy` | Occupancy summaries + series | ReportFilter from/to, interval, sourceType OR sessionId & video offset. | 200 OccupancyReport period/zones[] with peakHour/coverage/series. | Occupancy tab, overview charts |
| **GET** | `/analytics/peak-hours` | Peak hour by zone/metric | ReportFilter; service forces interval=hour. | 200 PeakHoursReport zones[] {occupancy,arrivals,entries,departures,wrongWayEvents} each ZonePeriod|null. | Peak hours screen |
| **GET** | `/analytics/occupancy/utilization` | Capacity comparisons | ReportFilter. | 200 UtilizationReport zones[] {capacity,averageUtilizationPercent,peakUtilizationPercent,dataQuality}. | Utilization panel |

### Traffic (2)

| Method | Route after `/api/v1` | Purpose | Inputs | Output / errors | UI usage |
|---|---|---|---|---|---|
| **GET** | `/analytics/traffic` | Period totals & zones summary | ReportFilter. | 200 TrafficReport period/totals/zones[] (series may be empty). | Traffic summary |
| **GET** | `/analytics/traffic/trends` | Traffic time series | ReportFilter + interval. | 200 TrafficReport period/totals/zones[].series[].traffic. | Traffic chart |

### Dwell (2)

| Method | Route after `/api/v1` | Purpose | Inputs | Output / errors | UI usage |
|---|---|---|---|---|---|
| **GET** | `/analytics/dwell` | Dwell by zone | ReportFilter. | 200 DwellReport zones[] reportedAverageDwellSeconds, longestActiveDwellSeconds, estimatedCompletedVisits, estimatedTotalDwellSeconds, estimatedHistoricalAverageDwellSeconds, uncertainVisits, dataQuality. | Dwell tab |
| **GET** | `/analytics/dwell/rankings` | Dwell-only rankings | ReportFilter + metric among reportedAverageDwell/estimatedAverageDwell/longestActiveDwell. | 200 RankingReport;400 metric invalid. | Dwell ranking |

### Wrong-way / Staff (2)

| Method | Route after `/api/v1` | Purpose | Inputs | Output / errors | UI usage |
|---|---|---|---|---|---|
| **GET** | `/analytics/wrong-way` | Wrong-way events | ReportFilter. | 200 WrongWayReport period/wrongWayIn/wrongWayOut/wrongWayEvents/highestWrongWayZone/zones[].series. | Wrong-way tab |
| **GET** | `/analytics/staff` | Staff presence by camera | ReportFilter. | 200 StaffReport period/cameras[] latestStaffCount/averageStaffCount/peakStaffCount/series. | Staff tab |

### Sessions (3)

| Method | Route after `/api/v1` | Purpose | Inputs | Output / errors | UI usage |
|---|---|---|---|---|---|
| **GET** | `/analytics/sessions` | List analytics sessions | Query page/pageSize/search/siteId?/cameraId?/sourceType?. | 200 Page<SessionData>. | Sessions list and video selector |
| **GET** | `/analytics/sessions/{id}` | Get session detail | Path internal session GUID. | 200 SessionData;404. | Session details |
| **GET** | `/analytics/sessions/{id}/report` | Get session analytics and staff | Path internal session GUID, ReportFilter including video fromSourceTimeMs/toSourceTimeMs/interval. | 200 SessionReport {session,analytics,staff,untimedVideoObservations};404. | Session report |

### Health (2)

| Method | Route after `/api/v1` | Purpose | Inputs | Output / errors | UI usage |
|---|---|---|---|---|---|
| **GET** | `/health/live` | Backend liveness | No params. | 200 {status:"Healthy"} when server responds. | Operations status |
| **GET** | `/health/ready` | Backend readiness | No params. | 200 or 503; {status,database,mqtt} e.g. Degraded/Ready/Subscribed. | Operations status |

## Exact important frontend interfaces / response models

### Catalog data shapes

- `SiteData`: `id:GUID`, `name`, `code`, `description?`, `timeZoneId`, `isActive`, `createdAtUtc`, `updatedAtUtc`, `rowVersion:Base64`.
- `CameraData`: `id`, `siteId`, `siteName`, `externalCameraId`, `name`, `description?`, `isActive`, `zonesCount`, `mqttTopic`, `lastReceivedAtUtc?`, `createdAtUtc`, `updatedAtUtc`, `rowVersion`.
- `ZoneData`: `id`, `cameraId`, `externalZoneId`, `name`, `description?`, `capacity?:number|null`, `warningThresholdPercent`, `criticalThresholdPercent`, `isActive`, `createdAtUtc`, `updatedAtUtc`, `rowVersion`.
- `SiteWrite`: `name`,`code`,`description?`,`timeZoneId`,`rowVersion?`; `CameraWrite`: `siteId`,`externalCameraId`,`name`,`description?`,`rowVersion?`; `ZoneWrite`: `externalZoneId`,`name`,`description?`,`capacity?`,`warningThresholdPercent?`,`criticalThresholdPercent?`,`rowVersion?`.
- Backend site code is normalized uppercase and site ID/camera external ID are unique in their backend-defined scopes. `externalZoneId` unique within one camera. Editing external IDs after ingestion can conflict.
- Supported time zones are accepted by backend TimeZoneInfo; `Africa/Cairo` is a known working setting for the current Demo. Avoid a static hardcoded list claiming universal support.

### Live models

- `LiveSite`: `siteId`, `siteName`, `isActive`, `cameras:LiveCamera[]`.
- `LiveCamera`: `cameraId`, `siteId`, `externalCameraId`, `cameraName`, `isActive`, `sessionId?`, `lastSequence?`, `sourceType?`, `analyticsStatus?`, `dataFreshness`, `processingFps?`, `staffCount?`, `lastReceivedAtUtc?`, `stateVersion?`, `zones:LiveZone[]`.
- `LiveZone`: `zoneId`, `cameraId`, `externalZoneId`, `zoneName`, `isActive`, `sessionId?`, `sequence?`, `stateVersion?`, `previousSession`, `dataFreshness`, `occupancy?`, `zoneArrivals?`, `zoneDepartures?`, `entry?`, `exit?`, `wrongWayIn?`, `wrongWayOut?`, `reportedAverageDwellSeconds?`, `longestActiveDwellSeconds?`, `activeVisitorsCount?`, `capacity?`, `warningThresholdPercent`, `criticalThresholdPercent`, `utilizationPercent?`, `capacityStatus?`, `lastUpdatedAtUtc?`.
- `MonitoringStatus`: `registeredCameras`,`activeCameras`,`fresh`,`stale`,`noRecentData`,`neverReceived`,`ended`,`mqttEnabled`,`mqttSubscribed`,`checkedAtUtc`.
- Freshness options: `NeverReceived`, `Fresh`, `Stale`, `NoRecentData`. Session status separately `running`, `ended` (and internal superseded/historical states in sessions). Preserve last known values when not fresh; do not reset to 0.
- `capacityStatus` is backend-derived (e.g. WithinCapacity, Warning, Critical) or null when missing capacity. Use backend labels as source of truth.

### Analytics models

- `TrafficTotals`: `arrivals`,`departures`,`entries`,`exits`,`wrongWayIn`,`wrongWayOut`,`wrongWayEvents`.
- `RankingReport`: `period`, `metric`, `unit`, `items:[{rank,zoneId,zoneName,value,dataQuality}]`.
- `OverviewReport`: `period`,`mostVisitedZone?`,`topEntryZone?`,`mostDepartedZone?`,`topExitZone?`,`mostCrowdedZone?`,`peakOccupancy?`,`longestActiveStay?`,`estimatedHistoricalDwell?`,`highestWrongWayZone?`,`observedZoneAverageOccupancy?`,`traffic`,`dataQuality`.
- `ZonePeriod`: `{period:{startUtc?,endUtc?,localStart?,startSourceTimeMs?,endSourceTimeMs?}, averageOccupancy?,peakOccupancy?,peakAtUtc?,peakAtSourceTimeMs?,traffic,dataQuality}`.
- `OccupancyReport`: `{period,zones:[{zoneId,zoneName,averageOccupancy?,peakOccupancy?,peakAtUtc?,peakAtSourceTimeMs?,peakHour?,capacity?,peakUtilizationPercent?,dataQuality,series:ZonePeriod[]}]}`.
- `PeakHoursReport`: `{period,zones:[{zoneId,zoneName,occupancy:ZonePeriod|null,arrivals:ZonePeriod|null,entries:ZonePeriod|null,departures:ZonePeriod|null,wrongWayEvents:ZonePeriod|null}]}`.
- `UtilizationReport`: `{period,zones:[{zoneId,zoneName,capacity?,averageUtilizationPercent?,peakUtilizationPercent?,dataQuality}]}`.
- `TrafficReport`: `{period,totals:TrafficTotals,zones:[{zoneId,zoneName,traffic,dataQuality,series:ZonePeriod[]}]}`.
- `DwellReport`: `{period,zones:[{zoneId,zoneName,reportedAverageDwellSeconds?,longestActiveDwellSeconds?,estimatedCompletedVisits,estimatedTotalDwellSeconds?,estimatedHistoricalAverageDwellSeconds?,uncertainVisits,dataQuality}]}`.
- `WrongWayReport`: `{period,wrongWayIn,wrongWayOut,wrongWayEvents,highestWrongWayZone?,zones:TrafficZone[]}`.
- `StaffReport`: `{period,cameras:[{cameraId,cameraName,latestStaffCount?,lastReceivedAtUtc?,averageStaffCount?,peakStaffCount?,dataQuality,series:[{period,averageStaffCount?,peakStaffCount?,dataQuality}]}]}`.
- `SessionData`: `id`,`cameraId`,`cameraName`,`externalSessionId`,`sourceType`,`sourceName`,`status`,`firstSequence`,`lastSequence`,`firstSourceTimeMs?`,`lastSourceTimeMs?`,`firstSourceTimestampUtc`,`lastSourceTimestampUtc`,`startedAtUtc`,`lastReceivedAtUtc`,`endedAtUtc?`,`createdAtUtc`.
- `SessionReport`: `{session:SessionData,analytics:ReportResult,staff:StaffReport,untimedVideoObservations}`.
- `ReportResult` / `ZoneResult` also contain `cameraId`, zone/capacity metrics, dwell, traffic, dataQuality and `series` as defined in the repository.

### Example HTTP bodies (matching backend)

```http
POST /api/v1/sites
Content-Type: application/json

{"name":"Main Mall","code":"MALL-001","description":"Demo site","timeZoneId":"Africa/Cairo"}
```

```http
POST /api/v1/cameras
Content-Type: application/json

{"siteId":"<site-guid>","externalCameraId":"cam1","name":"Camera 1 - Video 1","description":"Recorded video analysis"}
```

```http
POST /api/v1/cameras/<camera-guid>/zones
Content-Type: application/json

{"externalZoneId":"zone_01","name":"Zone 01","capacity":null,"warningThresholdPercent":80,"criticalThresholdPercent":100}
```

```http
PATCH /api/v1/cameras/<camera-guid>/status
Content-Type: application/json

{"isActive":false,"rowVersion":"<Base64 rowVersion from latest GET>"}
```

```http
GET /api/v1/analytics/traffic/trends?siteId=<site-guid>&sourceType=live&from=2026-11-16T09:00:00Z&to=2026-11-16T10:00:00Z&interval=minute
```

```http
GET /api/v1/analytics/sessions/<session-guid>/report?sourceType=video_file&fromSourceTimeMs=0&toSourceTimeMs=180000&interval=minute
```

## SignalR realtime contract and lifecycle

Hub URL **`/hubs/analytics`** (separate from REST prefix). The hub is mapped only if the backend `SignalR:Enabled=true`.

| Direction | Method / event | Payload / use |
|---|---|---|
| Client → Hub | `SubscribeToSite(siteId)` | Internal site GUID; join site:{id} after existence validation. |
| Client → Hub | `UnsubscribeFromSite(siteId)` | Leave site updates. |
| Client → Hub | `SubscribeToCamera(cameraId)` | Internal camera GUID; join camera:{id}. |
| Client → Hub | `UnsubscribeFromCamera(cameraId)` | Leave camera updates. |
| Hub → Client | `CameraSnapshotUpdated` | `{cameraId,siteId,sessionId,sequence,stateVersion,sourceType,analyticsStatus,dataFreshness,processingFps,staffCount,receivedAtUtc}`. |
| Hub → Client | `ZoneMetricsUpdated` | `{cameraId,zoneId,sessionId,sequence,stateVersion,occupancy,arrivals,departures,entry,exit,wrongWayIn,wrongWayOut,reportedAverageDwellSeconds,activeVisitorsCount,longestActiveDwellSeconds,receivedAtUtc}`. Notice event property `arrivals` maps to live zone property `zoneArrivals`. |
| Hub → Client | `CameraStatusChanged` | `{cameraId,siteId,sessionId,stateVersion,analyticsStatus,dataFreshness,receivedAtUtc}`. |
| Hub → Client | `AnalyticsSummaryUpdated` | `{cameraId,siteId,sessionId,stateVersion,receivedAtUtc}`; notification to refresh summary, **not** a complete analytics response. |

**Lifecycle:** load REST initial state → start connection → subscribe to selected site/camera → apply versioned events → mark disconnected if transport fails but keep last state with freshness → reconnect/resubscribe → GET current REST snapshot again → ignore older events by `stateVersion` and mismatched session. On page change leave old group, enter new one, cancel subscriptions. If SignalR disabled/unavailable, use configured periodic REST refresh and show connection mode. Avoid uncontrolled requests on each 1-second event; debounce summary refresh.

## UX architecture & information architecture

**Goal:** data-dense but legible operations command center, not a generic chart grid. Users must understand where the reading came from, whether it is current, and what it actually means.

### Desktop information architecture (proposed)

```text
+-------------------------------------------------------------------------------------+
| Site selector | [Live / Video Session] | Time range / Source Time | Data freshness   |
+--------------------+----------------------------------------------------------------+
| CAMERA ANALYTICS   | Page title / breadcrumbs                                         |
| -----------------  |----------------------------------------------------------------|
| Overview           | [Healthy Cams] [Stale Cams] [Current Zone Occupancy*] [Top Zone] |
| Live Monitoring    |----------------------------------------------------------------|
| Analytics          | [Occupancy / Traffic timeline with quality annotation]          |
|   Zone Rankings    |----------------------------------------------------------------|
|   Occupancy        | Zone ranking table | Top Entry | Most Crowded | Dwell Estimate  |
|   Traffic          |----------------------------------------------------------------|
|   Dwell            | Camera cards, drill-down links and data quality                 |
|   Wrong-way        |                                                                |
|   Staff            |                                                                |
| Sessions           |                                                                |
| Sites              |                                                                |
| Cameras / Zones    |                                                                |
+--------------------+----------------------------------------------------------------+
* zone occupancy is NOT a count of distinct visitors across overlapping camera views.
```

### Navigation and UI states

- Sidebar and mobile drawer: Overview, Live Monitoring, Analytics, Sessions, Sites, Cameras & Zones. Advanced Alerts and Detailed Diagnostics navigation **not shown** in v1.
- Topbar: current site, freshness/connection status, timeframe or video session controls, last refresh; a direct link to source code/docs is optional.
- Dashboard first viewport: show high-confidence live operational metrics; highlight stale/unknown values clearly.
- Data grids: server pagination, search, responsive horizontal scroll, real status labels, action menu, no dangerous delete buttons.
- Forms: required field indicators, inline validation, field-level server errors, Save/Cancel, disabled Submit while pending, optimistic concurrency warning with Reload button.
- Empty states are distinct: no Site registered, no camera for Site, camera never received data, no visits in period, unsupported time source, server failed, stale reading.
- Loading: skeleton table/cards, maintain previous data where useful but visibly show refreshing rather than flashing zero.
- Accessibility: semantic headings/tables, keyboard actions, focus visibility, labels and live-region announcements for connection state; graph alternatives in tooltips/text/tables.
- Responsive: sidebar becomes drawer, KPI cards stack, chart height remains readable, data tables scroll, filters compact/expand, no inaccessible hover-only actions.
- Numeric format: counts as integer with grouping, dwell in s / mm:ss, percentages to 1 decimal, timestamps with explicit timezone and tooltip containing UTC. Never auto-round percentages in ways that hide 100%+ utilization.
- The frontend should be English-first to match current API/labels; architect components for future Arabic translations rather than hardcode English into data logic. Arabic RTL is a future enhancement unless separately commissioned.

### User journeys

**First-time setup:** Sites → Create site → Cameras → Create camera with string external ID → Manage Zones → Create zone external IDs → Live page (NeverReceived until AI messages) → MQTT publishes → live data appears.

**Live operations:** Select site → inspect camera freshness → drill into camera → see per-zone occupancy and count labels → click zone analytics → change interval/filter → inspect quality.

**Historical reporting:** Select source `live` → date range/site/zone → rankings/occupancy/traffic/dwell → check coverage/reset warnings → compare valid results.

**Recorded video:** Sessions → filter video_file → select session → read source video timeline → peak position mm:ss, not venue time → inspect untimedVideoObservations and uncertainty.

## Pages, wireframe blocks and API mapping

| Page / Route | Key blocks & expected interactions | Exact consumed APIs | Realtime? |
|---|---|---|---|
| Overview `/` | Site context, monitoring counts, headline KPI ranking cards, 12–24h occupancy graph, quality indicator; clickable drilldowns. | `GET /sites`, `GET /sites/{siteId}/live`, `GET /monitoring/status`, `GET /analytics/overview`, `GET /analytics/occupancy` | Site subscription; summary refresh signal. |
| Sites `/sites` | Search/paginated table, create/edit modal, status switch, rowVersion conflict handling. | `GET /sites`, `GET /sites/{id}`, `POST /sites`, `PUT /sites/{id}`, `PATCH /sites/{id}/status` | No. |
| Cameras `/cameras` | Filter by site, camera table with topic/external ID/zones count/status/last seen; add/edit/deactivate, zone and live links. | `GET /sites`, `GET /cameras`, `GET /cameras/{id}`, `POST /cameras`, `PUT /cameras/{id}`, `PATCH /cameras/{id}/status` | Optional freshness display via polling. |
| Zones `/cameras/:cameraId/zones` | Camera header, list registered zones, optional capacity, thresholds, edit/status actions. | `GET /cameras/{id}`, `GET /cameras/{cameraId}/zones`, `GET /zones/{id}`, `POST /cameras/{cameraId}/zones`, `PUT /zones/{id}`, `PATCH /zones/{id}/status` | No. |
| Live site `/live` | Site filter, camera cards, status pills, current zone numbers, recent observation; navigation to camera. | `GET /sites`, `GET /sites/{siteId}/live`, `GET /monitoring/status` | SubscribeToSite. |
| Live camera `/live/:cameraId` | Camera status/FPS/session/sequence + zones cards, per-zone last update, drill-down. | `GET /cameras/{cameraId}`, `GET /cameras/{cameraId}/live`, `GET /zones/{zoneId}/live` | SubscribeToCamera. |
| Analytics `/analytics` (Rankings) | Filters, metric selector and sortable ranking cards/table; zone summary and timeseries. | `GET /sites`, `GET /cameras`, `GET /cameras/{cameraId}/zones`, `GET /analytics/zones/rankings`, `GET /analytics/zones/{zoneId}/summary`, `GET /analytics/zones/{zoneId}/timeseries` | Optional; mostly historical requests. |
| Analytics `/analytics` (Occupancy) | Weighted avg, peak, hour ranking, time-series chart, utilization and coverage. | `GET /analytics/occupancy`, `GET /analytics/peak-hours`, `GET /analytics/occupancy/utilization` | No requirement; refresh on Apply. |
| Analytics `/analytics` (Traffic) | Arrivals vs entries, departures vs exits, trends, data-quality resets. | `GET /analytics/traffic`, `GET /analytics/traffic/trends` | No. |
| Analytics `/analytics` (Dwell) | Reported vs estimated dwell, longest active, estimated visits, uncertain visits and rankings. | `GET /analytics/dwell`, `GET /analytics/dwell/rankings` | No. |
| Analytics `/analytics` (Wrong-way) | Separate direction count, zone ranking and trend. | `GET /analytics/wrong-way` | No. |
| Analytics `/analytics` (Staff) | Camera staff count/average/peak series and no cross-camera uniqueness claim. | `GET /analytics/staff` | No. |
| Sessions `/sessions` | Search, source type, camera/site filters, paginated sessions table, details navigation. | `GET /analytics/sessions`, `GET /analytics/sessions/{id}`, `GET /sites`, `GET /cameras` | No. |
| Session Report `/sessions/:id` | Source-time timeline, source name, analytics panels, staff, uncertain observations, quality. | `GET /analytics/sessions/{id}`, `GET /analytics/sessions/{id}/report`, optionally `GET /analytics/zones/{zoneId}/timeseries` | No. |
| System status (compact header/dialog) | Monitoring summary, backend live/ready state and MQTT status. | `GET /monitoring/status`, `GET /health/live`, `GET /health/ready` | CameraStatusChanged only for camera badges. |

The route structure above is a frontend UX proposal grounded in available APIs; the backend does not define frontend page URLs. There is no POST HTTP endpoint for MQTT (publisher uses broker separately).

## Important backend/API caveats for FE acceptance

1. **Video loops:** real publisher emits `video_loop`, and `source_time_ms` can reset during a loop while `session_id` is unchanged. Current `ObservationRules.IsOrdered` compares source time within a session. Backend may classify valid next-loop messages as historical-only and halt updating live state. This is a backend defect candidate; flag a separate BE issue before relying on session peaks. FE must not hide it with invented values.
2. **New AI telemetry:** publisher now also emits `unverified_losses`, `loop_boundary_closures`, `exclusion_removals`, `zone_balance_delta`, `normal_in/out`, `actual_gate_in/out`, `gate_balance_delta`, `totals`, `video_loop`. Current MQTT reader accepts unknown JSON properties but does **not** expose these fields to current REST/SignalR DTOs. FE must not make dashboard fields from them until the API contract changes.
3. **Coverage eligibility:** in reviewed code, general `AnalyticsController.Ranking` passes minimum coverage `0`, despite configured `MinimumCoveragePercentForPeakRanking=80`. `/analytics/peak-hours` does apply configured coverage. This can lead to misleading average occupancy rankings; log BE fix/confirmation.
4. **No auth:** Core Demo endpoints and Hub do not implement user authentication. Keep developer UI on trusted network; no login mock screen or fake roles.
5. **Site context:** Site and Cameras are registered; example real external IDs `cam1` and `2`, zones camera cam1: zone_01, camera 2: zone_01 and zone_02. UI routes use internal GUIDs returned from registry APIs.
6. **Readiness:** `/health/ready` can return 503 if SQL unavailable/migrations missing, and 200 with `status:Degraded` for disconnected MQTT. Do not collapse these into same state.

## QA definition of done (all stories)

- No generic mock metrics substituted for backend state.
- Works without SignalR (polling) and recovers after reconnect.
- All destructive-looking actions confirm intent; no hard-delete UI where endpoint absent.
- API permissions and route errors handled gracefully even though v1 auth not implemented.
- Every chart states its metric, unit, period, time basis and sample/coverage limitations.
- Browser does not compute historic KPIs from cumulative counters.
- Both camera external IDs and zones visible when backend has registered them, and live updates from SQL+SignalR validated.
- Backend changes needed are tracked separately, rather than concealed in frontend presentation.

## Suggested Jira story order and release plan

**Sprint/Phase 1 — Foundation & Registry:** FE-01, FE-02, FE-03, FE-04, FE-05, FE-06.  
**Sprint/Phase 2 — Live Operations:** FE-10, FE-08, FE-09, FE-07, FE-19.  
**Sprint/Phase 3 — Historical Analytics:** FE-11, FE-12, FE-13, FE-14, FE-15, FE-16, FE-17, FE-18, FE-20.  
**Sprint/Phase 4 — QA, polish and handoff:** FE-21, FE-22, FE-23, FE-24.  
Priorities are proposed; effort/story points should be estimated by the team, not invented here.

## Detailed Jira stories (copy each as a Story under the Epic)


### FE-01 — Frontend foundation, routing & runtime configuration

**Issue type:** Story  
**Suggested priority:** Highest  
**Component:** Frontend Foundation  
**Dependencies:** FE-02  

**Description**  
Implement a runnable Angular 22 workspace or assess/reuse the Angular code already in the repository. Establish standalone architecture, lazy routes, navigation, configurable API base URL and SignalR hub.

**Endpoints / integrations**

- `Runtime /public/config.json; all REST endpoints in subsequent stories`

**Acceptance Criteria**
1. Routes: /, /sites, /cameras, /cameras/:cameraId/zones, /live, /live/:cameraId, /analytics, /sessions, /sessions/:id, and a Not Found fallback.
2. Load /public/config.json before bootstrap; apiBaseUrl, hubPath, signalREnabled and refreshIntervalSeconds configurable without rebuilding.
3. No API endpoints hardcoded in templates; common HttpClient services.
4. App starts locally and has meaningful Loading, Error and No Data states.
5. No sensitive backend appsettings or broker credentials in browser.

**QA evidence:** screenshots/screenshare, request/response examples, test results and errors resolved for this story.

### FE-02 — Design system, app shell and end-to-end UX blueprint

**Issue type:** Story  
**Suggested priority:** Highest  
**Component:** UX / UI  
**Dependencies:** FE-01  

**Description**  
Build a coherent operations/analytics visual language, not a generic admin CRUD template. Include desktop sidebar/topbar, contextual breadcrumbs, site selection, time range, freshness indicator and responsive navigation.

**Endpoints / integrations**

- No new backend endpoints; cross-cutting work.

**Acceptance Criteria**
1. Create reusable KPI cards, table, chip/status, alert banner, skeleton, empty/error views, confirm dialog, filter toolbar, chart wrappers and modal/drawer.
2. Ensure visual hierarchy: site context > current health > KPIs > trends > zone drilldown.
3. Define colors/labels for Fresh, Stale, NoRecentData, NeverReceived, Ended, Warning, Critical, Estimated. Use icons/text, not color alone.
4. Support keyboard navigation, focus trapping in dialogs, WCAG AA contrast, accessible chart summaries and mobile layouts.
5. Wireframes/components documented and consistent across every feature.

**QA evidence:** screenshots/screenshare, request/response examples, test results and errors resolved for this story.

### FE-03 — Typed REST API client, contracts, errors & pagination

**Issue type:** Story  
**Suggested priority:** Highest  
**Component:** Frontend Foundation  
**Dependencies:** FE-01  

**Description**  
Implement typed API services matching backend DTOs, common query builders, cross-cutting loading and HTTP error handling. Base client on actual backend sources, not hypothetical fields.

**Endpoints / integrations**

- `All 37 REST operations`

**Acceptance Criteria**
1. TypeScript interfaces match SiteData, CameraData, ZoneData, Live*, Report*, Page<T> and ProblemDetails.
2. Use camelCase, GUID internal IDs, string external IDs; status patch includes rowVersion.
3. Centralized error handler maps status 400/404/409/500 and ProblemDetails.code/traceId into actionable UX.
4. Centralized pagination page/pageSize/search and report filters; do not send blank GUID values.
5. Recover from 409 by reloading entity; never overwrite silently.
6. Tests for URL, query params and error mapper.

**QA evidence:** screenshots/screenshare, request/response examples, test results and errors resolved for this story.

### FE-04 — Sites management — list, create, edit and activation

**Issue type:** Story  
**Suggested priority:** High  
**Component:** Management  
**Dependencies:** FE-03  

**Description**  
Implement /sites page with searchable/paginated table and create/edit dialog. Site is the root of the place hierarchy.

**Endpoints / integrations**

- `GET /sites`
- `GET /sites/{id}`
- `POST /sites`
- `PUT /sites/{id}`
- `PATCH /sites/{id}/status`

**Acceptance Criteria**
1. Columns: Name, Code, Time zone, Active, Updated at, Actions.
2. Create form: name, code, description, timeZoneId. Required name/code/timeZoneId.
3. Edit preserves current rowVersion; status toggle sends isActive and rowVersion; reload row version afterward.
4. 409 duplicate code/concurrency and 400 validation shown inline; no hard delete action.
5. On success navigate or refresh list, show appropriate success message.

**QA evidence:** screenshots/screenshare, request/response examples, test results and errors resolved for this story.

### FE-05 — Camera management — registry and MQTT topic mapping

**Issue type:** Story  
**Suggested priority:** High  
**Component:** Management  
**Dependencies:** FE-04  

**Description**  
Implement /cameras page with site filter, list, form, enable/disable, route to zones and live camera monitoring.

**Endpoints / integrations**

- `GET /sites`
- `GET /cameras`
- `GET /cameras/{id}`
- `POST /cameras`
- `PUT /cameras/{id}`
- `PATCH /cameras/{id}/status`

**Acceptance Criteria**
1. Columns: Camera, Site, externalCameraId, derived mqttTopic, Zones count, Active, Last received, Actions.
2. Create: siteId, externalCameraId, name, description. Validate topic-segment ID.
3. Edit includes rowVersion and must respect backend stable ID/site assignment rules once ingestion exists.
4. Show matching MQTT topic cameras/{externalCameraId}/analytics as read-only, never editable URL.
5. Site list provides dropdown; expose IDs cam1 and 2 as strings, never confuse them with internal GUID.
6. Buttons: Manage Zones, View Live; no camera delete.

**QA evidence:** screenshots/screenshare, request/response examples, test results and errors resolved for this story.

### FE-06 — Zone management — per-camera zone definitions and capacity

**Issue type:** Story  
**Suggested priority:** High  
**Component:** Management  
**Dependencies:** FE-05  

**Description**  
Implement /cameras/:cameraId/zones. External Zone IDs are scoped to the selected camera and are configured before MQTT ingestion.

**Endpoints / integrations**

- `GET /cameras/{id}`
- `GET /cameras/{cameraId}/zones`
- `GET /zones/{id}`
- `POST /cameras/{cameraId}/zones`
- `PUT /zones/{id}`
- `PATCH /zones/{id}/status`

**Acceptance Criteria**
1. Breadcrumb Site > Camera > Zones and camera external ID clearly visible.
2. List externalZoneId, name, capacity, warning/critical threshold, status.
3. Create form externalZoneId/name/description/capacity/thresholds; capacity nullable.
4. If capacity is null display “Not configured” and do not show utilization %.
5. Prevent duplicate Zone IDs for one camera; identical zone_01 under another camera is valid.
6. Edit and status toggle enforce rowVersion; warnings and critical thresholds ordered.
7. No automatic zone creation from unknown MQTT messages.

**QA evidence:** screenshots/screenshare, request/response examples, test results and errors resolved for this story.

### FE-07 — Overview dashboard — business KPIs and site health

**Issue type:** Story  
**Suggested priority:** Highest  
**Component:** Dashboard  
**Dependencies:** FE-06, FE-10, FE-11  

**Description**  
Implement / landing dashboard answering what is happening at the site: monitoring health, selected live-scoped occupancy and historical ranking highlights.

**Endpoints / integrations**

- `GET /sites`
- `GET /sites/{siteId}/live`
- `GET /monitoring/status`
- `GET /analytics/overview`
- `GET /analytics/occupancy`

**Acceptance Criteria**
1. Site selector and report source filter; default reporting source=live.
2. KPI cards: registered/fresh/stale/no-recent cameras, monitored zone occupancy (label non-unique), mostVisitedZone, topEntryZone, mostCrowdedZone, peakOccupancy, longestActiveStay, estimatedHistoricalDwell.
3. Historical KPI cards consume /analytics/overview with explicit filter; do not confuse reported cumulative counters with period arrivals.
4. Show a 12/24-hour overview chart with data-quality coverage.
5. No-site, no-camera, no-reading, expired data and API failure have distinct UI.
6. Live metrics updated by SignalR with periodic REST sync; no invented default values.

**QA evidence:** screenshots/screenshare, request/response examples, test results and errors resolved for this story.

### FE-08 — Live monitoring — site-wide cameras and zone cards

**Issue type:** Story  
**Suggested priority:** Highest  
**Component:** Live Monitoring  
**Dependencies:** FE-05, FE-10  

**Description**  
Implement /live, grouped by site and camera. Focus on current camera status and latest persisted metrics, not playback of video.

**Endpoints / integrations**

- `GET /sites`
- `GET /sites/{siteId}/live`
- `GET /monitoring/status`
- `GET /cameras/{cameraId}/live`

**Acceptance Criteria**
1. Display camera name, external ID, analyticsStatus, sourceType, processingFps, staffCount, lastReceivedAtUtc, lastSequence, dataFreshness.
2. For each Zone: occupancy, arrivals/departures, entry/exit, wrongWayIn/out, activeVisitorsCount, reportedAverageDwellSeconds, longestActiveDwellSeconds, utilization and capacityStatus.
3. “Never received” shows placeholders, not zero. “Stale/NoRecentData” retains last values with explicit last-seen timestamp.
4. Show older-session badge for previousSession zones; no stale values represented as live.
5. Search/filter cameras; deep link to /live/:cameraId.
6. Subscription and REST sync work with multiple cameras.

**QA evidence:** screenshots/screenshare, request/response examples, test results and errors resolved for this story.

### FE-09 — Camera detail & zone live inspection

**Issue type:** Story  
**Suggested priority:** High  
**Component:** Live Monitoring  
**Dependencies:** FE-08  

**Description**  
Implement /live/:cameraId drilldown and individual zone details in route/drawer. Display data origin, occupancy and per-zone status.

**Endpoints / integrations**

- `GET /cameras/{cameraId}`
- `GET /cameras/{cameraId}/live`
- `GET /zones/{zoneId}/live`
- `GET /analytics/zones/{zoneId}/summary`
- `GET /analytics/zones/{zoneId}/timeseries`

**Acceptance Criteria**
1. Camera header with source video_file/live, current session ID, sequence, latest timestamp, freshness; no assumption that video_file represents real event time.
2. Zone cards show nullable values distinctly and capacity status when available.
3. Zone detail displays source IDs, last updated, current counters and times; link to analytics filtered by zone.
4. View live refreshes without reload and respects sessionId + stateVersion ordering.
5. Disabling a zone or camera appears clearly and does not erase history.

**QA evidence:** screenshots/screenshare, request/response examples, test results and errors resolved for this story.

### FE-10 — SignalR hub connection, scoped groups and reconnection

**Issue type:** Story  
**Suggested priority:** Highest  
**Component:** Realtime  
**Dependencies:** FE-03  

**Description**  
Connect to /hubs/analytics, subscribe by site or camera, merge versioned events into state and resynchronize after reconnection.

**Endpoints / integrations**

- `Hub /hubs/analytics`
- `GET /sites/{siteId}/live`
- `GET /cameras/{cameraId}/live`
- `GET /monitoring/status`

**Acceptance Criteria**
1. Hub methods SubscribeToSite, UnsubscribeFromSite, SubscribeToCamera, UnsubscribeFromCamera called with internal GUIDs.
2. Listen to CameraSnapshotUpdated, ZoneMetricsUpdated, CameraStatusChanged, AnalyticsSummaryUpdated.
3. Reject older events via stateVersion and invalid sessionId (for zone events); never replace new REST data with stale event.
4. After reconnect resubscribe and re-fetch current state via REST.
5. Gracefully handle signalREnabled=false: show polling mode, keep REST functional.
6. Properly clean up subscriptions on navigation and component destroy.
7. Do not place SignalR events in durable local storage.

**QA evidence:** screenshots/screenshare, request/response examples, test results and errors resolved for this story.

### FE-11 — Global analytics filter bar & time-basis UX

**Issue type:** Story  
**Suggested priority:** Highest  
**Component:** Analytics Foundation  
**Dependencies:** FE-03  

**Description**  
Implement reusable filter for site/camera/zone, interval, sourceType and either real date range or video session-relative time.

**Endpoints / integrations**

- `GET /sites`
- `GET /cameras`
- `GET /cameras/{cameraId}/zones`
- `GET /analytics/sessions`
- `All GET /analytics/* report operations`

**Acceptance Criteria**
1. Cascading site -> camera -> zone dropdowns; clear invalid child selection.
2. For sourceType=live send from/to ISO 8601 timestamps with offset and interval minute/hour/day; treat range as [from,to).
3. For video_file require selected session ID and use fromSourceTimeMs/toSourceTimeMs, not from/to.
4. Respect 7-day minute and 90-day hour/day default limits, server config may change.
5. Show selected site time-zone and report Period.timeBasis/timeZoneId labels.
6. Explicit Apply Filters action with loading/disable state; clear validation errors.
7. Do not fetch video_file without sessionId and do not call live reports with source-time params.

**QA evidence:** screenshots/screenshare, request/response examples, test results and errors resolved for this story.

### FE-12 — Zone rankings and single-zone analytical drilldown

**Issue type:** Story  
**Suggested priority:** High  
**Component:** Analytics  
**Dependencies:** FE-11  

**Description**  
Build rankings tab, metric switcher and zone summary/timeseries drilldown.

**Endpoints / integrations**

- `GET /analytics/zones/rankings`
- `GET /analytics/zones/{zoneId}/summary`
- `GET /analytics/zones/{zoneId}/timeseries`

**Acceptance Criteria**
1. Ranking metric options: arrivals, entries, departures, exits, averageOccupancy, peakOccupancy, utilization, reportedAverageDwell, estimatedAverageDwell, longestActiveDwell, wrongWayEvents.
2. List rank, zone, value, unit, quality, sample/coverage metadata and source filter.
3. Differentiate Most Visited (arrivals) from Top Entry (entries).
4. Click zone to open summary and timeseries; chart uses periods and nullable values.
5. No misleading “winner” when missing data; show insufficient data.
6. Reported average dwell is latest matching reported sample, NOT a valid weighted historical average.

**QA evidence:** screenshots/screenshare, request/response examples, test results and errors resolved for this story.

### FE-13 — Occupancy, utilization and peak-hours analytics

**Issue type:** Story  
**Suggested priority:** High  
**Component:** Analytics  
**Dependencies:** FE-11  

**Description**  
Build occupancy charts, peak cards, busiest-by-occupancy report and capacity utilization.

**Endpoints / integrations**

- `GET /analytics/occupancy`
- `GET /analytics/peak-hours`
- `GET /analytics/occupancy/utilization`
- `GET /analytics/zones/rankings`

**Acceptance Criteria**
1. Display averageOccupancy, peakOccupancy, peakAtUtc or peakAtSourceTimeMs, peakHour, capacity and peakUtilizationPercent.
2. Plot time-series where each bucket shows average occupancy and peak, with dataQuality.coveragePercent.
3. Treat Peak Hour as highest time-weighted average occupancy in eligible hour, not max single sample.
4. Show average occupancy ranking separately from peak occupancy and utilization.
5. If no capacity show N/A; >100% utilization valid.
6. Gaps must not be plotted as zero; tooltip shows coverage and quality.
7. Video session charts label source time, not clock time.

**QA evidence:** screenshots/screenshare, request/response examples, test results and errors resolved for this story.

### FE-14 — Traffic analytics, trend charts and counter interpretation

**Issue type:** Story  
**Suggested priority:** High  
**Component:** Analytics  
**Dependencies:** FE-11  

**Description**  
Build detailed traffic analysis for arrivals, departures, entry, exit, wrong-way counts by period.

**Endpoints / integrations**

- `GET /analytics/traffic`
- `GET /analytics/traffic/trends`
- `GET /analytics/zones/rankings`

**Acceptance Criteria**
1. Use server TrafficTotals fields arrivals, departures, entries, exits, wrongWayIn, wrongWayOut and wrongWayEvents.
2. Separate “Zone Arrivals” from “Gate Entries”; do not treat them as synonyms.
3. Do not sum cumulative counter snapshots in the browser. Display API-derived period deltas.
4. Date trends use /analytics/traffic/trends; export not required without dedicated API/approval.
5. Show counter reset, baselineCount, gapCount and coverage as quality explanation.
6. Zero is a valid no-new-event count; null/InsufficientData means unknown.

**QA evidence:** screenshots/screenshare, request/response examples, test results and errors resolved for this story.

### FE-15 — Dwell analytics and estimated-visit disclosure

**Issue type:** Story  
**Suggested priority:** High  
**Component:** Analytics  
**Dependencies:** FE-11  

**Description**  
Implement dwell dashboard with strict source vs estimate distinction.

**Endpoints / integrations**

- `GET /analytics/dwell`
- `GET /analytics/dwell/rankings`
- `GET /analytics/zones/{zoneId}/summary`

**Acceptance Criteria**
1. Show reportedAverageDwellSeconds, longestActiveDwellSeconds, estimatedCompletedVisits, estimatedTotalDwellSeconds, estimatedHistoricalAverageDwellSeconds, uncertainVisits.
2. Use badges Reported/Estimated/InsufficientData.
3. Avoid “unique visitors” or “confirmed exits” claims; values are camera-scoped track estimates.
4. Estimated average N/A if visits=0 and server returns null.
5. Support dwell rankings by reportedAverageDwell, estimatedAverageDwell and longestActiveDwell.
6. Explain dwell from active tracks may be incomplete due to occlusion and loop/session transitions.

**QA evidence:** screenshots/screenshare, request/response examples, test results and errors resolved for this story.

### FE-16 — Wrong-way movement and staff analytics

**Issue type:** Story  
**Suggested priority:** Medium  
**Component:** Analytics  
**Dependencies:** FE-11  

**Description**  
Build Wrong-way tab and Staff presence tab.

**Endpoints / integrations**

- `GET /analytics/wrong-way`
- `GET /analytics/staff`

**Acceptance Criteria**
1. Wrong-way: show wrongWayIn, wrongWayOut and wrongWayEvents totals, peak zone and per-zone trends.
2. Do not claim violation percentages without a confirmed denominator.
3. Staff: show camera latestStaffCount, lastReceivedAtUtc, averageStaffCount, peakStaffCount and series.
4. Do not add staff counts across overlapping cameras as distinct employees.
5. Support site/camera/date filters and empty states.
6. No alerts CRUD or full Alerts Center; explicitly out of scope.

**QA evidence:** screenshots/screenshare, request/response examples, test results and errors resolved for this story.

### FE-17 — Analytics sessions list with filters

**Issue type:** Story  
**Suggested priority:** High  
**Component:** Sessions  
**Dependencies:** FE-03  

**Description**  
Implement /sessions with sourceType/site/camera filters and pagination.

**Endpoints / integrations**

- `GET /analytics/sessions`
- `GET /analytics/sessions/{id}`
- `GET /sites`
- `GET /cameras`

**Acceptance Criteria**
1. List cameraName, externalSessionId, sourceType, sourceName, status, firstSequence, lastSequence, firstSourceTimeMs, lastSourceTimeMs, startedAtUtc, lastReceivedAtUtc, endedAtUtc.
2. Provide text search on sourceName/externalSessionId and server pagination.
3. Make source type clear (video_file vs live).
4. Click row opens /sessions/:id.
5. Session status ended should not be presented as camera malfunction.

**QA evidence:** screenshots/screenshare, request/response examples, test results and errors resolved for this story.

### FE-18 — Session report — recorded-video source-time visualizations

**Issue type:** Story  
**Suggested priority:** Highest  
**Component:** Sessions  
**Dependencies:** FE-17  

**Description**  
Build /sessions/:id page using session report and per-session analytics. For video_file present timeline positions, not wall-clock recordings.

**Endpoints / integrations**

- `GET /analytics/sessions/{id}`
- `GET /analytics/sessions/{id}/report`
- `GET /analytics/zones/{zoneId}/timeseries (sessionId, sourceType=video_file)`

**Acceptance Criteria**
1. Show session metadata and video source name without implying the video file is available to stream.
2. Display source-relative occupancy/traffic graphs, peakAtSourceTimeMs and missing-position count untimedVideoObservations.
3. Use video_file + sessionId and source-time bounds; never send from/to for these reports.
4. Allow minute/hour/day interval and session time-range controls within API limits.
5. Staff report nested under session.staff; show quality indicators.
6. Clearly note recurring video loops can affect analytics until backend loop semantics are addressed; do not invent deduplicated visit counts.

**QA evidence:** screenshots/screenshare, request/response examples, test results and errors resolved for this story.

### FE-19 — System availability and MQTT monitoring status

**Issue type:** Story  
**Suggested priority:** Medium  
**Component:** Operations  
**Dependencies:** FE-03  

**Description**  
Add compact status header/operations view for backend health, readiness and MQTT subscription. This is NOT the deferred detailed diagnostics dashboard.

**Endpoints / integrations**

- `GET /monitoring/status`
- `GET /health/live`
- `GET /health/ready`

**Acceptance Criteria**
1. Display /monitoring/status registeredCameras, activeCameras, fresh, stale, noRecentData, neverReceived, ended, mqttEnabled and mqttSubscribed.
2. Liveness and readiness are separate; 503 readiness is surfaced as backend not ready; 200 degraded MQTT reported as degraded.
3. Show last checked and actionable connection trouble text.
4. Do not render broker passwords, raw MQTT payloads or internal connection strings.

**QA evidence:** screenshots/screenshare, request/response examples, test results and errors resolved for this story.

### FE-20 — Data quality, temporal provenance and cross-camera truthfulness

**Issue type:** Story  
**Suggested priority:** Highest  
**Component:** Cross-cutting  
**Dependencies:** FE-07  

**Description**  
Implement reusable quality badges/tooltips and enforce semantic accuracy across all pages. Backend calculates KPIs; browser formats and explains them.

**Endpoints / integrations**

- `GET /analytics/overview`
- `All analytics reports`
- `GET /cameras/{cameraId}/live`

**Acceptance Criteria**
1. Show Reported/Derived/Estimated/InsufficientData with coveragePercent, sampleCount, observationDurationSeconds, counterResetCount, baselineCount, gapCount.
2. Never call total zone occupancy “unique visitors”; cross-camera overlap is unknown.
3. Never interpret video playback timestamp as actual venue clock time.
4. Use N/A for null, not zero. Show “Latest observation” vs historic period correctly.
5. Warn on low coverage and partially observed periods; do not make misleading comparisons.
6. Never use unverified_losses, video_loop or totals in frontend claims unless backend exposes validated corresponding API fields.

**QA evidence:** screenshots/screenshare, request/response examples, test results and errors resolved for this story.

### FE-21 — Responsive accessibility, performance and production UX

**Issue type:** Story  
**Suggested priority:** Medium  
**Component:** Cross-cutting  
**Dependencies:** FE-02  

**Description**  
Improve UI to work on desktop/tablet/mobile, with readable charts and stable high-frequency rendering.

**Endpoints / integrations**

- No new backend endpoints; cross-cutting work.

**Acceptance Criteria**
1. Responsive breakpoints and collapsible sidebar on mobile; avoid horizontal overflow except explicit scrollable data tables.
2. Keyboard accessible actions, focus states, semantic form labels and dialogs.
3. Charts have accessible labels and supporting table/text interpretation.
4. Use chart aggregation and throttling where necessary; avoid repainting every component for every 1-second message.
5. Clear and consistent loading/empty/error/success states and contrast-safe status indicators.

**QA evidence:** screenshots/screenshare, request/response examples, test results and errors resolved for this story.

### FE-22 — Frontend unit/component/service tests

**Issue type:** Story  
**Suggested priority:** High  
**Component:** QA  
**Dependencies:** FE-03  

**Description**  
Write meaningful Angular tests around API URL/query mapping, error states, forms, signalR state and report semantics.

**Endpoints / integrations**

- No new backend endpoints; cross-cutting work.

**Acceptance Criteria**
1. Test API contracts/mapping and pagination.
2. Test Forms for required fields and rowVersion submission.
3. Test stale event ignored when stateVersion lower; session mismatch ignored.
4. Test reconnect: re-subscribe and REST resync.
5. Test video_file filter excludes from/to and includes session/source-time.
6. Test empty/low-coverage/estimated labels and error UI.
7. All frontend tests pass locally and are runnable from README.

**QA evidence:** screenshots/screenshare, request/response examples, test results and errors resolved for this story.

### FE-23 — Frontend E2E integration and handoff with live MQTT-backed backend

**Issue type:** Story  
**Suggested priority:** Highest  
**Component:** QA  
**Dependencies:** FE-22  

**Description**  
Verify actual flow from registered Camera and Zones through MQTT -> SQL -> REST/SignalR -> Angular. Use backend sample publisher when external AI unavailable.

**Endpoints / integrations**

- `GET /sites/{siteId}/live`
- `GET /analytics/overview`
- `GET /analytics/sessions/{id}/report`
- `SignalR /hubs/analytics`

**Acceptance Criteria**
1. Site Main Mall created and camera external IDs cam1 and 2 mapped (not GUIDs).
2. cam1 zone_01; camera 2 zone_01 and zone_02 visible; duplicate zone IDs across cameras allowed.
3. New MQTT messages update live cards and sequence automatically.
4. Unregistered camera or zone does not fabricate UI rows.
5. Historical chart/ranking displays actual API values.
6. Simulate lost SignalR connection and verify recovery.
7. Document any integration failures separately from implemented UI features.

**QA evidence:** screenshots/screenshare, request/response examples, test results and errors resolved for this story.

### FE-24 — Frontend README, API mapping and QA release checklist

**Issue type:** Story  
**Suggested priority:** Medium  
**Component:** Documentation  
**Dependencies:** FE-23  

**Description**  
Deliver frontend setup, environment config, feature docs, API mapping, QA evidence and known backend caveats.

**Endpoints / integrations**

- No new backend endpoints; cross-cutting work.

**Acceptance Criteria**
1. Document Node/Angular requirements and npm scripts.
2. Document /public/config.json runtime settings and CORS setup.
3. Document route to endpoint mapping and Hub method/event subscriptions.
4. Document backend run command and DB/MQTT demo prerequisites.
5. Provide screenshots or QA evidence for desktop and mobile.
6. List backend open items: video_loop handling and additional AI telemetry exposure, plus coverage threshold consistency.

**QA evidence:** screenshots/screenshare, request/response examples, test results and errors resolved for this story.

## Documentation sources / links

- [GitHub repo](https://github.com/LoaiSaberC4r/AI_Analytical)
- [Existing backend API contract](https://github.com/LoaiSaberC4r/AI_Analytical/blob/master/docs/api-contract.md)
- [Actual AnalyticsController](https://github.com/LoaiSaberC4r/AI_Analytical/blob/master/src/CameraAnalytics.Api/Controllers/AnalyticsController.cs)
- [Actual CatalogController](https://github.com/LoaiSaberC4r/AI_Analytical/blob/master/src/CameraAnalytics.Api/Controllers/CatalogController.cs)
- [Actual MonitoringController](https://github.com/LoaiSaberC4r/AI_Analytical/blob/master/src/CameraAnalytics.Api/Controllers/MonitoringController.cs)
- [Response DTO definitions](https://github.com/LoaiSaberC4r/AI_Analytical/blob/master/src/CameraAnalytics.Application/Abstractions/Reports.cs)
- [Live monitoring DTOs](https://github.com/LoaiSaberC4r/AI_Analytical/blob/master/src/CameraAnalytics.Application/Abstractions/Monitoring.cs)
- [SignalR Hub implementation](https://github.com/LoaiSaberC4r/AI_Analytical/blob/master/src/CameraAnalytics.Api/Hubs/AnalyticsHub.cs)
- [Existing frontend models](https://github.com/LoaiSaberC4r/AI_Analytical/blob/master/frontend/camera-analytics-web/src/app/core/models/models.ts)
- [Backend analytics definitions](https://github.com/LoaiSaberC4r/AI_Analytical/blob/master/docs/analytics-definitions.md)

**Source of truth for contract at implementation time:** running `/swagger/v1/swagger.json`, plus the current backend DTO source code. This document reflects the inspected `master` snapshot; backend changes after this date require contract review.
