# Frontend delivery and QA evidence

This workspace now extends the original 37-operation frontend with the verified smart analytics PR contracts. The supplied 60-story document is a delivery target, not evidence that all acceptance criteria have passed. See [SMART_INTEGRATION.md](SMART_INTEGRATION.md) and the complete [API_COVERAGE.md](API_COVERAGE.md).

## Implemented and source-reviewed

- Existing Angular 21 app retained, with lazy resource, setup, health, analytics, floor and alert routes.
- 63 of the handoff's 65 operations have frontend consumers: 37 baseline plus 26 typed PR operations.
- Smart quality/provenance, null/zero distinctions, video loop/source-time filters and eight visualization types.
- Versioned floor metadata, activation, polygon editing, keyboard coordinates, pointer dragging, layout deletion and measured heatmaps.
- Alerts, evidence, acknowledgement, disabled-rule resolution, rule forms, immutable scope and optimistic concurrency.
- Optional external OIDC authorization code/PKCE, token renewal/session handling, REST/hub token delivery and role/site-aware controls.
- Fifth SignalR event: ordered/coalesced alert invalidations, REST refresh, reconnect resubscription, polling and cleanup.
- IIS SPA fallback and no-store runtime config supplied, without deployment.

Setup reuses the existing registry editors through a guided setup page. Zone analytics routes provide resource/live inspection and filtered links to the existing historical reports. Comparison/forecast pages are not invented for unexposed endpoints.

## Executed checks

- `npm run build`: PASS. Production initial assets are 636.13 kB raw / 140.66 kB estimated transfer, below the existing 650 kB warning budget. The OIDC client is a separate lazy chunk.
- `npm test -- --watch=false`: PASS, 44 tests across 13 files. Includes typed requests, concurrency, role/site restrictions, token origin boundaries, geometry, signed/gapped chart data and ordered alert invalidations/reconnect cleanup.
- `npm run test:e2e`: PASS, 34 checks across desktop (1440x1000) and mobile (390x844), with two intentional viewport-specific skips. Covers original workflows, Arabic/English regression, new route layouts, reader permissions, floor conflict recovery, versioned polygons, rule scope and acknowledgement persistence.
- `npm run typecheck:e2e`: PASS.
- `python .agents/validate_agent.py`: PASS for project instruction/manifest/reference structure; does not verify external connectivity.
- `git diff --check`: PASS.

Browser suites use synthetic fixtures from `e2e/fixtures.ts` and `e2e/smart-fixtures.ts`, not the configured LAN backend. Screenshots are generated under `artifacts/`, including desktop/mobile overview and floor heatmap views. Desktop and mobile heatmap output was visually inspected. Browser reports and traces remain ignored local output.

## Blocked or not run

- On 2026-11-18 read-only probes returned HTTP 500 from configured LAN Swagger, health/live, health/ready, sites and smart FPS visualization. Earlier successful baseline LAN connectivity does not establish current availability.
- Backend PR #1 was open/unmerged when inspected. The deployed commit and live Swagger schema cannot currently be verified.
- `/analytics/comparisons` and `/analytics/forecast` are absent from PR HTTP controllers and Program.cs, despite being listed in the handoff. Internal algorithms/DTOs do not establish callable APIs. FE-045/046 remain blocked on a verified contract.
- Actual identity-provider discovery/login/logout/renewal needs deployment-specific Authority, SPA Client ID, scopes/audience and callback registration. Role tests use synthetic JWT claims and do not validate a real identity server.
- Real MQTT -> SQL -> REST/SignalR UAT, durable congestion/alert recovery, video-loop data correctness and sustained load are not verified. The real-backend suite was not run against the failing server.
- IIS deployment, CORS/WebSocket validation on the release host, manual screen-reader testing and release sign-off were not performed.
- `npm ci` was not rerun during this change. The lockfile was updated by the OIDC dependency installation; no forced dependency/framework upgrades were applied.

No backend records, broker messages, Jira issues or deployment state were mutated during this implementation.
