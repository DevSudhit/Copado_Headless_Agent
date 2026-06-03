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
exports.StoryItem = exports.StoryProvider = void 0;
const vscode = __importStar(require("vscode"));
const cli_runner_1 = require("../utils/cli-runner");
class StoryProvider {
    stateReader;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    stories = [];
    loading = false;
    constructor(stateReader) {
        this.stateReader = stateReader;
        stateReader.onDidChange(() => this._onDidChangeTreeData.fire(undefined));
    }
    refresh() {
        this.stories = [];
        this._onDidChangeTreeData.fire(undefined);
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
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
    async loadStories() {
        this.loading = true;
        try {
            const result = await (0, cli_runner_1.runCliJson)(['story', 'list']);
            if (result?.data) {
                this.stories = result.data;
            }
        }
        finally {
            this.loading = false;
        }
    }
    getStoryDetails(story) {
        const items = [];
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
exports.StoryProvider = StoryProvider;
class StoryItem extends vscode.TreeItem {
    story;
    constructor(story, isActive) {
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
    static detail(label, icon) {
        const item = new StoryItem({ id: '', title: '', status: '' }, false);
        item.label = label;
        item.iconPath = new vscode.ThemeIcon(icon);
        item.collapsibleState = vscode.TreeItemCollapsibleState.None;
        item.contextValue = 'storyDetail';
        item.command = undefined;
        item.tooltip = label;
        return item;
    }
    static action(label, icon, command, storyId) {
        const item = StoryItem.detail(label, icon);
        item.command = { command, title: label, arguments: [storyId] };
        item.contextValue = 'storyAction';
        const md = new vscode.MarkdownString(`_Click to ${label.toLowerCase()}_`);
        item.tooltip = md;
        return item;
    }
}
exports.StoryItem = StoryItem;
//# sourceMappingURL=story-provider.js.map