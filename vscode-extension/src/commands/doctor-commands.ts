import * as vscode from 'vscode';
import { runCliInTerminal, runCliJson } from '../utils/cli-runner';
import { ReplayPanel } from '../webviews/replay-panel';

export function registerDoctorCommands(
    context: vscode.ExtensionContext
): void {

    context.subscriptions.push(
        vscode.commands.registerCommand('copado-hx.doctorInvestigate', async (typeArg?: string) => {
            let targetType = typeArg;
            if (!targetType) {
                const pick = await vscode.window.showQuickPick(
                    [
                        { label: '$(bug) Deployment', value: 'deployment' },
                        { label: '$(arrow-up) Promotion', value: 'promotion' },
                        { label: '$(beaker) Test', value: 'test' },
                        { label: '$(git-commit) Commit', value: 'commit' },
                    ],
                    { placeHolder: 'What type of issue to investigate?' }
                );
                if (!pick) { return; }
                targetType = pick.value;
            }

            const targetId = await vscode.window.showInputBox({
                prompt: `Enter the ${targetType} ID to investigate`,
                placeHolder: targetType === 'deployment' ? 'DEP-...' :
                    targetType === 'promotion' ? 'PRO-...' :
                        targetType === 'test' ? 'EX-...' : 'COM-...',
            });
            if (!targetId) { return; }

            // Run in terminal for rich output
            runCliInTerminal(['doctor', targetType, targetId]);
        }),

        vscode.commands.registerCommand('copado-hx.doctorWhy', async () => {
            const targetId = await vscode.window.showInputBox({
                prompt: 'Enter an ID to investigate (auto-detects type from prefix)',
                placeHolder: 'DEP-..., PRO-..., EX-..., COM-..., US-...',
            });
            if (!targetId) { return; }

            runCliInTerminal(['why', targetId]);
        }),

        vscode.commands.registerCommand('copado-hx.replay', async (entityIdArg?: unknown) => {
            let entityId: string | undefined;
            if (typeof entityIdArg === 'string') {
                entityId = entityIdArg;
            } else if (entityIdArg && typeof entityIdArg === 'object') {
                const obj = entityIdArg as Record<string, unknown>;
                if (obj.story && typeof obj.story === 'object') {
                    entityId = (obj.story as Record<string, unknown>).id as string;
                } else if (typeof obj.id === 'string') {
                    entityId = obj.id;
                }
            }
            if (!entityId) {
                entityId = await vscode.window.showInputBox({
                    prompt: 'Enter an entity ID to replay',
                    placeHolder: 'US-1234, DEP-..., PRO-..., EX-..., COM-...',
                });
            }
            if (!entityId) { return; }

            const options = await vscode.window.showQuickPick(
                [
                    { label: '$(diff) Include metadata diff', value: '--diff', picked: false },
                    { label: '$(megaphone) Generate incident summary', value: '--incident', picked: false },
                    { label: '$(sparkle) AI analysis', value: '--ai', picked: false },
                ],
                { placeHolder: 'Replay options (optional)', canPickMany: true }
            );

            const args = ['replay', entityId];
            if (options) {
                for (const opt of options) {
                    args.push(opt.value);
                }
            }

            // Show in webview panel for rich display
            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: `Copado: Building replay for ${entityId}...`, cancellable: false },
                async () => {
                    const result = await runCliJson<Record<string, unknown>>(args);
                    if (result) {
                        ReplayPanel.createOrShow(context.extensionUri, entityId!, result);
                    }
                }
            );
        })
    );
}
