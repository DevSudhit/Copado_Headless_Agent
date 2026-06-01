## Identity

You have access to `copado-hx`, a CLI for operating the Copado workflow in this repository.

Through this CLI you can:

- inspect auth and runtime status
- manage active user story context
- ask Copado AI agents for plan, build, test, release, and operate guidance
- run Copado Robotic Testing suites and inspect results
- perform live commit, promote, and deploy readiness checks

Important current limitation:

- live `story`, `commit`, `promote`, and `deploy` behavior is currently mediated through Copado AI rather than a verified direct Pipelines REST client
- `commit`, `promote`, and `deploy` may return real Copado-side blocker information without actually executing the write action

## Prerequisites

- Run `copado-hx auth status` before any multi-step workflow.
- The CLI auto-loads the repo `.env` file and the repo-local `.copado-hx.json` and `.copado-hx.state.json`.
- Set a working story context with `copado-hx story set --id <story-id>` before using bare `commit`, `promote`, or `deploy`.
- Never guess story IDs, suite IDs, execution IDs, or environment names. Retrieve them from CLI output first.

## Commands Reference

### Authentication

- `copado-hx auth status`
- `copado-hx auth login --mode <mock|live> --service <cicd|ai|crt> --base-url <url> --token-env <env>`
- `copado-hx auth logout`

### Story Context

- `copado-hx story list`
- `copado-hx story list --pipeline <pipeline-id-or-name> --status <status>`
- `copado-hx story show`
- `copado-hx story show --id <story-id>`
- `copado-hx story create --title <title> --pipeline <pipeline-id-or-name>`
- `copado-hx story set --id <story-id>`
- `copado-hx story current`

### Pipeline Operations

- `copado-hx commit [--message <msg>] [--us <story-id>|--id <story-id>]`
- `copado-hx promote --env <environment> [--validate] [--us <story-id>|--id <story-id>]`
- `copado-hx deploy --env <environment> [--us <story-id>|--id <story-id>]`

Notes:

- `commit` can run without `--message`; the CLI generates a default message from the story context.
- `deploy --env PROD` prompts for interactive approval in a TTY.
- A successful CLI invocation does not guarantee a real write occurred; inspect the returned `status` and `message` fields.

### Status

- `copado-hx status`
- `copado-hx status --watch`
- `copado-hx status --watch --interval <seconds>`

### Testing

- `copado-hx test list`
- `copado-hx test run --suite <suite-id>`
- `copado-hx test run --job <job-id>`
- `copado-hx test status --execution <execution-id> [--suite <suite-id>|--job <job-id>]`
- `copado-hx test results --execution <execution-id> [--suite <suite-id>|--job <job-id>]`
- `copado-hx test results --execution <execution-id> --format <text|json|pdf>`

### AI Agents

- `copado-hx ai ask --agent plan <prompt>`
- `copado-hx ai ask --agent build <prompt>`
- `copado-hx ai ask --agent test <prompt>`
- `copado-hx ai ask --agent release <prompt>`
- `copado-hx ai ask --agent operate <prompt>`
- `copado-hx ai chat --agent <plan|build|test|release|operate> [prompt...]`

## Workflow Playbooks

### Story Delivery Readiness

Use this when the developer asks for the current readiness of a story.

1. `copado-hx auth status`
2. `copado-hx story set --id <story-id>`
3. `copado-hx story show`
4. `copado-hx ai ask --agent build "What metadata should I commit for <story-id>?"`
5. `copado-hx commit [--message "..."]`
6. If the returned status is blocked/failed, stop and surface the blocker.
7. `copado-hx promote --env <target> --validate`
8. If the returned status is blocked/failed, stop and surface the blocker.
9. `copado-hx test run --suite <suite-id>`
10. `copado-hx test status --execution <execution-id> --suite <suite-id>` until the run finishes.
11. `copado-hx test results --execution <execution-id> --suite <suite-id>`
12. Ask for explicit human confirmation before `copado-hx deploy --env PROD`.

### Investigate Delivery Blockers

1. `copado-hx status`
2. `copado-hx story show`
3. `copado-hx commit` or `copado-hx promote --env <env>` or `copado-hx deploy --env <env>`
4. Surface the returned blocker message to the human.
5. `copado-hx ai ask --agent release "Explain this blocker and what needs to change: <message>"`

### Test Investigation

1. `copado-hx test status --execution <execution-id> --suite <suite-id>`
2. `copado-hx test results --execution <execution-id> --suite <suite-id>`
3. `copado-hx ai ask --agent test "Summarize the testing status and next validation steps for <story-id>."`

## Guardrails

- Never deploy to `PROD` without explicit human confirmation.
- Never fabricate IDs, environment names, or suite IDs.
- Never treat a Copado AI answer as proof that a write action occurred unless the CLI command result explicitly says it executed successfully.
- Never continue from `commit` to `promote`, or from `promote` to `deploy`, if the command reports blockers or an aborted test run.
- Never log or print tokens or secrets.

## Output Parsing Guide

- Use the global `--json` flag whenever another tool or agent needs structured output.
- `copado-hx --json status` returns `config`, `context`, and `latestTestStatus`.
- Pipeline commands return structured output with fields such as:
  - `operationId`
  - `operation`
  - `storyId`
  - `environment`
  - `status`
  - `message`
  - `validationRequested`
- For pipeline commands, `status: "failed"` often means Copado-side prerequisites are missing, not that the CLI itself crashed.
- CRT commands return `executionId`, `suiteId`, `status`, and dashboard URLs.
- AI commands return freeform text and should not be parsed as authoritative state unless they are explicitly asked for machine-readable JSON.

## Agent Persona Routing

- Route planning and story-refinement requests to `plan`.
- Route code, metadata, and commit-scope questions to `build`.
- Route CRT and validation questions to `test`.
- Route promotion, deploy, blocker analysis, and release-note requests to `release`.
- Route post-release documentation and change-management requests to `operate`.