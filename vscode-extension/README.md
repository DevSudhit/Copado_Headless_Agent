# Copado DevOps — VS Code Extension

A visual interface for the **Copado Headless Agent** (`copado-hx` / `trinetra`) CLI.  
Manage stories, commit, promote, deploy, run tests, diagnose failures, and ask AI agents — all without leaving VS Code.

---

## 📦 Installation

### Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Node.js | 20 or later | `node -v` |
| VS Code | 1.85 or later | `code --version` |

### Step 1 — Clone the repository

```bash
git clone <repo-url>
cd Copado_Headless_Agent
```

### Step 2 — Install CLI dependencies

```bash
npm install
```

### Step 3 — Build the extension

```bash
cd vscode-extension
npm install
npm run compile
```

### Step 4 — Package as VSIX

```bash
npx vsce package --no-dependencies --allow-missing-repository
```

This creates `copado-hx-0.1.0.vsix` in the `vscode-extension/` folder.

### Step 5 — Install the extension

```bash
code --install-extension copado-hx-0.1.0.vsix --force
```

Then reload VS Code: press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux) → **Developer: Reload Window**.

### Step 6 — Open the Copado workspace

Open the root `Copado_Headless_Agent` folder in VS Code. The extension activates automatically when it detects `.copado-hx.json` in the workspace.

---

## 🔑 Environment Setup (`.env` file)

Create a `.env` file **in the root** of the `Copado_Headless_Agent` folder (same level as `package.json` and `.copado-hx.json`):

```
Copado_Headless_Agent/
├── .env                    ← put it here
├── .copado-hx.json
├── .copado-hx.state.json
├── package.json
├── src/
├── vscode-extension/
└── ...
```

### Required variables

The extension and CLI use three credential groups. Fill in only what you need:

#### 🔗 CI/CD Pipeline (commit, promote, deploy)

```env
COPADO_CICD_BASE_URL=https://your-copado-instance.my.salesforce.com
COPADO_CICD_TOKEN=your-session-id-or-access-token
```

#### 🤖 AI Gateway (AI agents)

```env
COPADO_AI_BASE_URL=https://your-ai-gateway-url
COPADO_AI_TOKEN=your-ai-token
COPADO_AI_ORGANIZATION_ID=your-org-id
COPADO_AI_WORKSPACE_ID=your-workspace-id
```

#### 🧪 CRT Testing (test run, status, results)

```env
COPADO_CRT_BASE_URL=https://your-crt-url
COPADO_CRT_TOKEN=your-crt-token
COPADO_CRT_ORGANIZATION_ID=your-org-id
COPADO_CRT_PROJECT_ID=your-project-id
```

> **Tip:** The Connection panel in the sidebar shows ✅ or ⚠️ for each credential group so you can see at a glance what's configured. Hover over any credential row for a detailed table of which env vars are set.

---

## 🖥️ Extension Overview

Once installed, a **Copado DevOps** icon appears in the Activity Bar (left sidebar). Click it to reveal six panels:

```
┌─────────────────────────────┐
│  ☁  Connection              │  ← mode, credentials, active story
│  📋 Stories                  │  ← list, select, view details
│  🚀 Pipeline                │  ← commit, promote, deploy
│  🧪 Testing                 │  ← run suites, track results
│  🔍 Doctor                  │  ← investigate failures
│  ✨ AI Agents               │  ← ask plan/build/test/release/operate
└─────────────────────────────┘
```

---

## ✨ Features

### 1. Connection Panel

| Item | Icon | What it shows |
|---|---|---|
| Runtime Mode | ☁️ / 🧪 | **Live** (connected to Salesforce) or **Mock** (offline sample data) |
| API Base URL | 🌐 | Your Salesforce instance URL |
| CI/CD Status | ✅ / ⚠️ | Whether `COPADO_CICD_BASE_URL` and `COPADO_CICD_TOKEN` are set |
| AI Gateway Status | ✅ / ⚠️ | Whether all 4 AI env vars are set |
| CRT Testing Status | ✅ / ⚠️ | Whether all 4 CRT env vars are set |
| Active Story | 🔖 | Currently selected story ID (click to view details) |

**Hover** any credential row to see a markdown table showing each env var's status.  
**Click** Mode to switch between Live and Mock.  
**Click** Active Story to jump to story details.

---

### 2. Stories Panel

| Action | Icon | Description |
|---|---|---|
| List Stories | 📄 | Fetches all user stories from Copado |
| Set Active Story | 📌 | Pick a story to work on (via quick-pick dropdown) |
| View Details | 👁️ | Opens a rich webview with story metadata |
| Replay Timeline | ⏱️ | Opens visual timeline for the story's operations |
| Refresh | 🔄 | Re-fetch the story list from the server |

Each story row shows:

