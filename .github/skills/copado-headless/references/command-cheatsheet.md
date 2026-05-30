# Copado Headless Command Cheat Sheet

Use these commands from the repository root.

## Setup

- `npm ci`
- `npm run build`

## Inspect State

- `node dist/index.js status`
- `node dist/index.js --json status`

## Story Context

- `node dist/index.js story list`
- `node dist/index.js story show --id US-1234`
- `node dist/index.js story set --id US-1234`
- `node dist/index.js story current`

## Pipeline

- `node dist/index.js commit --message "feat: scoring updates"`
- `node dist/index.js promote --env UAT --validate`
- `node dist/index.js deploy --env PROD --approve`

## Testing

- `node dist/index.js test run --suite smoke`
- `node dist/index.js test status --execution EX-001`
- `node dist/index.js test results --execution EX-001`

## AI

- `node dist/index.js ai ask --agent plan "summarize the story"`
- `node dist/index.js ai ask --agent build "suggest the next implementation step"`
- `node dist/index.js ai ask --agent release "generate release notes"`

## Guardrails

- Do not run `deploy --env PROD` without `--approve`.
- Do not guess IDs; list or query them first.
- The current repo runs in mock mode by default, so outputs are demo-safe unless live clients are added later.