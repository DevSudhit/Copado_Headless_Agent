import * as vscode from 'vscode';
export declare class DoctorProvider implements vscode.TreeDataProvider<DoctorItem> {
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<DoctorItem | undefined>;
    refresh(): void;
    getTreeItem(element: DoctorItem): vscode.TreeItem;
    getChildren(element?: DoctorItem): DoctorItem[];
}
export declare class DoctorItem extends vscode.TreeItem {
    children?: DoctorItem[];
    static section(label: string, icon: string, children: DoctorItem[]): DoctorItem;
    static action(label: string, icon: string, command: string, ...args: string[]): DoctorItem;
    static detail(label: string, icon: string): DoctorItem;
}
