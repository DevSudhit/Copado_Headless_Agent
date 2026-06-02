# Demo Readiness

Last updated: 2026-06-01

This file is the current team-facing checkpoint for deciding whether to record a demo now or wait for additional Copado-side setup.

## Ready Now

- `copado-hx` CLI is built, linked, and runnable locally.
- `npm run check`, `npm test`, and `npm run build` passed on 2026-06-01.
- Architecture, local config, session state, tests, and CI scaffolding are in place.
- Live Copado AI integration is working end-to-end on the new robotic workspace.
- AI agents `plan`, `build`, `release`, `test`, and `operate` are story-aware for the active story context.
- Live AI commands `ai ask` and `ai chat` are working end-to-end.
- Live story commands are working: `story list`, filtered `story list --pipeline/--status`, `story current`, and `story show`.
- The `story create` command is implemented and exposed in the CLI.
- Live Copado CRT run, status, and results flows are working end-to-end.
- Live CRT helper commands are working: `test list`, `test run --job`, and `test results --format text|json|pdf`.
- Multi-service auth and runtime configuration are implemented for `ai`, `crt`, and `cicd`.
- CRT live run triggering is implemented and prints direct dashboard URLs.
- `commit`, `promote`, and `deploy` no longer fail with mock-only guards; they now return real Copado-backed readiness or blocker messages.
- `commit`, `promote`, and `deploy` accept a story override with `--us` or `--id`.
- `status` and `status --watch` now work as a live terminal summary, including the latest known CRT status.

## What We Can Demo Right Now

### 1. CLI auth and configuration

Command:

```bash
copado-hx auth status
```

What it shows:

- active runtime mode
- enabled services
- configured base URLs
- whether required tokens are present

### 2. Live story context from Copado

Command examples:

```bash
copado-hx story current
copado-hx story list
copado-hx story list --pipeline "Trial - Salesforce Source Format" --status Draft
copado-hx story show
copado-hx story show --id US-0000026
```

What it shows:

- the CLI can resolve real Copado story data in live mode
- active story details are no longer mock-only
- visible stories can be listed directly from the current Copado workspace context
- story lists can now be narrowed by pipeline and status for demo flows
- the current story can be shown without repeating its ID after `story set`

### 3. Live Copado AI prompt execution

Command examples:

```bash
copado-hx ai ask --agent release "Summarize release risks for the current setup"
copado-hx ai chat --agent build "Give one short next step for the active story"
```

What it shows:

- the CLI calling the real Copado AI backend
- a real AI response coming from the configured Copado workspace
- story-aware guidance for the active Copado story instead of generic fallback text
- the Track A `ai chat --agent ...` surface is now implemented and working live

### 4. Live CRT execution lookup

Command examples:

```bash
copado-hx test list
copado-hx test run --job 120953
copado-hx test status --execution 5261959 --suite 120953
copado-hx test results --execution 5261959 --suite 120953
copado-hx test results --execution 5261959 --job 120953 --format pdf
```

What it shows:

- the CLI calling the real CRT backend
- live CRT jobs can be listed directly from the configured project
- CRT runs can now be started with either `--suite` or `--job`
- real status and result retrieval for an actual CRT execution
- results can be rendered as text, JSON, or a generated PDF file
- direct job and runs dashboard URLs
- persisted CLI context, so repeated status lookups can omit `--suite` after the first resolved run

### 5. Optional live CRT run trigger

Command example:

```bash
copado-hx test run --suite 120953
```

What it shows:

- the CLI can trigger a live CRT run
- follow-up status and result checks work against the generated execution ID

Note:

- this starts a real CRT execution, so only use it if we want the demo to include an actual run

### 6. Story creation command surface

Command example:

```bash
copado-hx story create --title "Demo story" --pipeline "Trial - Salesforce Source Format"
```

What it shows:

- the Track A `story create` command is now part of the CLI surface
- the command correctly resolves the target pipeline and attempts the create flow
- the current live backend path still reports read-only access for story objects, so a successful live insert is not yet demoable

### 7. Live release gating and blocker detection

Command examples:

```bash
copado-hx commit
copado-hx commit --message "test commit from live validation" --us US-0000025
copado-hx promote --env UAT --validate
copado-hx promote --us US-0000025 --env UAT --validate
copado-hx deploy --env PROD
```

What it shows:

- the CLI no longer responds with mock-only errors for these commands
- Copado-backed checks explain why the active story cannot move forward yet
- `deploy --env PROD` now asks for an approval confirmation interactively instead of requiring a separate `--approve` flag
- the current blockers are concrete and demoable:
	- commit is not yet a verified write path; the current live path still returns readiness or blocker guidance instead of a confirmed Copado write execution
	- promote to `UAT` is blocked because `US-0000025` is still in `Draft` and the required route is `Dev1-SFP -> INT-SFP -> UAT-SFP`
	- deploy to `PROD` is blocked because the story has not progressed through the required upstream environments before `Production-SFP`

### 8. Live status dashboard view

Command examples:

```bash
copado-hx status
copado-hx status --watch
```

What it shows:

- active runtime mode and enabled services
- active story, last promotion environment, and last deployment environment
- latest known CRT status in a lightweight terminal dashboard
- a polling watch mode for following the current state live in the terminal

## Not Demo-Complete Yet

- We do not yet have a successful end-to-end commit, promote, or deploy for `US-0000025`.
- The current live story and pipeline command behavior is mediated through Copado AI rather than a verified direct Pipelines REST contract.
- The latest CRT execution observed from the CLI (`5262844`) is `aborted`, so there is not yet a clean passing test signal to show.
- `story create` is implemented in the CLI, but the current Copado-backed path still reports read-only story access, so live story insertion is blocked.
- The Copado story itself is not release-ready yet:
	- no environment assigned
	- no org credential assigned
	- no metadata committed
	- no sprint or release assigned
	- no acceptance criteria defined

## Recommended Decision

Start the demo video now if the goal is to show:

- the headless CLI experience
- live Copado AI with story-aware guidance
- the now-complete Track A AI command surface (`ai ask` and `ai chat`)
- live Copado story lookup from the CLI
- filtered story listing, CRT job listing, and formatted CRT result export
- live Copado CRT connectivity and dashboard links
- real Copado-backed blocker detection for commit, promote, and deploy

Wait for extra features if the goal is to show:

- a successful end-to-end release path
- successful commit, promote, and deploy execution
- a passing CRT run tied to the active story
- direct Pipelines API execution without AI mediation

## Practical Recommendation

The project is ready for a credible progress demo now.

The best current story is:

- headless Copado CLI
- live Copado AI with real story context
- live CRT execution and dashboards
- live release-readiness checks that explain exactly why the story is blocked

If the intended video is a milestone demo, record now.
If the intended video must prove successful release orchestration, finish the Copado-side story setup first and then re-record commit, promote, deploy, and CRT with a passing run.