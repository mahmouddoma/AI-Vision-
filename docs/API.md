# API integration map

All REST paths below are relative to runtime `apiBaseUrl`. The hub URL is separate from that REST prefix. Contracts were compared with current backend `Catalog.cs`, `Monitoring.cs`, `Reports.cs`, `AnalyticsController.cs`, `CatalogController.cs`, `AnalyticsHub.cs` and `HealthRoutes.cs` through the connected GitHub source. Runtime Swagger comparison remains pending until the backend is available.

| Frontend route                 | REST operations                                                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                            | GET sites, monitoring/status, sites/{id}/live, analytics/overview, analytics/occupancy                                                 |
| `/sites`                       | GET sites, GET sites/{id}, POST sites, PUT sites/{id}, PATCH sites/{id}/status                                                         |
| `/cameras`                     | GET sites, GET cameras, GET cameras/{id}, POST cameras, PUT cameras/{id}, PATCH cameras/{id}/status                                    |
| `/cameras/:cameraId/zones`     | GET cameras/{id}, GET cameras/{cameraId}/zones, GET zones/{id}, POST cameras/{cameraId}/zones, PUT zones/{id}, PATCH zones/{id}/status |
| `/live`                        | GET sites, sites/{siteId}/live, monitoring/status; scoped site hub updates                                                             |
| `/live/:cameraId`              | GET cameras/{cameraId}/live; scoped camera hub updates                                                                                 |
| Zone inspection dialog         | GET zones/{id}/live; link to zone-filtered analytics                                                                                   |
| `/analytics` rankings          | GET analytics/zones/rankings, analytics/zones/{id}/summary, analytics/zones/{id}/timeseries                                            |
| `/analytics` occupancy         | GET analytics/occupancy, analytics/peak-hours, analytics/occupancy/utilization                                                         |
| `/analytics` traffic           | GET analytics/traffic, analytics/traffic/trends                                                                                        |
| `/analytics` dwell             | GET analytics/dwell, analytics/dwell/rankings                                                                                          |
| `/analytics` wrong-way / staff | GET analytics/wrong-way, analytics/staff                                                                                               |
| `/sessions`                    | GET analytics/sessions, sites, cameras                                                                                                 |
| `/sessions/:id`                | GET analytics/sessions/{id}, analytics/sessions/{id}/report                                                                            |
| System status dialog           | GET health/live, health/ready, monitoring/status                                                                                       |

Together these cover the supplied inventory of 37 REST operations. Lookup requests use the same list endpoints, retrieving all pages rather than truncating dropdowns at 100 records. Visible registry and session lists use server pagination/search. No DELETE, playback, Alerts CRUD, user-management, login or unsupported telemetry endpoint is invented.

## HTTP behavior

`core/api.ts` owns URL construction, query omission and a 15-second request timeout. `core/models.ts` owns camelCase DTOs. Catalog writes preserve string external IDs and send Base64 `rowVersion` on updates and status changes. Status patch accepts 204 and reloads the list. IDs used in route paths are internal GUIDs; external `cam1`, `2`, and zone identifiers remain case-sensitive strings.

400 shows validation details, 404 explains a missing record, 409 retains edits with a reload action, and 500 hides backend internals. ProblemDetails trace references and field errors remain visible for support. Global site context loads all site pages; changing it cancels prior scoped requests through `switchMap`.

## Report semantics

- Live filters send UTC ISO `from` and `to`, interval minute/hour/day and a half-open range. Date controls explicitly identify the browser time zone; report displays use the server's `period.timeZoneId`.
- Video filters require `sourceType=video_file` and `sessionId`. Only source-position bounds in milliseconds are sent; clock `from/to` are removed centrally.
- Default live range limits are 7 days for minute and 90 for hour/day. The backend may impose different configured limits and its errors are displayed. Position ranges are checked for valid ordering and non-negative integer milliseconds.
- Null is N/A, zero is a known value, and insufficient series buckets remain gaps. A lack of coverage is exposed rather than filled with zero.
- Occupancy across overlapping zones is not unique people. Gate entries differ from zone arrivals. Browser code never sums cumulative traffic snapshots into historical totals.
- Dwell estimates describe camera tracks, not confirmed visits across cameras. Reported average dwell is labelled as the latest reported sample. Video loops, occlusion and session transitions can affect estimates.

## Realtime

`core/realtime.ts` subscribes with internal GUIDs using `SubscribeToSite` or `SubscribeToCamera`. Leaving a view invokes the matching `UnsubscribeFromSite` / `UnsubscribeFromCamera` and stops its connection. It handles CameraSnapshotUpdated, ZoneMetricsUpdated, CameraStatusChanged and AnalyticsSummaryUpdated.

Camera/zone reducers reject duplicate or older stateVersion values. Zone events from a different camera session are ignored; unknown zones are not inserted. Event arrivals/departures map to zoneArrivals/zoneDepartures. New session snapshots mark old zone readings as previous-session observations. REST merges preserve newer event versions. Server-derived capacity metadata is refreshed with REST rather than guessed from partial events.

Reconnect resubscribes and requests a fresh REST snapshot. Polling stays available during loss of transport or when disabled by configuration; initial connection failures retry on polling ticks. Summary-driven REST requests are throttled to one window per two seconds, and overview reports to one per three seconds. Events never go into localStorage.

## Contract sources

- [Backend DTOs](https://github.com/LoaiSaberC4r/AI_Analytical/tree/master/src/CameraAnalytics.Application/Abstractions)
- [REST controllers](https://github.com/LoaiSaberC4r/AI_Analytical/tree/master/src/CameraAnalytics.Api/Controllers)
- [SignalR hub](https://github.com/LoaiSaberC4r/AI_Analytical/blob/master/src/CameraAnalytics.Api/Hubs/AnalyticsHub.cs)
- [Health routes](https://github.com/LoaiSaberC4r/AI_Analytical/blob/master/src/CameraAnalytics.Api/Extensions/HealthRoutes.cs)