```
★  US-0001 — Implement login [~]          ● active
   ├── Status: In Progress
   ├── Description: Add OAuth flow...
   ├── ☆ Set as Active
   ├── 👁 View Details
   └── ⏱ Replay Timeline
```

**Hover** a story to see ID, title, status, and description in a formatted card.  
**Click** a story to open the **Story Detail** webview panel in the editor.  
**Expand** a story to see child actions (set active, view details, replay).

---

### 3. Pipeline Panel

| Action | Icon | Description |
|---|---|---|
| Commit Changes | ✅ | Commits metadata to the active story (prompts for message) |
| Promote | ⬆️ | Promotes to a target environment (with optional validation) |
| Deploy | 🚀 | Deploys to a target environment (**PROD requires confirmation**) |

#### Environment Journey

A visual pipeline showing how far your changes have progressed:

```
  Environment Journey
   ├── dev             ○ pending
   ├── integration     ⬆ promoted
   ├── staging         ○ pending
   ├── uat             ○ pending
   └── prod            ○ pending
```

**Hover** an environment to see its stage status (deployed / promoted / pending).

#### Commit History

```
  Recent Commits (3)
   ├── fix: login redirect     6/3/2026, 10:30 AM
   ├── feat: OAuth flow        6/2/2026, 4:15 PM
   └── init: project setup     6/1/2026, 9:00 AM
```

**Hover** a commit for operation ID, story ID, and timestamp.  
**Click** a commit to open the **Replay Timeline** webview.

---

### 4. Testing Panel

| Action | Icon | Description |
|---|---|---|
| Run Test Suite | ▶️ | Triggers a CRT test suite (prompts for suite ID) |
| Check Status | 🔄 | Polls for latest execution status |
| View Results | ✅ | Shows pass/fail breakdown |

Executions are tracked in the sidebar:

```
  Executions (2)
   ├── suite-01 — exec-abc     [✅ passed]
   │   ├── Status: passed
   │   ├── Passed: 12
   │   ├── Failed: 0
   │   ├── 🔄 Refresh Status
   │   └── ✅ View Results
   └── suite-02 — exec-def     [❌ failed]
       ├── Status: failed
       ├── Passed: 8
       ├── Failed: 3
       ├── 🔄 Refresh Status
       └── ✅ View Results
```

**Hover** a test execution for suite ID, execution ID, status, and pass/fail counts.  
**Click** an execution to view its results.

---

### 5. Doctor Panel

| Action | Icon | Description |
|---|---|---|
| Investigate Deployment | 🐛 | Root-cause analysis for a failed deployment |
| Investigate Promotion | ⬆️ | Root-cause analysis for a failed promotion |
| Investigate Test | 🧪 | Root-cause analysis for a failed test |
| Investigate Commit | 📝 | Root-cause analysis for a failed commit |
| Why Did This Fail? | 💡 | Quick diagnosis from any entity ID |

The Doctor Engine:
- 📊 Collects evidence from Salesforce
- 📏 Applies diagnostic rules automatically
- 🎯 Provides root cause with confidence score
- 🪄 Suggests fix commands

---

### 6. AI Agents Panel

Five specialized agents, each accessible with one click:

| Agent | Icon | Purpose |
|---|---|---|
| **plan** | 🗺️ | Break work into actionable steps |
| **build** | 🛠️ | Implementation guidance and code suggestions |
| **test** | 🧪 | Testing strategy and coverage analysis |
| **release** | 🚀 | Release analysis and deployment outcomes |
| **operate** | 📈 | Operational notes and monitoring insights |

**Hover** an agent to see its description.  
**Click** an agent to open a prompt dialog — your question is sent to the AI gateway and the response appears in the Output panel.

---

### 7. Status Bar

Two persistent indicators at the bottom of VS Code:

```
┌────────────────────────────────────────────────────────────┐
│  ☁ Copado: Live                     🔖 US-0001            │
└────────────────────────────────────────────────────────────┘
```

| Item | What it shows |
|---|---|
| Mode badge | `☁ Live` or `🧪 Mock` — yellow background in mock mode as a reminder |
| Story badge | Active story ID — click to change |

---

### 8. Webview Panels

#### Story Detail Panel

Opens in the editor when you click a story. Shows:

- Story ID and title (large header)
- Status badge (color-coded)
- Full description
- Metadata table (project, environment, timestamps)

#### Replay Timeline Panel

Opens when you click a commit or choose "Replay Timeline". Shows:

- **Timeline** — chronological list of all events
- **Environment Journey** — visual stage progression with arrows
- **Metadata Changes** — added, modified, deleted components
- **Doctor Findings** — root cause, confidence, recommended actions
- **AI Insights** — agent analysis of the operation

---

### 9. Command Palette

All commands available via `Cmd+Shift+P` / `Ctrl+Shift+P`:

