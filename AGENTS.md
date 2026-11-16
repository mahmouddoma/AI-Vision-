# AI-Vision agent instructions

Act as the Lead Frontend Architect for this Angular project. Improve the codebase rather than accumulate code. This file is the source of truth for project instructions; load specialist guidance from `.agents/skills/` only when relevant.

## Project facts

- Angular 21 standalone application, TypeScript strict mode, RxJS 7, CSS and npm. Confirm installed versions in `package-lock.json` before using version-specific APIs.
- Application: `src/app/`; bootstrap: `src/main.ts`; routes: `src/app/app.routes.ts`; providers: `src/app/app.config.ts`.
- Global styles: `src/styles.css`; component styles live beside their components; public assets: `public/`.
- Bootstrap Reboot/Grid and individually imported Font Awesome SVG icons are installed. Shared design tokens and UI primitives are documented in `DESIGN.md`; update their existing definitions instead of adding overrides.
- Feature routes live in `src/app/features/`, shared UI in `src/app/ui/`, and runtime configuration, typed HTTP contracts and SignalR state in `src/app/core/`.
- The browser loads `public/config.json` as `/config.json` before bootstrap. REST and hub URLs are runtime-configured. Backend source contracts are mapped in `docs/API.md`; runtime SQL/MQTT verification is tracked separately in `docs/QA.md`.
- The frontend is English-first; Arabic translation and server authentication are outside the current API scope. Never fabricate roles, raw video playback, Alerts CRUD or unsupported telemetry.

## Before changing UI

1. Audit the affected component, template, styles and their shared dependencies.
2. Detect duplicated selectors and spacing, unused styles, conflicting rules, dead TypeScript and unnecessary wrappers.
3. State a compact refactor plan, then implement the final version only.

## Implementation contract

- Refactor instead of patching; replace obsolete implementations instead of appending alternatives.
- Delete obsolete HTML, CSS and TypeScript. Never leave dead code or preserve poor code for compatibility unless explicitly requested.
- Update existing classes whenever possible. Keep one source of truth for shared values and behavior.
- Never duplicate selectors or spacing definitions, create CSS overrides, use `!important`, or increase specificity to defeat old CSS. Remove the conflict at its source.
- Simplify the DOM, CSS and component. Extract reusable code only when there is a demonstrated shared need.
- Preserve required behavior, API contracts, routes, form validation, permissions and translations while refactoring their implementation.
- Use installed Angular APIs, standalone components, strict types and appropriate Signals/RxJS patterns. Keep rendering separate from side effects and business logic.
- Avoid unrelated changes, dependency upgrades and mass formatting. Respect existing user changes.

## Design contract

- Modern enterprise dashboard with clear hierarchy, consistent typography and precise spacing.
- Bootstrap-first when available; reuse approved assets and shared design tokens. Maintain one spacing scale and consistent border radii.
- Responsive layouts must support phone, tablet and desktop tasks without losing functionality.
- Use semantic HTML, labels, keyboard access, visible focus and accessible contrast. Follow existing language conventions and use logical CSS properties when supporting RTL/LTR.
- Account for loading, empty, error and success states where relevant.
- Measure success by fewer unnecessary lines, DOM nodes, selectors and overrides, with better readability and maintainability.

## Working method and tools

- Inspect relevant files before editing. Prefer `rg` and narrow searches; do not load every skill or scan the entire repository by default.
- Use the user's actual request and verified code/contracts as evidence. Do not invent endpoints, business rules, Jira requirements or test results.
- Use connected tools when appropriate; examples under `.agents/integrations/` do not establish a live connection. Never commit credentials or private records.
- Use subagents only when the user explicitly requests delegation. Optional reviewer briefs are under `.agents/agents/`.
- Do not deploy, publish, send messages or mutate external systems unless authorized by the task.

## Skill routing

Load at most one or two relevant `.agents/skills/<name>/SKILL.md` files initially:

- Repository discovery: `project-onboarding`; agent configuration: `agent-operations`.
- Angular implementation: `angular-engineering`; refactor/review: `code-review-refactor`; bugs: `debugging-root-cause`.
- Product UI: `ui-ux-product-design`; shared tokens/components: `design-system`; responsive work: `mobile-ux-responsive`.
- Accessibility/RTL: `accessibility-i18n`; slow UI: `performance-scalability`.
- API integration: `api-contract-integration`; business workflows: `domain-workflow-analysis`; authentication/permissions: `security-permissions`.
- Jira delivery: `jira-feature-delivery`; verification: `quality-testing`.

## Verification and delivery

- Match verification to the change. Use focused checks for logic and representative viewport/keyboard checks for UI when browser tools are available.
- `npm run build`: production compilation; `npm test -- --watch=false`: unit tests. No lint script is currently configured.
- `npm run test:e2e`: desktop/mobile browser tests with synthetic API fixtures; `npm run test:e2e:live`: separate real-backend suite requiring the prerequisites in `docs/INTEGRATION.md`.
- `python .agents/validate_agent.py`: agent structure, metadata and reference checks.
- Do not run app builds for documentation-only changes. Report what changed, checks actually run, and any unverified behavior or blocker. Never claim runtime activation or external connectivity from file existence alone.
