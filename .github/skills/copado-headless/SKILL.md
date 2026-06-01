---
name: copado-headless
description: 'Use when working with the current copado-hx CLI in this repository: selecting stories, running commit/promote/test/deploy readiness flows, checking JSON status, running CRT jobs, or asking Copado AI agents through the headless workflow.'
argument-hint: 'Describe the requested Copado workflow, story, environment, or AI task'
---

# Copado Headless CLI Workflow

This skill teaches an agent how to operate the current `copado-hx` workflow in this repository.

The CLI is partially live:

- auth, story lookup, AI prompts, CRT runs, CRT status, and CRT results are live
- commit, promote, and deploy return live Copado-backed readiness or blocker information
- live story and pipeline command behavior is currently mediated through Copado AI rather than a verified direct Pipelines REST client

## When to Use

- The user asks to run or explain `copado-hx` commands.
- The user wants a browser-free Copado flow such as story selection, readiness checks, CRT execution, or AI help.
- The user wants machine-readable CLI output for another tool or agent.

## Prerequisites

- Work from the repository root when possible.
- Check auth and current state first with `copado-hx auth status` and `copado-hx status`.
- Set or confirm story context before pipeline operations:
   - `copado-hx story list`
   - `copado-hx story set --id <story-id>`
   - `copado-hx story show`
- Never infer IDs or environment names.

## Guardrails

- Never deploy to `PROD` without explicit human approval.
- Never guess story IDs, suite IDs, execution IDs, or environment names.
- Never assume `commit`, `promote`, or `deploy` actually executed a write unless the returned output explicitly says so.
- Prefer `--json` output when another tool, script, or agent needs structured data.

## Current Command Surface

### Working commands

- `copado-hx auth status`
- `copado-hx auth login ...`
- `copado-hx auth logout`
- `copado-hx story list`
- `copado-hx story show`
- `copado-hx story show --id <story-id>`
- `copado-hx story list --pipeline <pipeline-id-or-name> --status <status>`
- `copado-hx story create --title <title> --pipeline <pipeline-id-or-name>`
- `copado-hx story set --id <story-id>`
- `copado-hx story current`
- `copado-hx commit [--message <msg>] [--us <story-id>|--id <story-id>]`
- `copado-hx promote --env <env> [--validate] [--us <story-id>|--id <story-id>]`
- `copado-hx deploy --env <env> [--us <story-id>|--id <story-id>]`
- `copado-hx status`
- `copado-hx status --watch`
- `copado-hx test list`
- `copado-hx test run --suite <suite-id>`
- `copado-hx test run --job <job-id>`
- `copado-hx test status --execution <execution-id> [--suite <suite-id>|--job <job-id>]`
- `copado-hx test results --execution <execution-id> [--suite <suite-id>|--job <job-id>]`
- `copado-hx test results --execution <execution-id> --format <text|json|pdf>`
- `copado-hx ai ask --agent <plan|build|test|release|operate> "<prompt>"`
- `copado-hx ai chat --agent <plan|build|test|release|operate> [prompt...]`

## Common Flows

### Delivery Readiness Flow

1. `copado-hx auth status`
2. `copado-hx status`
3. `copado-hx story set --id <story-id>`
4. `copado-hx ai ask --agent build "What metadata should I commit for <story-id>?"`
5. `copado-hx commit [--message "..."]`
6. If the result is blocked, stop and surface the blocker.
7. `copado-hx promote --env <env> --validate`
8. If the result is blocked, stop and surface the blocker.
9. `copado-hx test run --suite <suite-id>`
10. `copado-hx test status --execution <id> --suite <suite-id>`
11. `copado-hx test results --execution <id> --suite <suite-id>`
12. Ask for explicit human confirmation before `copado-hx deploy --env PROD`.

### Blocker Investigation Flow

1. `copado-hx status`
2. `copado-hx story show`
3. Run the blocked command (`commit`, `promote`, or `deploy`).
4. Summarize the returned blocker text.
5. `copado-hx ai ask --agent release "Explain this blocker and next steps: <message>"`

### Structured Output Flow

1. Use `copado-hx --json status` when another tool needs current config and context.
2. Use text output for human demos unless the user asked for JSON.

## References

- [Command cheat sheet](./references/command-cheatsheet.md)