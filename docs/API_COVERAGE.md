# Handoff API coverage

Source: supplied 65-operation handoff, compared with backend PR #1 commit `528b8df`. **63 frontend consumers; 2 unexposed backend HTTP routes.** Static/source and fixture evidence only; live Swagger currently returns HTTP 500.

| # | Method | Path | Frontend consumer / status |
| --- | --- | --- | --- |
| 01 | GET | `/api/v1/sites` | Existing Catalog / resource inspection (`Api` with typed catalog DTOs) |
| 02 | POST | `/api/v1/sites` | Existing Catalog / resource inspection (`Api` with typed catalog DTOs) |
| 03 | GET | `/api/v1/sites/{id}` | Existing Catalog / resource inspection (`Api` with typed catalog DTOs) |
| 04 | PUT | `/api/v1/sites/{id}` | Existing Catalog / resource inspection (`Api` with typed catalog DTOs) |
| 05 | PATCH | `/api/v1/sites/{id}/status` | Existing Catalog / resource inspection (`Api` with typed catalog DTOs) |
| 06 | GET | `/api/v1/cameras` | Existing Catalog / resource inspection (`Api` with typed catalog DTOs) |
| 07 | POST | `/api/v1/cameras` | Existing Catalog / resource inspection (`Api` with typed catalog DTOs) |
| 08 | GET | `/api/v1/cameras/{id}` | Existing Catalog / resource inspection (`Api` with typed catalog DTOs) |
| 09 | PUT | `/api/v1/cameras/{id}` | Existing Catalog / resource inspection (`Api` with typed catalog DTOs) |
| 10 | PATCH | `/api/v1/cameras/{id}/status` | Existing Catalog / resource inspection (`Api` with typed catalog DTOs) |
| 11 | GET | `/api/v1/cameras/{cameraId}/zones` | Existing Catalog / resource inspection (`Api` with typed catalog DTOs) |
| 12 | POST | `/api/v1/cameras/{cameraId}/zones` | Existing Catalog / resource inspection (`Api` with typed catalog DTOs) |
| 13 | GET | `/api/v1/zones/{id}` | Existing Catalog / resource inspection (`Api` with typed catalog DTOs) |
| 14 | PUT | `/api/v1/zones/{id}` | Existing Catalog / resource inspection (`Api` with typed catalog DTOs) |
| 15 | PATCH | `/api/v1/zones/{id}/status` | Existing Catalog / resource inspection (`Api` with typed catalog DTOs) |
| 16 | GET | `/api/v1/sites/{siteId}/live` | Existing Overview / Live / AppContext |
| 17 | GET | `/api/v1/cameras/{cameraId}/live` | Existing Overview / Live / AppContext |
| 18 | GET | `/api/v1/zones/{zoneId}/live` | Existing Overview / Live / AppContext |
| 19 | GET | `/api/v1/monitoring/status` | Existing Overview / Live / AppContext |
| 20 | GET | `/api/v1/analytics/overview` | Existing Analytics / Overview (`Api.report` with typed report DTOs) |
| 21 | GET | `/api/v1/analytics/zones/rankings` | Existing Analytics / Overview (`Api.report` with typed report DTOs) |
| 22 | GET | `/api/v1/analytics/zones/{zoneId}/summary` | Existing Analytics / Overview (`Api.report` with typed report DTOs) |
| 23 | GET | `/api/v1/analytics/zones/{zoneId}/timeseries` | Existing Analytics / Overview (`Api.report` with typed report DTOs) |
| 24 | GET | `/api/v1/analytics/occupancy` | Existing Analytics / Overview (`Api.report` with typed report DTOs) |
| 25 | GET | `/api/v1/analytics/peak-hours` | Existing Analytics / Overview (`Api.report` with typed report DTOs) |
| 26 | GET | `/api/v1/analytics/occupancy/utilization` | Existing Analytics / Overview (`Api.report` with typed report DTOs) |
| 27 | GET | `/api/v1/analytics/traffic` | Existing Analytics / Overview (`Api.report` with typed report DTOs) |
| 28 | GET | `/api/v1/analytics/traffic/trends` | Existing Analytics / Overview (`Api.report` with typed report DTOs) |
| 29 | GET | `/api/v1/analytics/dwell` | Existing Analytics / Overview (`Api.report` with typed report DTOs) |
| 30 | GET | `/api/v1/analytics/dwell/rankings` | Existing Analytics / Overview (`Api.report` with typed report DTOs) |
| 31 | GET | `/api/v1/analytics/wrong-way` | Existing Analytics / Overview (`Api.report` with typed report DTOs) |
| 32 | GET | `/api/v1/analytics/staff` | Existing Analytics / Overview (`Api.report` with typed report DTOs) |
| 33 | GET | `/api/v1/analytics/sessions` | Existing Sessions / SessionDetail |
| 34 | GET | `/api/v1/analytics/sessions/{id}` | Existing Sessions / SessionDetail |
| 35 | GET | `/api/v1/analytics/sessions/{id}/report` | Existing Sessions / SessionDetail |
| 36 | GET | `/api/v1/health/live` | SystemStatus / SystemHealth |
| 37 | GET | `/api/v1/health/ready` | SystemStatus / SystemHealth |
| 38 | GET | `/api/v1/analytics/traffic/flow-rate` | `SmartApi.flow` |
| 39 | GET | `/api/v1/analytics/congestion` | `SmartApi.congestion` |
| 40 | GET | `/api/v1/analytics/congestion/history` | `SmartApi.congestionHistory` |
| 41 | GET | `/api/v1/analytics/dwell/distribution` | `SmartApi.dwell` |
| 42 | GET | `/api/v1/analytics/dwell/long-stay` | `SmartApi.dwell (longStay=true)` |
| 43 | GET | `/api/v1/analytics/quality` | `SmartApi.quality` |
| 44 | GET | `/api/v1/analytics/visualizations/{metricKey}` | `SmartApi.visualization` |
| 45 | GET | `/api/v1/analytics/insights` | `SmartApi.insights` |
| 46 | GET | `/api/v1/alerts` | `SmartApi.alerts` |
| 47 | GET | `/api/v1/alerts/{id}` | `SmartApi.alert` |
| 48 | POST | `/api/v1/alerts/{id}/acknowledge` | `SmartApi.alertAction (acknowledge)` |
| 49 | POST | `/api/v1/alerts/{id}/resolve` | `SmartApi.alertAction (resolve)` |
| 50 | GET | `/api/v1/alert-rules` | `SmartApi.rules` |
| 51 | POST | `/api/v1/alert-rules` | `SmartApi.saveRule (create)` |
| 52 | GET | `/api/v1/alert-rules/{id}` | `SmartApi.rule` |
| 53 | PUT | `/api/v1/alert-rules/{id}` | `SmartApi.saveRule (update)` |
| 54 | PATCH | `/api/v1/alert-rules/{id}/status` | `SmartApi.ruleStatus` |
| 55 | GET | `/api/v1/sites/{siteId}/floors` | `SmartApi.floors` |
| 56 | POST | `/api/v1/sites/{siteId}/floors` | `SmartApi.saveFloor (create)` |
| 57 | GET | `/api/v1/floors/{id}` | `SmartApi.floor` |
| 58 | PUT | `/api/v1/floors/{id}` | `SmartApi.saveFloor (update)` |
| 59 | PATCH | `/api/v1/floors/{id}/status` | `SmartApi.floorStatus` |
| 60 | GET | `/api/v1/floors/{id}/layouts` | `SmartApi.layouts` |
| 61 | PUT | `/api/v1/floors/{id}/zones/{zoneId}/layout` | `SmartApi.saveLayout` |
| 62 | DELETE | `/api/v1/floors/{id}/zones/{zoneId}/layout` | `SmartApi.deleteLayout` |
| 63 | GET | `/api/v1/analytics/heatmap` | `SmartApi.heatmap` |
| 64 | GET | `/api/v1/analytics/comparisons` | BLOCKED: no HTTP mapping in inspected controllers or Program.cs |
| 65 | GET | `/api/v1/analytics/forecast` | BLOCKED: no HTTP mapping in inspected controllers or Program.cs |

Contract-request tests: `src/app/core/smart-api.spec.ts`, existing `api.spec.ts`, catalog tests and browser fixtures. These prove frontend request construction, not backend execution. Full role/concurrency/SQL/MQTT UAT remains pending.
