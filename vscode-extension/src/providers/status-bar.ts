import * as vscode from 'vscode';
import { StateReader } from '../services/state-reader';

export class CopadoStatusBar {
    private storyItem: vscode.StatusBarItem;
    private modeItem: vscode.StatusBarItem;

    constructor(private readonly stateReader: StateReader) {
        this.modeItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.modeItem.command = 'copado-hx.authLogin';
        this.modeItem.tooltip = 'Copado: Click to change runtime mode';

        this.storyItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
        this.storyItem.command = 'copado-hx.storySet';
        this.storyItem.tooltip = 'Copado: Click to change active story';

        stateReader.onDidChange(() => this.update());
        this.update();
    }

    update(): void {
        const config = this.stateReader.getConfig();
        const ctx = this.stateReader.getContext();
        const showStatusBar = vscode.workspace.getConfiguration('copado-hx').get<boolean>('showStatusBar', true);

        if (!showStatusBar) {
            this.modeItem.hide();
            this.storyItem.hide();
            return;
        }

        // Mode indicator
        if (config.runtimeMode === 'live') {
            this.modeItem.text = '$(cloud) Copado Live';
            this.modeItem.backgroundColor = undefined;
        } else {
            this.modeItem.text = '$(beaker) Copado Mock';
            this.modeItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
        this.modeItem.show();

        // Active story
        if (ctx.currentStoryId) {
            this.storyItem.text = `$(bookmark) ${ctx.currentStoryId}`;
            this.storyItem.tooltip = `Active story: ${ctx.currentStoryId}\nLast promote: ${ctx.lastPromotionEnvironment ?? '—'}\nLast deploy: ${ctx.lastDeploymentEnvironment ?? '—'}`;
        } else {
            this.storyItem.text = '$(bookmark) No story';
            this.storyItem.tooltip = 'Click to set an active story';
        }
        this.storyItem.show();
    }

    dispose(): void {
        this.storyItem.dispose();
        this.modeItem.dispose();
    }
}