| Command | Category |
|---|---|
| `Copado: Login` | Auth |
| `Copado: Logout` | Auth |
| `Copado: Connection Status` | Auth |
| `Copado: List Stories` | Stories |
| `Copado: Set Active Story` | Stories |
| `Copado: Show Active Story` | Stories |
| `Copado: Show Story Details` | Stories |
| `Copado: Commit` | Pipeline |
| `Copado: Promote` | Pipeline |
| `Copado: Deploy` | Pipeline |
| `Copado: Run Test Suite` | Testing |
| `Copado: Check Test Status` | Testing |
| `Copado: View Test Results` | Testing |
| `Copado Doctor: Investigate Issue` | Doctor |
| `Copado Doctor: Why Did This Fail?` | Doctor |
| `Copado: Replay Timeline` | Replay |
| `Copado AI: Ask AI Agent` | AI |
| `Copado: Open Copado Terminal` | Utility |
| `Copado: Show Status Overview` | Utility |
| `Copado: Refresh Stories` | Utility |
| `Copado: Refresh Pipeline` | Utility |
| `Copado: Refresh Testing` | Utility |

---

## ⚙️ Settings

Configure via `Cmd+,` → search "Copado":

| Setting | Default | Description |
|---|---|---|
| `copado-hx.cliPath` | `npx` | Path to the CLI. Default runs via `npx tsx src/index.ts` |
| `copado-hx.autoRefreshInterval` | `30` | Auto-refresh interval in seconds |
| `copado-hx.showStatusBar` | `true` | Show/hide the status bar items |
| `copado-hx.defaultEnvironments` | `["dev","integration","staging","uat","prod"]` | Environments shown in the pipeline journey |

---

## 🛡️ Safety Features

| Feature | Description |
|---|---|
| **PROD deployment gate** | Modal confirmation dialog before deploying to production — must type confirm |
| **Promotion validation** | Option to run validation-only promotion before actual promotion |
| **Input validation** | Story IDs, commit messages, and URLs are validated before submission |
| **Progress notifications** | All long-running operations (commit, promote, deploy, test) show progress |
| **Credential isolation** | `.env` is never sent to the extension — only the CLI reads it at runtime |

---

## 🔄 Interaction Model

The extension mirrors the UX patterns of the built-in Git extension:

| Interaction | Behavior |
|---|---|
| **Hover** | Rich markdown tooltips with tables, status badges, and context |
| **Click** | Opens detail views in the editor (story detail, replay timeline, test results) |
| **Expand** | Shows child items with sub-actions |
| **Title bar buttons** | Quick actions (refresh, commit, run tests) in each panel's header |
| **Status bar** | Persistent mode and story indicators |
| **Command palette** | Full access to all 23 commands |

---

## 🚀 Quick Start

```
1.  Install the VSIX (see Installation above)
2.  Open the Copado_Headless_Agent folder in VS Code
3.  Create a .env file in the project root with your credentials
4.  Click the Copado icon in the Activity Bar
5.  Check the Connection panel — all credentials should show ✅
6.  Go to Stories → click a story to view details
7.  Set an active story → Commit → Promote → Deploy
```

---

## 🏗️ Development

```bash
cd vscode-extension
npm install
npm run watch          # auto-recompile on changes
```

Press **F5** in VS Code to launch an Extension Development Host with the extension loaded. Changes recompile automatically with the watch task.

---

## 📁 Project Structure

```
vscode-extension/
├── package.json              # Extension manifest (commands, views, menus)
├── tsconfig.json             # TypeScript config
├── media/
│   └── copado-sidebar.svg    # Activity bar icon
└── src/
    ├── extension.ts          # Entry point — registers everything
    ├── commands/
    │   ├── auth-commands.ts      # login, logout, status
    │   ├── story-commands.ts     # list, set, show, current
    │   ├── pipeline-commands.ts  # commit, promote, deploy
    │   ├── testing-commands.ts   # run, status, results
    │   ├── doctor-commands.ts    # investigate, why, replay
    │   └── ai-commands.ts        # ask agent
    ├── providers/
    │   ├── auth-provider.ts      # Connection tree
    │   ├── story-provider.ts     # Stories tree
    │   ├── pipeline-provider.ts  # Pipeline tree
    │   ├── testing-provider.ts   # Testing tree
    │   ├── doctor-provider.ts    # Doctor tree
    │   ├── ai-provider.ts        # AI Agents tree
    │   └── status-bar.ts         # Status bar items
    ├── services/
    │   └── state-reader.ts       # Reads .copado-hx.json, state, .env
    ├── utils/
    │   └── cli-runner.ts         # Spawns CLI commands, parses JSON
    └── webviews/
        ├── story-detail-panel.ts # Story detail editor panel
        └── replay-panel.ts       # Replay timeline editor panel
```
