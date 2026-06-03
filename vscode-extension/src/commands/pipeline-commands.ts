import * as vscode from 'vscode';
import { runCliJson, runCliInTerminal } from '../utils/cli-runner';
import { PipelineProvider } from '../providers/pipeline-provider';

export function registerPipelineCommands(
    context: vscode.ExtensionContext,
    pipelineProvider: PipelineProvider
): void {

    context.subscriptions.push(
        vscode.commands.registerCommand('copado-hx.commit', async () => {
            const message = await vscode.window.showInputBox({
                prompt: 'Commit message',
                placeHolder: 'Describe your changes...',
                validateInput: v => v.trim().length === 0 ? 'Message cannot be empty' : null,
            });
            if (!message) { return; }

            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'Copado: Committing...', cancellable: false },
                async () => {
                    const result = await runCliJson<{ summary: string }>(['commit', '--message', message]);
                    if (result) {
                        vscode.window.showInformationMessage(`Copado: ${result.summary ?? 'Commit successful'}`);
                        pipelineProvider.refresh();
                    }
                }
            );
        }),

        vscode.commands.registerCommand('copado-hx.promote', async () => {
            const config = vscode.workspace.getConfiguration('copado-hx');
            const environments = config.get<string[]>('defaultEnvironments', ['dev', 'integration', 'staging', 'uat', 'prod']);

            const env = await vscode.window.showQuickPick(
                environments.map(e => ({ label: e, description: `Promote to ${e}` })),
                { placeHolder: 'Select target environment for promotion' }
            );
            if (!env) { return; }

            const validate = await vscode.window.showQuickPick(
                [
                    { label: 'No', description: 'Promote without validation' },
                    { label: 'Yes', description: 'Request validation during promotion' },
                ],
                { placeHolder: 'Request validation?' }
            );

            const args = ['promote', '--env', env.label];
            if (validate?.label === 'Yes') {
                args.push('--validate');
            }

            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: `Copado: Promoting to ${env.label}...`, cancellable: false },
                async () => {
                    const result = await runCliJson<{ summary: string }>(args);
                    if (result) {
                        vscode.window.showInformationMessage(`Copado: ${result.summary ?? `Promoted to ${env.label}`}`);
                        pipelineProvider.refresh();
                    }
                }
            );
        }),

        vscode.commands.registerCommand('copado-hx.deploy', async () => {
            const config = vscode.workspace.getConfiguration('copado-hx');
            const environments = config.get<string[]>('defaultEnvironments', ['dev', 'integration', 'staging', 'uat', 'prod']);

            const env = await vscode.window.showQuickPick(
                environments.map(e => ({
                    label: e,
                    description: e.toLowerCase() === 'prod' ? '⚠ Requires approval' : `Deploy to ${e}`,
                })),
                { placeHolder: 'Select target environment for deployment' }
            );
            if (!env) { return; }

            const args = ['deploy', '--env', env.label];

            // PROD safety gate
            if (env.label.toLowerCase() === 'prod') {
                const confirm = await vscode.window.showWarningMessage(
                    'Deploying to PROD requires explicit approval. Are you sure?',
                    { modal: true },
                    'Approve & Deploy'
                );
                if (confirm !== 'Approve & Deploy') { return; }
                args.push('--approve');
            }

            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: `Copado: Deploying to ${env.label}...`, cancellable: false },
                async () => {
                    const result = await runCliJson<{ summary: string }>(args);
                    if (result) {
                        vscode.window.showInformationMessage(`Copado: ${result.summary ?? `Deployed to ${env.label}`}`);
                        pipelineProvider.refresh();
                    }
                }
            );
        }),

        vscode.commands.registerCommand('copado-hx.refreshPipeline', () => {
            pipelineProvider.refresh();
        })
    );
}
