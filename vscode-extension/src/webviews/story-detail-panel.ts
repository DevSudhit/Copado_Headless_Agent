import * as vscode from 'vscode';

export class StoryDetailPanel {
    public static currentPanel: StoryDetailPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];

    static createOrShow(extensionUri: vscode.Uri, storyId: string, data: Record<string, unknown>): void {
        const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

        if (StoryDetailPanel.currentPanel) {
            StoryDetailPanel.currentPanel.panel.reveal(column);
            StoryDetailPanel.currentPanel.update(storyId, data);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'copadoStoryDetail',
            `Story: ${storyId}`,
            column,
            { enableScripts: false }
        );

        StoryDetailPanel.currentPanel = new StoryDetailPanel(panel, storyId, data);
    }

    private constructor(panel: vscode.WebviewPanel, storyId: string, data: Record<string, unknown>) {
        this.panel = panel;
        this.update(storyId, data);

        this.panel.onDidDispose(() => {
            StoryDetailPanel.currentPanel = undefined;
            this.disposables.forEach(d => d.dispose());
        }, null, this.disposables);
    }

    private update(storyId: string, data: Record<string, unknown>): void {
        this.panel.title = `Story: ${storyId}`;
        this.panel.webview.html = this.getHtml(storyId, data);
    }

    private getHtml(storyId: string, data: Record<string, unknown>): string {
        const id = this.escapeHtml(storyId);
        const title = this.escapeHtml(String(data['title'] ?? ''));
        const status = this.escapeHtml(String(data['status'] ?? ''));
        const description = this.escapeHtml(String(data['description'] ?? data['summary'] ?? ''));

        const fields = Object.entries(data)
            .filter(([k]) => !['title', 'status', 'description', 'summary'].includes(k))
            .map(([k, v]) => `
                <tr>
                    <td class="field-label">${this.escapeHtml(k)}</td>
                    <td class="field-value">${this.escapeHtml(String(v))}</td>
                </tr>
            `).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Story ${id}</title>
    <style>
        body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 20px; }
        .header { border-bottom: 2px solid var(--vscode-panel-border); padding-bottom: 16px; margin-bottom: 20px; }
        .story-id { font-size: 14px; color: var(--vscode-descriptionForeground); margin-bottom: 4px; }
        .story-title { font-size: 22px; font-weight: 600; margin: 0; }
        .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-top: 8px; }
        .badge-progress { background: var(--vscode-charts-blue); color: white; }
        .badge-done { background: var(--vscode-charts-green); color: white; }
        .badge-default { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
        .description { margin: 20px 0; padding: 12px; background: var(--vscode-textBlockQuote-background); border-left: 3px solid var(--vscode-textBlockQuote-border); border-radius: 4px; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 8px 12px; border-bottom: 1px solid var(--vscode-panel-border); }
        .field-label { font-weight: 600; width: 30%; color: var(--vscode-descriptionForeground); }
        .field-value { color: var(--vscode-foreground); }
    </style>
</head>
<body>
    <div class="header">
        <div class="story-id">${id}</div>
        <h1 class="story-title">${title || 'Untitled Story'}</h1>
        <span class="badge ${status === 'In Progress' ? 'badge-progress' : status === 'Completed' ? 'badge-done' : 'badge-default'}">${status || 'Unknown'}</span>
    </div>
    ${description ? `<div class="description">${description}</div>` : ''}
    ${fields ? `<table>${fields}</table>` : ''}
</body>
</html>`;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}
