import * as vscode from 'vscode';
import { StateReader } from '../services/state-reader';
interface StoryData {
    id: string;
    title: string;
    status: string;
    description?: string;
}
export declare class StoryProvider implements vscode.TreeDataProvider<StoryItem> {
    private readonly stateReader;
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<StoryItem | undefined>;
    private stories;
    private loading;
    constructor(stateReader: StateReader);
    refresh(): void;
    getTreeItem(element: StoryItem): vscode.TreeItem;
    getChildren(element?: StoryItem): Promise<StoryItem[]>;
    private loadStories;
    private getStoryDetails;
}
export declare class StoryItem extends vscode.TreeItem {
    story: StoryData;
    constructor(story: StoryData, isActive: boolean);
    static detail(label: string, icon: string): StoryItem;
    static action(label: string, icon: string, command: string, storyId: string): StoryItem;
}
export {};
