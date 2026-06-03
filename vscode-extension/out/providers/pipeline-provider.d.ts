import * as vscode from 'vscode';
import { StateReader } from '../services/state-reader';
export declare class PipelineProvider implements vscode.TreeDataProvider<PipelineItem> {
    private readonly stateReader;
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<PipelineItem | undefined>;
    constructor(stateReader: StateReader);
    refresh(): void;
    getTreeItem(element: PipelineItem): vscode.TreeItem;
    getChildren(element?: PipelineItem): PipelineItem[];
}
export declare class PipelineItem extends vscode.TreeItem {
    children?: PipelineItem[];
    static header(label: string, icon: string, mdTooltip?: vscode.MarkdownString): PipelineItem;
    static section(label: string, icon: string, children: PipelineItem[]): PipelineItem;
    static action(label: string, icon: string, command: string): PipelineItem;
    static env(label: string, icon: string, status: string, mdTooltip?: vscode.MarkdownString): PipelineItem;
    static commit(message: string, operationId: string, storyId: string, timestamp: string): PipelineItem;
    getTreeItem(): PipelineItem;
    getChildren(): PipelineItem[];
}
