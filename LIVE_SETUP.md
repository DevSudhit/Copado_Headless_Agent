# Live Integration Setup

This document prepares the repository for real Copado credentials without hardcoding secrets.

## What Is Already Prepared In The Repo

- `.copado-hx.json` contains the default token env var names for `cicd`, `ai`, and `crt`.
- `copado.env.example` lists the environment variables you need.
- `config validate` checks whether the services are configured correctly.
- Production deploys still require approval in the CLI.

## Playground Details You Already Have

Primary Copado org:

- `sudhitjain@310526cph.com`

Source-format scratch orgs:

- `sudhitjain@310526cph.com.production-sfp`
- `sudhitjain@310526cph.com.hotfix-sfp`
- `sudhitjain@310526cph.com.uat-sfp`
- `sudhitjain@310526cph.com.int-sfp`
- `sudhitjain@310526cph.com.dev1-sfp`
- `sudhitjain@310526cph.com.dev2-sfp`

These map naturally to the CLI environments `PROD`, `HOTFIX`, `UAT`, `INT`, `DEV1`, and `DEV2`.

## Manual Steps You Still Must Do Yourself

These steps require your logged-in browser session or secret values, so they cannot be automated from the repo.

### 1. Gather Copado CI/CD Access Details

From the Copado playground or admin area, collect:

- the CI/CD base URL
- the auth method shown by Copado
- the final access token, or the connected-app / OAuth details if a raw token is not provided

If Copado only gives OAuth or connected-app credentials, do not guess. Record the exact field names and values, except the secret itself, and wire them next.

### 2. Create A Copado AI Personal Access Key

From the Copado AI account:

- go to your profile
- click `New Key`
- generate a personal access key
- note your region base URL
- note your organization ID
- optionally create or note a workspace ID for chat flows

### 3. Request CRT Trial Access

If you want CRT in the demo, request the trial and then collect:

- the CRT base URL
- the CRT access token

### 4. Put Secrets In Your Shell Or In A Local `.env`

Use these names:

- `COPADO_CICD_TOKEN`
- `COPADO_AI_TOKEN`
- `COPADO_CRT_TOKEN`

Example shell exports:

```bash
export COPADO_CICD_TOKEN="paste-cicd-token-here"
export COPADO_AI_TOKEN="paste-ai-token-here"
export COPADO_CRT_TOKEN="paste-crt-token-here"
```

## Configure The CLI

### Copado CI/CD

```bash
node dist/index.js auth login --mode live --service cicd --profile playground --base-url "$COPADO_CICD_BASE_URL" --token-env COPADO_CICD_TOKEN
```

### Copado AI

```bash
node dist/index.js auth login --mode live --service ai --profile freemium --base-url "$COPADO_AI_BASE_URL" --token-env COPADO_AI_TOKEN
```

### CRT

```bash
node dist/index.js auth login --mode live --service crt --profile trial --base-url "$COPADO_CRT_BASE_URL" --token-env COPADO_CRT_TOKEN
```

## Validate Everything

Run:

```bash
node dist/index.js auth status
node dist/index.js config validate
node dist/index.js config validate --service ai
node dist/index.js config validate --service cicd
node dist/index.js config validate --service crt
```

## What To Send Back For The Next Integration Step

Once you gather the real details, send back only non-secret values such as:

- CI/CD base URL
- AI base URL region
- AI organization ID
- whether CI/CD uses bearer token or connected-app OAuth
- whether CRT access is ready

Do not paste real tokens into chat.