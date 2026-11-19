# Smart analytics integration

The 60-story handoff is implemented in this existing Angular 21 workspace where the inspected backend exposes HTTP contracts. The framework and TypeScript versions were retained; no second Angular application was created. This document records integration boundaries rather than declaring all 60 stories complete.

## Backend revision and release blockers

Contracts were inspected through the connected GitHub repository at PR #1 commit `528b8df920d156d19860fd9b369b24e684f823c6`. The PR was open and unmerged when checked on 2026-11-18. The 37 baseline operations remain supported, and 26 additional operations have typed consumers in `src/app/core/smart-api.ts`.

Two operations in the supplied 65-operation inventory are **not HTTP endpoints in that revision**: `GET /analytics/comparisons` and `GET /analytics/forecast`. `PeriodComparison`, `HourlyForecast` and forecast DTOs exist internally, but neither the inspected controllers nor `Program.cs` maps these routes. No browser request, fabricated forecast, comparison result or placeholder success is supplied for them. FE-045 and FE-046 await a verified callable contract.

Read-only checks against the configured `http://192.168.1.8:8005` returned HTTP 500 for Swagger, liveness, readiness, the sites list and a smart visualization on 2026-11-18. Consequently runtime schema comparison, deployed branch identification, real JWT validation, SQL/MQTT ingestion, five-event SignalR delivery and full live UAT remain unverified. These failures do not establish whether the PR routes are deployed. No server data or configuration was changed.

## Frontend journeys

| Area | Routes and behavior |
| --- | --- |
| Setup | `/setup` composes links to the existing site/camera/zone editors, shows generated MQTT topics and guides health/live verification. It does not publish MQTT. |
| Resource inspection | `/sites/:id`, `/cameras/:id`, `/zones/:id`, `/live/zones/:id`, `/analytics/zones/:id`; registry details, live camera/zone observations and filtered historical links. |
| Health | `/system-health`, reusing the liveness/readiness/monitoring panel. |
| Analytics | Existing `/analytics` and six explicit legacy report routes; `/analytics/flow`, `/analytics/congestion`, `/analytics/distribution`, `/analytics/quality`, `/analytics/insights`. |
| Visualizations | Metric/type selection with line, area, grouped bar, signed bar, histogram, gauge and timeline renderers; floor heatmap is the eighth type. Exact data remains available in accessible tables. |
| Floors | `/floors` or `/sites/:siteId/floors`, `/floors/:id/editor`, `/floors/:id/heatmap`; versioned metadata/status, normalized polygons, pointer dragging, keyboard coordinate editing, versioned layout deletion and measured heatmaps. |
| Alerts | `/alerts`, `/alerts/:id`, `/alert-rules`, `/alert-rules/new`, `/alert-rules/:id/edit`; evidence/quality, acknowledgement, disabled-rule resolution, immutable rule scope and versioned updates/status. |
| Sessions | Existing session explorer and detail now send explicit numeric or `unmarked` video loops, retain source-time bounds and expose returned available loops. |

The setup screen deliberately reuses the existing mutation forms; it does not provide a separate persisted wizard state. Zone analytics deep links open resource inspection and link into the existing filtered analytics screen. These are frontend composition choices, not new APIs.

Smart reports require a session, a loop and both source-time bounds for video; live requests omit video loop/position parameters. Backend `MetricQuality` remains distinct from legacy `DataQuality`, including provenance, partial/stale flags, warning codes, resets and gaps. No KPI is recomputed from raw feeds. Insight cards have no persistence/dismiss action. Forecast/ML claims, raw video and floor image uploads remain absent.

## Authentication configuration

The existing `public/config.json` endpoints were preserved. When the backend requires identity, add an `auth` object containing only public client metadata:

```json
{
  "authority": "https://identity.example/your-issuer",
  "clientId": "your-registered-spa-client",
  "scope": "openid profile your-api-scope",
  "audience": "your-api-audience-if-required-by-the-provider"
}
```

Register `<frontend-origin>/auth/callback` as the redirect URI and `<frontend-origin>/auth` as the post-logout URI. The provider must support a public browser client, authorization code with PKCE, discovery/token CORS and the configured API audience. `audience` is optional and is sent as a provider authorization parameter; it is not a replacement for backend audience validation. Provider configuration and actual login were not available during implementation.

`oidc-client-ts` is loaded only for configured environments. It manages redirects, renewal and sign-out; OIDC state and the browser session are stored in sessionStorage, never in public configuration or localStorage. REST attaches the current token only under the configured API prefix; SignalR obtains it through `accessTokenFactory`. A 401 offers sign-in; a 403 remains a permission error. JWT role/site claims control UI capabilities only: the backend must validate the token and enforce every operation.

When `auth` is absent, the existing development/demo behavior remains available. This does not disable backend security. Secure deployments must configure `auth`; do not use missing frontend metadata as proof that a production API is public.

The inspected backend reserves catalog, monitoring and legacy reports for `AnalyticsAdministrator`. Reader/operator views use `site_id` claims for site selection without making unauthorized catalog requests. Because the backend has no reader-scoped catalog lookup, these users can enter known camera/zone/session GUIDs into applicable smart filters/forms. Operators can mutate only claimed sites; readers receive read-only controls. Administrator lookup selectors retain catalog names.

## Realtime and concurrency

`Realtime.watchAlertChanges` handles the fifth event, `AnalyticsAlertChanged`, without fetching admin-only live snapshots. It ignores other sites and duplicate/older per-alert state versions, coalesces notifications, resubscribes and invalidates REST data after reconnect, polls when the transport is unavailable, and unsubscribes/stops on route or site changes. It never treats an event as the complete alert record.

Floor/rule updates preserve Base64 `rowVersion`; layout DELETE sends it as a query parameter. A 409 keeps the edited form and blocks resubmission until reload. Rule status PATCH returns the updated rule; floor status PATCH accepts 204. Active-rule alerts offer acknowledgement and explain automatic observed recovery; manual resolve is exposed when the fetched rule is disabled and remains subject to backend 409 enforcement.

## Verification and hosting

See [QA.md](QA.md) for executed checks and [API_COVERAGE.md](API_COVERAGE.md) for every handoff operation. Browser fixtures are synthetic and isolated from the configured LAN server.

Build with `npm ci` and `npm run build`, then serve `dist/AI-Vision/browser`. `public/web.config` includes IIS URL Rewrite SPA fallback and no-store configuration delivery. IIS must have the URL Rewrite module and static-content support installed. Keep the API independently hosted, configure its exact allowed frontend origins, use HTTPS for API/hub/identity, and register the deployed OIDC callback. Validate deep-link reloads, configuration responses, authenticated requests and secure WebSockets on the actual IIS host; IIS deployment was not performed.
