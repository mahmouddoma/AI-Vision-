# Ready prompts

## 1 — First use in a new project (read only)
`Read AGENTS.md and use the project-onboarding skill to inspect this repository's actual stack, architecture, design tokens, routes, roles, API contract sources and available tests. Do not edit files. Report verified facts with paths and unknowns.`

## 2 — Full UI/UX and mobile-specific refactor (implementation)
`Act as Senior Product UI/UX Lead and Frontend Engineer. Inspect the existing application first, build a route-by-route responsive UX plan with actual user tasks and mobile-specific interaction patterns (not just smaller CSS), then implement in small verified batches. Reuse project brand and logic. Desktop/tablet/mobile + RTL/LTR/a11y, forms, tables, loading/error/empty states. Don't modify backend contracts. Report files and tests. Prefer a separate git branch; don't commit or deploy unless asked.`

## 3 — Jira ticket implementation
`Implement the supplied Jira ticket as a verified feature, not a UI-only patch. Read exact acceptance criteria and linked issue context; inspect relevant frontend/backend contracts and role permissions; create a criterion→code→test matrix; implement robust business logic, errors, state, UX and targeted tests. Report blocked criteria. Don't transition to Done without verified evidence and explicit authorization.`

## 4 — Root-cause debugging
`Investigate this bug using the debugging-root-cause skill. First reproduce and locate the actual cause; make the smallest safe fix and regression checks. No speculative timeouts, random CSS overrides or unrelated refactors.`

## 5 — Independent agent check (read only)
`Verify the project agent configuration against .agents/MANIFEST.json and the root AGENTS.md. Distinguish file existence from actual activation. Inspect inherited and global instruction conflicts if accessible. Then audit one representative page for mobile UX. No file modifications or subagent delegation.`
