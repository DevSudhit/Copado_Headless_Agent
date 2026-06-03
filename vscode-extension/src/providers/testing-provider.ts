import * as vscode from 'vscode';

interface TestExecution {
    executionId: string;
    suiteId: string;
    status: string;
    passed?: number;
    failed?: number;
    timestamp?: string;
}

export class TestingProvider implements vscode.TreeDataProvider<TestItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<TestItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private executions: TestExecution[] = [];

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    addExecution(execution: TestExecution): void {
        this.executions.unshift(execution);
        if (this.executions.length > 20) {
            this.executions.pop();
        }
        this.refresh();
    }

    updateExecution(executionId: string, update: Partial<TestExecution>): void {
        const idx = this.executions.findIndex(e => e.executionId === executionId);
        if (idx >= 0) {
            this.executions[idx] = { ...this.executions[idx], ...update };
            this.refresh();
        }
    }

    getTreeItem(element: TestItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TestItem): TestItem[] {
        if (element) {
            return element.children ?? [];
        }

        const items: TestItem[] = [];

        // Actions
        items.push(TestItem.section('Run Tests', 'beaker', [
            TestItem.action('Run Test Suite', 'play', 'copado-hx.testRun'),
        ]));

        // Executions
        if (this.executions.length > 0) {
            const execItems = this.executions.map(e => {
                const statusIcon = this.statusIcon(e.status);
                const label = `${e.suiteId} — ${e.executionId}`;
                const children: TestItem[] = [
                    TestItem.detail(`Status: ${e.status}`, 'info'),
                ];
                if (e.passed != null || e.failed != null) {
                    children.push(TestItem.detail(`Passed: ${e.passed ?? 0}`, 'pass'));
                    children.push(TestItem.detail(`Failed: ${e.failed ?? 0}`, 'error'));
                }
                children.push(TestItem.action('Refresh Status', 'sync', 'copado-hx.testStatus'));
                children.push(TestItem.action('View Results', 'checklist', 'copado-hx.testResults'));
                const section = TestItem.section(label, statusIcon, children);
                // Rich tooltip on the execution row
                const md = new vscode.MarkdownString();
                md.appendMarkdown(`### Test Execution\n\n`);
                md.appendMarkdown(`| | |\n|---|---|\n`);
                md.appendMarkdown(`| Suite | \`${e.suiteId}\` |\n`);
                md.appendMarkdown(`| Execution | \`${e.executionId}\` |\n`);
                md.appendMarkdown(`| Status | **${e.status}** |\n`);
                if (e.passed != null) { md.appendMarkdown(`| Passed | ${e.passed} |\n`); }
                if (e.failed != null) { md.appendMarkdown(`| Failed | ${e.failed} |\n`); }
                if (e.timestamp) { md.appendMarkdown(`| Time | ${new Date(e.timestamp).toLocaleString()} |\n`); }
                md.appendMarkdown(`\n_Expand for actions_`);
                section.tooltip = md;
                // Click to view results
                section.command = { command: 'copado-hx.testResults', title: 'View Results', arguments: [e.executionId] };
                return section;
            });
            items.push(TestItem.section(`Executions (${this.executions.length})`, 'list-ordered', execItems));
        } else {
            items.push(TestItem.detail('No test executions yet', 'info'));
        }

        return items;
    }

    private statusIcon(status: string): string {
        switch (status) {
            case 'passed': return 'pass-filled';
            case 'failed': return 'error';
            case 'running': return 'sync~spin';
            case 'queued': return 'clock';
            default: return 'question';
        }
    }
}

export class TestItem extends vscode.TreeItem {
    children?: TestItem[];

    static detail(label: string, icon: string): TestItem {
        const item = new TestItem(label, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.contextValue = 'testDetail';
        return item;
    }

    static section(label: string, icon: string, children: TestItem[]): TestItem {
        const item = new TestItem(label, vscode.TreeItemCollapsibleState.Collapsed);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.children = children;
        item.contextValue = 'testSection';
        return item;
    }

    static action(label: string, icon: string, command: string): TestItem {
        const item = new TestItem(label, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.command = { command, title: label };
        item.contextValue = 'testAction';
        return item;
    }
}
