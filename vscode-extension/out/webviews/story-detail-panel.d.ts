import * as vscode from 'vscode';
export declare class StoryDetailPanel {
    static currentPanel: StoryDetailPanel | undefined;
    private readonly panel;
    private disposables;
    static createOrShow(extensionUri: vscode.Uri, storyId: string, data: Record<string, unknown>): void;
    private constructor();
    private update;
    private getHtml;
    private escapeHtml;
}
