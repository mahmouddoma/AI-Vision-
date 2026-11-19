# AI Vision - Camera Analytics

Angular 21 standalone frontend for site/camera/zone management, live observations, smart analytics, alerts/rules, normalized floor polygons, measured heatmaps and loop-aware video session reports. The UI uses Bootstrap Reboot/Grid, shared design tokens and locally bundled Font Awesome SVG icons. It displays actual API responses; synthetic data exists only in automated tests.

## Run

Use Node compatible with the locked Angular 21 toolchain (Node 20.19+, 22.12+ or 24+), and npm. This checkout was verified with Node 24.12.0 and npm 11.12.1.

```sh
npm ci
npm start
```

Open http://localhost:4200. The backend must separately allow this exact origin through CORS. Production output goes to `dist/AI-Vision/browser`; configure the web server to serve `index.html` for application routes.

## Runtime configuration

Edit [public/config.json](public/config.json) without rebuilding. Angular copies that file to `/config.json` (not `/public/config.json`) in the served application. It loads uncached before bootstrap; a missing or invalid file produces a recovery screen.

| Setting                  | Purpose                                                                     |
| ------------------------ | --------------------------------------------------------------------------- |
| `apiBaseUrl`             | API root, configured as `http://192.168.1.8:8005/api/v1`                    |
| `hubPath`                | Absolute hub URL or backend-origin-relative path, default `/hubs/analytics` |
| `signalREnabled`         | Enable realtime; false keeps configurable REST polling                      |
| `refreshIntervalSeconds` | REST synchronization interval, 5-3600 seconds                               |
| `auth`                   | Optional public OIDC metadata; see [smart integration](docs/SMART_INTEGRATION.md) |

Use `http://localhost:4200` for local development: the configured backend currently allows this origin through CORS, while `http://127.0.0.1:4200` is not allowed.

Keep credentials, SQL connection strings, backend appsettings and MQTT passwords out of this public file.

## Verification

```sh
npm run build
npm test -- --watch=false
npm run test:e2e
npm run typecheck:e2e
```

Browser tests use locally installed Google Chrome and clearly named synthetic API fixtures. They do not contact or validate the real backend. Install Chrome or adapt the `channel` in `playwright.config.ts` to your available browser. Playwright starts the frontend if needed. Reports are generated in `playwright-report/`, traces in `test-results/`, screenshots in `artifacts/`; all are ignored by Git.

Run `npm run test:e2e:live` only after preparing the real SQL/MQTT environment and publishers described in [docs/INTEGRATION.md](docs/INTEGRATION.md). This separate suite does not mock responses. On 2026-11-18 the configured LAN server returned HTTP 500 for Swagger, health and sites; publisher-backed and protected-environment validation remains pending. The handoff's Angular 22 target was assessed against this existing Angular 21 workspace; the existing supported standalone architecture was reused without a framework upgrade.

## Project map

- `src/app/core/`: runtime configuration, typed contracts, HTTP client, site context, realtime lifecycle, metric formatting.
- `src/app/ui/`: reusable icons, metrics, status, quality, dialogs, feedback, tables, pagination and accessible charts.
- `src/app/features/`: lazy overview, registry, live, analytics and session routes.
- [docs/API.md](docs/API.md): route/endpoint map and data semantics.
- [docs/SMART_INTEGRATION.md](docs/SMART_INTEGRATION.md): PR contract baseline, authentication setup, feature journeys and deployment.
- [docs/API_COVERAGE.md](docs/API_COVERAGE.md): all 65 supplied operations, 63 frontend consumers and two unexposed backend routes.
- [docs/QA.md](docs/QA.md): story coverage, executed checks and release blockers.
- [DESIGN.md](DESIGN.md): tokens, component conventions and UX blueprint.
- [docs/JIRA_HANDOFF.md](docs/JIRA_HANDOFF.md): supplied proposed Jira backlog, retained as reference. No Jira issues were created or transitioned.

Project agent rules live in [AGENTS.md](AGENTS.md); optional skill setup is documented in [.agents/INSTALL.md](.agents/INSTALL.md). Validate it with `python .agents/validate_agent.py`.
