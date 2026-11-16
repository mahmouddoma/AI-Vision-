# Frontend delivery and QA evidence

## Delivery boundary

All application areas from the supplied backlog have frontend implementations. This is not a declaration that all Jira stories are Done: the backlog contains proposed story IDs, not connected Jira issue keys, and actual backend/MQTT release verification is blocked. No Jira issues or statuses were mutated.

| Story | Implementation                                                                                    | Verification / remaining evidence                                                                  |
| ----- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| FE-01 | Standalone lazy routes, fallback, pre-bootstrap runtime config, common HTTP client                | Production build; config and URL tests; browser route checks                                       |
| FE-02 | Responsive shell, tokens and shared UI components                                                 | Desktop/mobile screenshots; keyboard dialog test; DESIGN.md                                        |
| FE-03 | Typed catalog/live/report/session contracts, error mapping, pagination and concurrency recovery   | HTTP/query/error unit tests; runtime Swagger comparison pending                                    |
| FE-04 | Sites search, paging, create/edit and activation                                                  | Desktop/mobile browser create/edit/status and 409 reload scenarios                                 |
| FE-05 | Camera registry, site scope, string external IDs and derived topic                                | Camera browser scenario; topic ID validation test                                                  |
| FE-06 | Camera-scoped zones, nullable capacity and ordered thresholds                                     | Zone browser scenario; real duplicate-scope enforcement depends on server                          |
| FE-07 | Real-API overview, scoped occupancy, historical highlights, chart and health                      | Fixture-backed desktop/mobile overview; actual values pending backend                              |
| FE-08 | Site live view, camera search/freshness filter, nullable zone metrics                             | Browser routes; live source and actual stream timing pending                                       |
| FE-09 | Camera route and zone inspection with analytics link                                              | Browser routes and shared state; real-data drawer inspection pending                               |
| FE-10 | Four event handlers, scoped groups, ordering, reconnect, polling and cleanup                      | Reducer and mocked-hub reconnect/resync unit tests; actual hub outage pending                      |
| FE-11 | Cascading filters, UTC ranges, video session/offsets and interval validation                      | Filter unit tests; browser assertion that video queries omit from/to                               |
| FE-12 | Metric rankings and zone summary/timeseries dialog                                                | Browser ranking/drilldown and accessible data-table test                                           |
| FE-13 | Occupancy, peaks, utilization and gaps                                                            | Browser occupancy tab and chart gap unit test                                                      |
| FE-14 | Separate arrivals/entries and departures/exits, server-derived traffic trends                     | Browser traffic tab; source contract review                                                        |
| FE-15 | Reported/estimated dwell, uncertain visits and ranking metrics                                    | Browser dwell tab; null/source semantics tests                                                     |
| FE-16 | Wrong-way and per-camera staff summaries/series                                                   | Browser tabs; no distinct-employee or violation-percentage claims                                  |
| FE-17 | Searchable, scoped and paginated sessions                                                         | Browser route and video metadata flow                                                              |
| FE-18 | Session metadata, source-time occupancy/traffic/staff and missing positions                       | Browser video report query assertion; real recorded-session validation pending                     |
| FE-19 | Separate liveness/readiness, 503 and degraded MQTT status                                         | Browser 503 readiness/error test; actual MQTT degradation pending                                  |
| FE-20 | Quality metadata, partial-coverage disclosure and truthful null/time labels                       | Quality/format/chart unit tests and source-time browser assertions                                 |
| FE-21 | Mobile navigation, responsive content, scrollable tables, chart alternatives and focus management | Desktop/mobile browser layout and focus checks; manual screen-reader audit not performed           |
| FE-22 | Unit/component/service and fixture-based browser suites                                           | Commands and results below                                                                         |
| FE-23 | Separate real-backend integration suite and runbook prepared                                      | BLOCKED: API unavailable at localhost:5080; no SQL/MQTT integration run or real ingestion evidence |
| FE-24 | Setup, routes/API map, design system, backend runbook and release checklist                       | Documentation supplied; real backend screenshots and final QA sign-off still pending               |

## Executed checks

- `npm run build`: PASS, production compilation within the existing initial-bundle budget (452.03 kB initial raw assets; about 109.29 kB estimated transfer).
- `npm test -- --watch=false`: PASS, 26 tests across 7 files at the recorded verification point. Coverage includes config failure, URL/query omission, lookup pagination, 204 status patch, 409 trace/reload behavior, form validation, stale/mismatched event rejection, reconnect/resubscribe/REST resync, source-time queries, insufficient chart gaps and quality labels.
- `npm run test:e2e`: PASS, 15 scenarios across desktop (1440x1000) and mobile (390x844); the mobile-only navigation scenario is intentionally skipped on desktop. Responses are synthetic fixtures from e2e/fixtures.ts, never production data. The application itself has no demo-data fallback.
- `python .agents/validate_agent.py`: agent configuration check, separate from application functionality.
- `npm run test:e2e:live`: NOT RUN. The backend port was unavailable; no claim of MQTT -> SQL -> REST/SignalR -> Angular success is made.

Screenshots are generated at `artifacts/overview-desktop.png`, `artifacts/overview-mobile.png` and `artifacts/sites-mobile.png`. Test data explicitly names Main Mall as a test fixture. Playwright's report and retained failure traces are local generated outputs, ignored by Git.

## Release checklist

- [x] Typed builds and component/service checks pass.
- [x] Desktop/mobile route and form workflows pass with mock responses.
- [x] Runtime config contains no server/broker credentials.
- [x] No fake KPIs, unsupported CRUD or video playback controls in the application.
- [ ] Compare models against the running Swagger version.
- [ ] Run real publisher-backed tests per INTEGRATION.md and retain request/response evidence.
- [ ] Verify new-session ordering, freshness transitions and reconnect against the actual server.
- [ ] Check keyboard/screen reader with the release browser/device set.
- [ ] Review dependency security advisories before release. npm reported 16 moderate advisories during installation; no forced framework/dependency upgrades were applied.
- [ ] Attach real backend screenshots and sign off actual Jira issues in the team's tracker.

## LAN server connectivity update

Runtime configuration now points to `http://192.168.1.8:8005`. Read-only health checks returned HTTP 200: liveness Healthy, readiness Healthy, database Ready, MQTT Subscribed. In a real Chrome browser at `http://localhost:4200`, sites, monitoring status, cameras, site live state, analytics overview and occupancy returned HTTP 200; hub negotiation succeeded and the UI reported Connected with no browser runtime errors.

The earlier localhost:5080 availability blocker was specific to the original implementation run. FE-23 now remains pending publisher-driven state changes, full reconnect/ingestion verification and release sign-off, rather than basic server reachability. No registry records or MQTT messages were written during this connectivity check.
