import * as vscode from 'vscode';
import { StateReader } from '../services/state-reader';
export declare class AuthProvider implements vscode.TreeDataProvider<AuthItem> {
    private readonly stateReader;
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<AuthItem | undefined>;
    private _liveStatus;
    constructor(stateReader: StateReader);
    refresh(): void;
    private loadLiveStatus;
    getTreeItem(element: AuthItem): vscode.TreeItem;
    getChildren(): AuthItem[];
}
declare class AuthItem extends vscode.TreeItem {
    static create(label: string, icon: string, tooltip: string | vscode.MarkdownString, command?: string, ...args: string[]): AuthItem;
}
export {};
