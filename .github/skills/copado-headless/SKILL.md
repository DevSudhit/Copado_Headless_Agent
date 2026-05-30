---
name: copado-headless
description: 'Use when working with the copado-hx CLI in this repository: selecting stories, running commit/promote/test/deploy flows, checking JSON status, or asking Copado AI agents through the headless workflow. Includes guardrails for approval, ID handling, and the repo''s current mock-mode limitation.'
argument-hint: 'Describe the requested Copado workflow, story, environment, or AI task'
---

# Copado Headless CLI Workflow

This skill teaches an agent how to operate the `copado-hx` workflow in this repository.

The current repo is a TypeScript CLI scaffold. The command surface is real, but the CI/CD, CRT, and AI integrations are still mocked unless live clients are added later.

## When to Use

- The user asks to run or explain `copado-hx` or `node dist/index.js` commands.
- The user wants a browser-free Copado flow such as story selection, commit, promote, test, deploy, or AI help.
- The user wants machine-readable CLI output for another tool or agent.
- The user asks for a safe end-to-end demo of the headless workflow.

## Guardrails

- Never deploy to `PROD` unless the user has given explicit approval and the command includes `--approve`.
- Never guess story IDs, suite IDs, or execution IDs. Use the current context or query them first.
- Check current state before multi-step flows with `node dist/index.js status` or `node dist/index.js --json status`.
- Treat command results as mock results unless the repository has been upgraded to real Copado API clients and configured for live mode.
- Prefer `--json` output when another tool, script, or agent needs structured data.

## Procedure

1. Work from the repository root.
2. If the CLI has not been built yet, run `npm ci` and `npm run build`.
3. Check the current state with `node dist/index.js status`.
4. Establish story context before pipeline operations:
   - `node dist/index.js story list`
   - `node dist/index.js story set --id <story-id>`
   - `node dist/index.js story current`
5. Run the requested workflow command.
6. Re-check state with `status` or `--json status` if the command changes workflow context.
7. Summarize the result and state clearly whether it came from mock mode or live mode.

## Common Flows

### Delivery Flow

1. `node dist/index.js status`
2. `node dist/index.js story list`
3. `node dist/index.js story set --id <story-id>`
4. `node dist/index.js commit --message "..."`
5. `node dist/index.js promote --env UAT --validate`
6. `node dist/index.js test run --suite smoke`
7. `node dist/index.js test status --execution <execution-id>`
8. `node dist/index.js test results --execution <execution-id>`
9. `node dist/index.js deploy --env PROD --approve`

### AI Flow

1. Confirm active story with `node dist/index.js story current`.
2. Run `node dist/index.js ai ask --agent <plan|build|test|release|operate> "<prompt>"`.
3. If another tool needs the response, prefer `node dist/index.js --json status` before or after the AI call so the active story and environment context are explicit.

### Structured Output Flow

1. Use `node dist/index.js --json status` when another tool needs current config and context.
2. Use normal text output for human demos unless the user asked for JSON.

## References

- [Command cheat sheet](./references/command-cheatsheet.md)

## What This Skill Does Not Do

- It does not replace the CLI implementation.
- It does not bypass service-layer guardrails.
- It does not make mock responses become real Copado API responses.
- It does not allow silent production deploys.