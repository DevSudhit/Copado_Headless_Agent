"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReplayPanel = void 0;
const vscode = __importStar(require("vscode"));
class ReplayPanel {
    static currentPanel;
    panel;
    disposables = [];
    static createOrShow(extensionUri, entityId, data) {
        const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
        if (ReplayPanel.currentPanel) {
            ReplayPanel.currentPanel.panel.reveal(column);
            ReplayPanel.currentPanel.update(entityId, data);
            return;
        }
        const panel = vscode.window.createWebviewPanel('copadoReplay', `Replay: ${entityId}`, column, { enableScripts: false });
        ReplayPanel.currentPanel = new ReplayPanel(panel, entityId, data);
    }
    constructor(panel, entityId, data) {
        this.panel = panel;
        this.update(entityId, data);
        this.panel.onDidDispose(() => {
            ReplayPanel.currentPanel = undefined;
            this.disposables.forEach(d => d.dispose());
        }, null, this.disposables);
    }
    update(entityId, data) {
        this.panel.title = `Replay: ${entityId}`;
        this.panel.webview.html = this.getHtml(entityId, data);
    }
    getHtml(entityId, data) {
        const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        // Header
        const outcomeClass = data.outcome === 'success' ? 'outcome-success' : data.outcome === 'failed' ? 'outcome-failed' : 'outcome-progress';
        const headerHtml = `
            <div class="header">
                <div class="entity-id">${esc(entityId)} · ${esc(data.entityType ?? 'unknown')}</div>
                <h1 class="title">${esc(data.storyTitle ?? 'Replay Timeline')}</h1>
                ${data.outcome ? `<span class="outcome ${outcomeClass}">${esc(data.outcome.toUpperCase())}</span>` : ''}
                ${data.currentState ? `<div class="current-state">${esc(data.currentState)}</div>` : ''}
                ${data.blockingIssue ? `<div class="blocking">⚠ ${esc(data.blockingIssue)}</div>` : ''}
            </div>
        `;
        // Timeline
        let timelineHtml = '';
        if (data.timeline && data.timeline.length > 0) {
            const events = data.timeline.map(e => {
                const icon = e.status === 'success' ? '✓' : e.status === 'failed' ? '✗' : e.status === 'warning' ? '⚠' : '●';
                const statusClass = `event-${e.status}`;
                const time = e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : '';
                const details = e.details?.map(d => `<div class="event-detail">└─ ${esc(d)}</div>`).join('') ?? '';
                return `
                    <div class="event ${statusClass}">
                        <div class="event-time">${esc(time)}</div>
                        <div class="event-icon">${icon}</div>
                        <div class="event-content">
                            <span class="event-source">[${esc(e.source.toUpperCase())}]</span>
                            <span class="event-category">${esc(e.category)}</span>
                            <span class="event-desc">${esc(e.description)}</span>
                            ${details}
                        </div>
                    </div>
                `;
            }).join('');
            timelineHtml = `<div class="section"><h2>Timeline</h2><div class="timeline">${events}</div></div>`;
        }
        // Environment Journey
        let envHtml = '';
        if (data.environmentJourney?.stages && data.environmentJourney.stages.length > 0) {
            const stages = data.environmentJourney.stages.map(s => {
                const icon = s.status === 'completed' ? '✓' : s.status === 'failed' ? '✗' : s.status === 'blocked' ? '⊘' : '○';
                return `<div class="stage stage-${s.status}"><span class="stage-icon">${icon}</span> ${esc(s.name)}</div>`;
            }).join('<div class="stage-arrow">↓</div>');
            envHtml = `<div class="section"><h2>Environment Journey</h2><div class="journey">${stages}</div></div>`;
        }
        // Metadata Changes
        let metaHtml = '';
        const mc = data.metadataChanges;
        if (mc && ((mc.added?.length ?? 0) > 0 || (mc.modified?.length ?? 0) > 0 || (mc.deleted?.length ?? 0) > 0)) {
            const items = [
                ...(mc.added ?? []).map(a => `<div class="meta-item meta-added">+ ${esc(a)}</div>`),
                ...(mc.modified ?? []).map(m => `<div class="meta-item meta-modified">~ ${esc(m)}</div>`),
                ...(mc.deleted ?? []).map(d => `<div class="meta-item meta-deleted">- ${esc(d)}</div>`),
            ].join('');
            metaHtml = `<div class="section"><h2>Metadata Changes</h2>${items}</div>`;
        }
        // Doctor Findings
        let doctorHtml = '';
        const df = data.doctorFindings;
        if (df) {
            const actions = df.recommendedActions?.map(a => `<li>${esc(a)}</li>`).join('') ?? '';
            doctorHtml = `
                <div class="section">
                    <h2>Doctor Findings</h2>
                    ${df.status ? `<div class="doctor-status">Status: <strong>${esc(df.status)}</strong></div>` : ''}
                    ${df.confidence ? `<div>Confidence: ${df.confidence}%</div>` : ''}
                    ${df.rootCause ? `<div class="doctor-root-cause">${esc(df.rootCause)}</div>` : ''}
                    ${actions ? `<ul class="doctor-actions">${actions}</ul>` : ''}
                </div>
            `;
        }
        // AI Insights
        let aiHtml = '';
        if (data.aiInsights) {
            aiHtml = `<div class="section"><h2>AI Insights</h2><div class="ai-insights">${esc(data.aiInsights)}</div></div>`;
        }
        // Fallback: raw summary
        let fallbackHtml = '';
        if (!timelineHtml && !envHtml && data.summary) {
            fallbackHtml = `<div class="section"><h2>Summary</h2><pre>${esc(data.summary)}</pre></div>`;
        }
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Replay: ${esc(entityId)}</title>
    <style>
        body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 20px; max-width: 900px; margin: 0 auto; }
        .header { border-bottom: 2px solid var(--vscode-panel-border); padding-bottom: 16px; margin-bottom: 24px; }
        .entity-id { font-size: 13px; color: var(--vscode-descriptionForeground); }
        .title { font-size: 22px; font-weight: 600; margin: 4px 0 8px; }
        .outcome { display: inline-block; padding: 3px 12px; border-radius: 12px; font-size: 12px; font-weight: 700; }
        .outcome-success { background: var(--vscode-charts-green); color: white; }
        .outcome-failed { background: var(--vscode-charts-red); color: white; }
        .outcome-progress { background: var(--vscode-charts-blue); color: white; }
        .current-state { margin-top: 8px; font-size: 13px; }
        .blocking { margin-top: 6px; color: var(--vscode-charts-orange); font-weight: 600; }
        .section { margin-bottom: 24px; }
        .section h2 { font-size: 16px; font-weight: 600; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 6px; margin-bottom: 12px; }
        /* Timeline */
        .timeline { position: relative; padding-left: 4px; }
        .event { display: flex; gap: 10px; padding: 6px 0; border-left: 2px solid var(--vscode-panel-border); padding-left: 12px; margin-left: 8px; }
        .event-time { min-width: 70px; font-size: 12px; color: var(--vscode-descriptionForeground); font-variant-numeric: tabular-nums; }
        .event-icon { min-width: 18px; font-weight: 700; text-align: center; }
        .event-success .event-icon { color: var(--vscode-charts-green); }
        .event-failed .event-icon { color: var(--vscode-charts-red); }
        .event-warning .event-icon { color: var(--vscode-charts-orange); }
        .event-source { font-size: 11px; padding: 1px 6px; border-radius: 3px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); margin-right: 6px; }
        .event-category { font-weight: 600; margin-right: 6px; }
        .event-detail { font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 2px; padding-left: 8px; }
        /* Journey */
        .journey { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
        .stage { display: flex; align-items: center; gap: 8px; padding: 6px 16px; border-radius: 6px; font-weight: 600; }
        .stage-completed { color: var(--vscode-charts-green); }
        .stage-failed { color: var(--vscode-charts-red); }
        .stage-pending { color: var(--vscode-descriptionForeground); }
        .stage-blocked { color: var(--vscode-charts-orange); }
        .stage-arrow { padding-left: 24px; color: var(--vscode-descriptionForeground); }
        /* Metadata */
        .meta-item { padding: 3px 8px; font-family: var(--vscode-editor-font-family); font-size: 13px; }
        .meta-added { color: var(--vscode-charts-green); }
        .meta-modified { color: var(--vscode-charts-blue); }
        .meta-deleted { color: var(--vscode-charts-red); text-decoration: line-through; }
        /* Doctor */
        .doctor-root-cause { margin: 8px 0; padding: 8px; background: var(--vscode-textBlockQuote-background); border-left: 3px solid var(--vscode-charts-orange); border-radius: 4px; }
        .doctor-actions { margin-top: 8px; }
        .doctor-actions li { padding: 3px 0; }
        /* AI */
        .ai-insights { padding: 12px; background: var(--vscode-textBlockQuote-background); border-left: 3px solid var(--vscode-charts-purple); border-radius: 4px; white-space: pre-wrap; }
        pre { background: var(--vscode-textBlockQuote-background); padding: 12px; border-radius: 4px; overflow-x: auto; white-space: pre-wrap; }
    </style>
</head>
<body>
    ${headerHtml}
    ${timelineHtml}
    ${envHtml}
    ${metaHtml}
    ${doctorHtml}
    ${aiHtml}
    ${fallbackHtml}
</body>
</html>`;
    }
}
exports.ReplayPanel = ReplayPanel;
//# sourceMappingURL=replay-panel.js.map