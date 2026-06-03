import * as vscode from 'vscode';

const AI_AGENTS = [
    { name: 'plan', icon: 'map', desc: 'Break work into actionable steps' },
    { name: 'build', icon: 'tools', desc: 'Implementation guidance' },
    { name: 'test', icon: 'beaker', desc: 'Testing strategy & coverage' },
    { name: 'release', icon: 'rocket', desc: 'Release analysis & outcomes' },
    { name: 'operate', icon: 'pulse', desc: 'Operational notes & monitoring' },
] as const;

export class AIProvider implements vscode.TreeDataProvider<AIItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<AIItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: AIItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: AIItem): AIItem[] {
        if (element) {
            return element.children ?? [];
        }

        const agentItems = AI_AGENTS.map(a =>
            AIItem.action(a.name, a.icon, a.desc, 'copado-hx.aiAsk', a.name)
        );

        return [
            AIItem.section('Ask an Agent', 'sparkle', agentItems),
            AIItem.section('Available Agents', 'info', AI_AGENTS.map(a =>
                AIItem.detail(`${a.name}: ${a.desc}`, a.icon)
            )),
        ];
    }
}

export class AIItem extends vscode.TreeItem {
    children?: AIItem[];

    static detail(label: string, icon: string): AIItem {
        const item = new AIItem(label, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.contextValue = 'aiDetail';
        return item;
    }

    static section(label: string, icon: string, children: AIItem[]): AIItem {
        const item = new AIItem(label, vscode.TreeItemCollapsibleState.Expanded);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.children = children;
        item.contextValue = 'aiSection';
        return item;
    }

    static action(label: string, icon: string, description: string, command: string, ...args: string[]): AIItem {
        const item = new AIItem(label, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.description = description;
        item.command = { command, title: label, arguments: args };
        item.contextValue = 'aiAction';
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`### ${label} Agent\n\n`);
        md.appendMarkdown(`${description}\n\n`);
        md.appendMarkdown(`_Click to ask this agent a question_`);
        item.tooltip = md;
        return item;
    }
}
