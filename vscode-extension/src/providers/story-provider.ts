import * as vscode from 'vscode';
import { StateReader } from '../services/state-reader';
import { runCliJson } from '../utils/cli-runner';

interface StoryData {
    id: string;
    title: string;
    status: string;
    description?: string;
}

interface StoryListOutput {
    summary: string;
    data?: StoryData[];
}

export class StoryProvider implements vscode.TreeDataProvider<StoryItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<StoryItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private stories: StoryData[] = [];
    private loading = false;

    constructor(private readonly stateReader: StateReader) {
        stateReader.onDidChange(() => this._onDidChangeTreeData.fire(undefined));
    }

    refresh(): void {
        this.stories = [];
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: StoryItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: StoryItem): Promise<StoryItem[]> {
        if (element) {
            return this.getStoryDetails(element.story);
        }

        if (this.stories.length === 0 && !this.loading) {
            await this.loadStories();
        }

        const ctx = this.stateReader.getContext();
        return this.stories.map(s => {
            const isActive = s.id === ctx.currentStoryId;
            return new StoryItem(s, isActive);
        });
    }

    private async loadStories(): Promise<void> {
        this.loading = true;
        try {
            const result = await runCliJson<StoryListOutput>(['story', 'list']);
            if (result?.data) {
                this.stories = result.data;
            }
        } finally {
            this.loading = false;
        }
    }

    private getStoryDetails(story: StoryData): StoryItem[] {
        const items: StoryItem[] = [];
        items.push(StoryItem.detail(`Status: ${story.status}`, 'info'));
        if (story.description) {
            items.push(StoryItem.detail(story.description, 'note'));
        }
        items.push(StoryItem.action('Set as Active', 'pin', 'copado-hx.storySet', story.id));
        items.push(StoryItem.action('View Details', 'open-preview', 'copado-hx.storyShow', story.id));
        items.push(StoryItem.action('Replay Timeline', 'history', 'copado-hx.replay', story.id));
        return items;
    }
}

export class StoryItem extends vscode.TreeItem {
    story: StoryData;

    constructor(story: StoryData, isActive: boolean) {
        const statusIcon = story.status === 'In Progress' ? '~' : story.status === 'Completed' ? '✓' : '○';
        super(`${story.id} — ${story.title} [${statusIcon}]`, vscode.TreeItemCollapsibleState.Collapsed);
        this.story = story;
        this.iconPath = new vscode.ThemeIcon(isActive ? 'star-full' : 'git-pull-request');
        this.contextValue = 'story';
        if (isActive) {
            this.description = '● active';
        }

        // Click to open story detail webview
        this.command = {
            command: 'copado-hx.storyShow',
            title: 'View Story Details',
            arguments: [story.id],
        };

        // Rich markdown tooltip
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`### ${story.id}\n\n`);
        md.appendMarkdown(`**${story.title}**\n\n`);
        md.appendMarkdown(`| | |\n|---|---|\n`);
        md.appendMarkdown(`| Status | ${story.status} |\n`);
        if (isActive) {
            md.appendMarkdown(`| Active | ✅ Currently selected |\n`);
        }
        if (story.description) {
            md.appendMarkdown(`\n${story.description}\n`);
        }
        md.appendMarkdown(`\n---\n_Click to open details  •  Expand for actions_`);
        this.tooltip = md;
    }

    static detail(label: string, icon: string): StoryItem {
        const item = new StoryItem({ id: '', title: '', status: '' }, false);
        item.label = label;
        item.iconPath = new vscode.ThemeIcon(icon);
        item.collapsibleState = vscode.TreeItemCollapsibleState.None;
        item.contextValue = 'storyDetail';
        item.command = undefined;
        item.tooltip = label;
        return item;
    }

    static action(label: string, icon: string, command: string, storyId: string): StoryItem {
        const item = StoryItem.detail(label, icon);
        item.command = { command, title: label, arguments: [storyId] };
        item.contextValue = 'storyAction';
        const md = new vscode.MarkdownString(`_Click to ${label.toLowerCase()}_`);
        item.tooltip = md;
        return item;
    }
}
