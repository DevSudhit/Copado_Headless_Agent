import * as vscode from 'vscode';
export declare class ReplayPanel {
    static currentPanel: ReplayPanel | undefined;
    private readonly panel;
    private disposables;
    static createOrShow(extensionUri: vscode.Uri, entityId: string, data: Record<string, unknown>): void;
    private constructor();
    private update;
    private getHtml;
}
