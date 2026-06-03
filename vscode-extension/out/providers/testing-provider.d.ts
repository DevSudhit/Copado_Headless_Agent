import * as vscode from 'vscode';
interface TestExecution {
    executionId: string;
    suiteId: string;
    status: string;
    passed?: number;
    failed?: number;
    timestamp?: string;
}
export declare class TestingProvider implements vscode.TreeDataProvider<TestItem> {
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<TestItem | undefined>;
    private executions;
    refresh(): void;
    addExecution(execution: TestExecution): void;
    updateExecution(executionId: string, update: Partial<TestExecution>): void;
    getTreeItem(element: TestItem): vscode.TreeItem;
    getChildren(element?: TestItem): TestItem[];
    private statusIcon;
}
export declare class TestItem extends vscode.TreeItem {
    children?: TestItem[];
    static detail(label: string, icon: string): TestItem;
    static section(label: string, icon: string, children: TestItem[]): TestItem;
    static action(label: string, icon: string, command: string): TestItem;
}
export {};
