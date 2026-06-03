import * as vscode from 'vscode';
import { StateReader } from '../services/state-reader';
import { runCliJson } from '../utils/cli-runner';

interface LiveAuthStatus {
    runtimeMode?: string;
    sfCliConnected?: boolean;
    sfOrgAlias?: string;
    aiConnected?: boolean;
    crtConnected?: boolean;
    cicdConnected?: boolean;
}

export class AuthProvider implements vscode.TreeDataProvider<AuthItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<AuthItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private _liveStatus: LiveAuthStatus = {};

    constructor(private readonly stateReader: StateReader) {
        stateReader.onDidChange(() => this.refresh());
        this.loadLiveStatus();
    }

    refresh(): void {
        this.loadLiveStatus();
    }

    private loadLiveStatus(): void {
        runCliJson<{ data: LiveAuthStatus }>(['auth', 'status']).then(result => {
            this._liveStatus = result?.data ?? {};
            this._onDidChangeTreeData.fire(undefined);
        }).catch(() => {
            this._onDidChangeTreeData.fire(undefined);
        });
    }

    getTreeItem(element: AuthItem): vscode.TreeItem {
        return element;
    }

    getChildren(): AuthItem[] {
        const items: AuthItem[] = [];
        const status = this._liveStatus;
        const isLive = status.runtimeMode === 'live';

        // Runtime mode
        items.push(AuthItem.create(
            `Mode: ${isLive ? 'LIVE' : 'MOCK'}`,
            isLive ? 'cloud' : 'beaker',
            new vscode.MarkdownString(isLive
                ? `**Live mode** — connected to Copado org via Salesforce CLI`
                : `**Mock mode** — run \`sf org login web --alias copadotrial\` to connect`),
            'copado-hx.authStatus'
        ));

        // Salesforce CLI
        items.push(AuthItem.create(
            `Salesforce CLI: ${status.sfCliConnected ? `connected (${status.sfOrgAlias})` : 'not connected'}`,
            status.sfCliConnected ? 'pass-filled' : 'warning',
            new vscode.MarkdownString(status.sfCliConnected
                ? `✅ **sf CLI** connected to \`${status.sfOrgAlias}\`\n\nUsed by: commit, promote, deploy, story list`
                : `❌ Run \`sf org login web --alias copadotrial\` to connect`)
        ));

        // AI
        items.push(AuthItem.create(
            `Copado AI: ${status.aiConnected ? 'connected' : 'not connected'}`,
            status.aiConnected ? 'pass-filled' : 'warning',
            new vscode.MarkdownString(status.aiConnected
                ? `✅ **Copado AI** connected\n\nUsed by: ai ask (plan, build, test, release, operate)`
                : `❌ Set \`COPADO_AI_TOKEN\`, \`COPADO_AI_ORGANIZATION_ID\`, \`COPADO_AI_WORKSPACE_ID\` in \`.env\``)
        ));

        // CRT
        items.push(AuthItem.create(
            `CRT Testing: ${status.crtConnected ? 'connected' : 'not connected'}`,
            status.crtConnected ? 'pass-filled' : 'warning',
            new vscode.MarkdownString(status.crtConnected
                ? `✅ **Copado CRT** connected\n\nUsed by: test run, test status, test results`
                : `❌ Set \`COPADO_CRT_TOKEN\`, \`COPADO_CRT_PROJECT_ID\` in \`.env\``)
        ));

        // Active story
        const ctx = this.stateReader.getContext();
        if (ctx.currentStoryId) {
            const storyTooltip = new vscode.MarkdownString();
            storyTooltip.appendMarkdown(`### Active Story\n\n**${ctx.currentStoryId}**\n\n`);
            if (ctx.lastPromotionEnvironment) {
                storyTooltip.appendMarkdown(`Last promoted to: **${ctx.lastPromotionEnvironment}**\n\n`);
            }
            if (ctx.lastDeploymentEnvironment) {
                storyTooltip.appendMarkdown(`Last deployed to: **${ctx.lastDeploymentEnvironment}**\n\n`);
            }
            items.push(AuthItem.create(
                `Active: ${ctx.currentStoryId}`,
                'bookmark',
                storyTooltip,
                'copado-hx.storyShow',
                ctx.currentStoryId
            ));
        }

        return items;
    }
}

class AuthItem extends vscode.TreeItem {
    static create(label: string, icon: string, tooltip: string | vscode.MarkdownString, command?: string, ...args: string[]): AuthItem {
        const item = new AuthItem(label, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.tooltip = tooltip;
        if (command) {
            item.command = { command, title: label, arguments: args.length > 0 ? args : undefined };
        }
        return item;
    }
}
