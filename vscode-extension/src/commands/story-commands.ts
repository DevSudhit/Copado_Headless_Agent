import * as vscode from 'vscode';
import { runCliJson, runCliInTerminal } from '../utils/cli-runner';
import { StoryProvider } from '../providers/story-provider';
import { StoryDetailPanel } from '../webviews/story-detail-panel';

/** Extract story ID from a string arg or a StoryItem tree node. */
function resolveStoryId(arg: unknown): string | undefined {
    if (typeof arg === 'string') { return arg; }
    if (arg && typeof arg === 'object') {
        const obj = arg as Record<string, unknown>;
        // StoryItem has .story.id
        if (obj.story && typeof obj.story === 'object') {
            const story = obj.story as Record<string, unknown>;
            if (typeof story.id === 'string' && story.id) { return story.id; }
        }
        // fallback: direct .id
        if (typeof obj.id === 'string' && obj.id) { return obj.id; }
    }
    return undefined;
}

export function registerStoryCommands(
    context: vscode.ExtensionContext,
    storyProvider: StoryProvider
): void {

    context.subscriptions.push(
        vscode.commands.registerCommand('copado-hx.storyList', async () => {
            storyProvider.refresh();
            vscode.window.showInformationMessage('Copado: Stories refreshed');
        }),

        vscode.commands.registerCommand('copado-hx.storySet', async (storyIdArg?: unknown) => {
            let storyId = resolveStoryId(storyIdArg);
            if (!storyId) {
                storyId = await vscode.window.showInputBox({
                    prompt: 'Enter the story ID to set as active',
                    placeHolder: 'US-1234',
                });
            }
            if (!storyId) { return; }

            const result = await runCliJson<{ summary: string }>(['story', 'set', '--id', storyId]);
            if (result) {
                vscode.window.showInformationMessage(`Copado: Active story set to ${storyId}`);
                storyProvider.refresh();
                // Fire a global event for status bar
                vscode.commands.executeCommand('copado-hx.refreshPipeline');
            }
        }),

        vscode.commands.registerCommand('copado-hx.storyCurrent', async () => {
            runCliInTerminal(['story', 'current']);
        }),

        vscode.commands.registerCommand('copado-hx.storyShow', async (storyIdArg?: unknown) => {
            let storyId = resolveStoryId(storyIdArg);
            if (!storyId) {
                storyId = await vscode.window.showInputBox({
                    prompt: 'Enter the story ID to view',
                    placeHolder: 'US-1234',
                });
            }
            if (!storyId) { return; }

            const result = await runCliJson<{ summary: string; data?: Record<string, unknown> }>(['story', 'show', '--id', storyId]);
            if (result) {
                StoryDetailPanel.createOrShow(context.extensionUri, storyId, result.data ?? { summary: result.summary });
            }
        }),

        vscode.commands.registerCommand('copado-hx.refreshStories', () => {
            storyProvider.refresh();
        })
    );
}
