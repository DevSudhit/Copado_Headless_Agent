import * as vscode from 'vscode';
import { StateReader } from '../services/state-reader';

export class PipelineProvider implements vscode.TreeDataProvider<PipelineItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<PipelineItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private readonly stateReader: StateReader) {
        stateReader.onDidChange(() => this._onDidChangeTreeData.fire(undefined));
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: PipelineItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: PipelineItem): PipelineItem[] {
        if (element) {
            return element.children ?? [];
        }

        const ctx = this.stateReader.getContext();
        const items: PipelineItem[] = [];

        // Active story section
        if (ctx.currentStoryId) {
            const storyTooltip = new vscode.MarkdownString();
            storyTooltip.appendMarkdown(`### Active Story\n\n**${ctx.currentStoryId}**\n\n_Click to view story details_`);
            const storyHeader = PipelineItem.header(`Story: ${ctx.currentStoryId}`, 'bookmark', storyTooltip);
            storyHeader.command = { command: 'copado-hx.storyShow', title: 'View Story', arguments: [ctx.currentStoryId] };
            items.push(storyHeader);
        } else {
            const noStoryTip = new vscode.MarkdownString(`No active story selected.\n\n_Run **Set Active Story** to get started_`);
            items.push(PipelineItem.header('No active story — set one first', 'warning', noStoryTip));
        }

        // Pipeline actions
        const actionsParent = PipelineItem.section('Actions', 'play', [
            PipelineItem.action('Commit Changes', 'check', 'copado-hx.commit'),
            PipelineItem.action('Promote to Environment', 'arrow-up', 'copado-hx.promote'),
            PipelineItem.action('Deploy to Environment', 'rocket', 'copado-hx.deploy'),
        ]);
        items.push(actionsParent);

        // Environment state
        const envItems: PipelineItem[] = [];
        const config = vscode.workspace.getConfiguration('copado-hx');
        const environments = config.get<string[]>('defaultEnvironments', ['dev', 'integration', 'staging', 'uat', 'prod']);

        for (const env of environments) {
            let icon = 'circle-outline';
            let status = 'pending';

            if (ctx.lastDeploymentEnvironment?.toLowerCase() === env.toLowerCase()) {
                icon = 'pass-filled';
                status = 'deployed';
            } else if (ctx.lastPromotionEnvironment?.toLowerCase() === env.toLowerCase()) {
                icon = 'arrow-circle-up';
                status = 'promoted';
            }

            const envTooltip = new vscode.MarkdownString();
            envTooltip.appendMarkdown(`### ${env}\n\n`);
            envTooltip.appendMarkdown(`**Status:** ${status}\n\n`);
            if (status === 'deployed') {
                envTooltip.appendMarkdown(`\u2705 Last deployment landed here`);
            } else if (status === 'promoted') {
                envTooltip.appendMarkdown(`\u2b06\ufe0f Promoted — awaiting deployment`);
            } else {
                envTooltip.appendMarkdown(`\u23f3 Not yet reached in the pipeline`);
            }

            envItems.push(PipelineItem.env(env, icon, status, envTooltip));
        }

        items.push(PipelineItem.section('Environment Journey', 'layers', envItems));

        // Commit history
        if (ctx.commitHistory && ctx.commitHistory.length > 0) {
            const commitItems = ctx.commitHistory
                .slice(-10)
                .reverse()
                .map(c => PipelineItem.commit(c.message, c.operationId ?? c.message, ctx.currentStoryId ?? '', c.timestamp));
            items.push(PipelineItem.section(`Recent Commits (${ctx.commitHistory.length})`, 'git-commit', commitItems));
        }

        return items;
    }
}

export class PipelineItem extends vscode.TreeItem {
    children?: PipelineItem[];

    static header(label: string, icon: string, mdTooltip?: vscode.MarkdownString): PipelineItem {
        const item = new PipelineItem(label, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.tooltip = mdTooltip ?? label;
        item.contextValue = 'pipelineInfo';
        return item;
    }

    static section(label: string, icon: string, children: PipelineItem[]): PipelineItem {
        const item = new PipelineItem(label, vscode.TreeItemCollapsibleState.Expanded);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.children = children;
        item.contextValue = 'pipelineSection';
        return item;
    }

    static action(label: string, icon: string, command: string): PipelineItem {
        const item = new PipelineItem(label, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.command = { command, title: label };
        item.contextValue = 'pipelineAction';
        const md = new vscode.MarkdownString(`_Click to ${label.toLowerCase()}_`);
        item.tooltip = md;
        return item;
    }

    static env(label: string, icon: string, status: string, mdTooltip?: vscode.MarkdownString): PipelineItem {
        const item = new PipelineItem(label, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.description = status;
        item.tooltip = mdTooltip ?? `${label}: ${status}`;
        item.contextValue = 'environment';
        return item;
    }

    static commit(message: string, operationId: string, storyId: string, timestamp: string): PipelineItem {
        const date = new Date(timestamp).toLocaleString();
        const item = new PipelineItem(message, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('git-commit');
        item.description = date;
        item.contextValue = 'operation';
        // Click to replay this commit
        item.command = { command: 'copado-hx.replay', title: 'Replay Commit', arguments: [operationId] };
        // Rich tooltip
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`### Commit\n\n`);
        md.appendMarkdown(`| | |\n|---|---|\n`);
        md.appendMarkdown(`| Message | ${message} |\n`);
        md.appendMarkdown(`| Operation | \`${operationId}\` |\n`);
        md.appendMarkdown(`| Story | ${storyId} |\n`);
        md.appendMarkdown(`| Time | ${date} |\n\n`);
        md.appendMarkdown(`_Click to replay this commit_`);
        item.tooltip = md;
        return item;
    }

    getTreeItem(): PipelineItem {
        return this;
    }

    getChildren(): PipelineItem[] {
        return this.children ?? [];
    }
}
