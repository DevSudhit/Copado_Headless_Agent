import * as vscode from 'vscode';
export declare class AIProvider implements vscode.TreeDataProvider<AIItem> {
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<AIItem | undefined>;
    refresh(): void;
    getTreeItem(element: AIItem): vscode.TreeItem;
    getChildren(element?: AIItem): AIItem[];
}
export declare class AIItem extends vscode.TreeItem {
    children?: AIItem[];
    static detail(label: string, icon: string): AIItem;
    static section(label: string, icon: string, children: AIItem[]): AIItem;
    static action(label: string, icon: string, description: string, command: string, ...args: string[]): AIItem;
}
