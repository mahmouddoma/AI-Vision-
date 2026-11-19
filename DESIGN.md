# AI Vision interface system

An operations workspace for reviewing camera observations and administering their registry. The user's direction is restrained, clean and coordinated: minimal borders, no fluorescent colors, and Font Awesome icons. Arabic and English are supported across routes, reports, registry forms, shared components and startup errors. Arabic is the default; the language control updates document language, direction and page titles and saves the preference locally. Registry names, identifiers and technical protocol values retain their original content. `src/app/core/i18n.ts` owns translations; `LocalizedFormat` applies the active locale to dates and unknown-value labels while preserving readable numeric identifiers and durations.

## Foundations

`src/styles.css` owns shared tokens and component styles; feature styles only own their layout. Bootstrap Reboot normalizes browser elements and Bootstrap Grid lays out the metric rows. No Bootstrap JavaScript or CSS override layer is used.

| Role                   | Token                           | Value                          |
| ---------------------- | ------------------------------- | ------------------------------ |
| Canvas / surface       | `--canvas`, `--surface`         | `#f4f6f8`, `#fff`              |
| Text / secondary text  | `--ink`, `--muted`              | `#253548`, `#627183`           |
| Accent / strong accent | `--accent`, `--accent-dark`     | `#247d77`, `#1e6763`           |
| Quiet accent surface   | `--accent-soft`                 | `#e8f3f1`                      |
| Warning / surface      | `--warning`, `--warning-soft`   | `#91651d`, `#fbf4e7`           |
| Danger / surface       | `--danger`, `--danger-soft`     | `#a24444`, `#f9eeee`           |
| Structural divider     | `--line`                        | `#e6ebef`                      |
| Spacing                | `--space-1` through `--space-8` | 4, 8, 12, 16, 20, 24, 32, 40px |
| Corner radii           | `--radius-sm`, `--radius`       | 8px controls, 14px surfaces    |

Typography uses the local Segoe UI/system stack; there is no external font request. Page headings are 25-32px, section headings 16px, body 13px, table cells 12px, metadata 10-11px. Font Awesome definitions are imported individually and rendered as inline SVG with `aria-hidden`; actionable controls always have text or an accessible name. Borders separate table rows and delimit inputs, while flat white surfaces separate larger content regions.

## Page blueprint

```text
Desktop: persistent navigation | site + time zone + system status
                              | page heading and refresh
                              | current operational metrics
                              | collapsible report filters
                              | historical highlights and charts
                              | registered camera health / drilldown

Mobile: menu + site + status
        page heading, two-column metrics
        collapsed filters, expandable on demand
        stacked reports, explicitly scrollable data tables
```

The sidebar becomes a native modal navigation dialog below 992px. Native dialogs include explicit focus wrapping, Escape behavior, focus restoration and disabled dismissal during a mutation. Filters collapse initially below 768px. Small-screen form inputs use 16px text; buttons have 44px minimum height. Reduced motion disables decorative transitions and skeleton animation.

## Reusable components

| Component              | Contract                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `Icon`                 | Typed Font Awesome name; no icon font/CDN dependency                                                                               |
| `Metric`               | Label, formatted value, explanatory scope; unknown stays N/A                                                                       |
| `Status`               | Icon and text plus restrained semantic color; never color alone                                                                    |
| `Quality`              | Kind and coverage, expandable samples/duration/resets/baselines/gaps                                                               |
| `StateView`            | Skeleton, actionable error with support trace, or contextual empty state                                                           |
| `Dialog`               | Native modal used for registry edits, status confirmation, detail and navigation                                                   |
| `Table` / `Pagination` | Labelled scroll region, semantic headers and explicit server pages                                                                 |
| `Chart`                | Average/peak or two named series; gaps remain gaps; accessible data table pages of 100 rows, rendered only when expanded           |
| `ReportFilters`        | Cascading site/camera/zone context, live clock range or video session positions, validated explicit Apply                          |
| `MetricQualityView`    | Smart provenance, partial/stale status, coverage, samples, gaps, resets, baselines and warning codes; distinct from legacy quality |
| `VisualizationView`    | Backend-discriminated line/area/bar/histogram/gauge/timeline and polygon heatmap; exact data and source-time labels                |

Fresh, Stale, No recent data, Never received, Ended, Warning, Critical and Estimated retain distinct text. Disabling a record does not erase history. Historical totals are never derived from cumulative live snapshots. Each chart describes its source and has a data table rather than a hover-only interaction.

## State flows

Registry: search/list -> Add or Edit -> required fields / server validation -> Save -> reload. A 409 keeps the editor open, identifies the conflict and requires reloading an existing record before resubmission. New records can correct duplicate identifiers and retry.

Floor layout: select camera/zone -> edit normalized polygon with pointer or coordinate fields -> validate non-intersection -> save with the current layout version. Deletion requires an explicit confirmation and the stored version. Heatmap fill represents returned measurements; unavailable values retain a neutral fill and quality explanation.

Alerts: REST inbox/evidence -> coalesced, site-scoped invalidation events -> fresh REST data. Acknowledge keeps monitoring active; active rules explain observed recovery. Rule scope and kind are immutable on edit. External role/site claims control visible capabilities while the API remains authoritative.

Live: REST snapshot -> scoped hub subscription -> ordered events -> throttled summary resync -> reconnect/resubscribe/REST recovery. Disabled or unavailable SignalR keeps polling. Never received, stale observations, previous-session zones and no registered camera each have explicit treatments.

Analytics: choose source -> apply valid scope -> show returned report period and quality -> inspect zone -> access exact chart data. Recorded-video sessions use elapsed source positions and never imply availability of raw video playback or real venue visit time.
