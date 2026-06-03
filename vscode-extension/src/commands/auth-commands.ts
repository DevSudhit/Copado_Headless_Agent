import * as vscode from 'vscode';
import { runCliJson, runCliInTerminal } from '../utils/cli-runner';
import { AuthProvider } from '../providers/auth-provider';

export function registerAuthCommands(
    context: vscode.ExtensionContext,
    authProvider: AuthProvider
): void {

    context.subscriptions.push(
        // "Login" now just shows the live connection status — no prompts needed.
        // The CLI auto-detects live mode via sf CLI session + env vars.
        vscode.commands.registerCommand('copado-hx.authLogin', async () => {
            const result = await runCliJson<{ summary: string }>(['auth', 'status']);
            if (result) {
                vscode.window.showInformationMessage(`Copado: ${result.summary ?? 'Connected'}`);
                authProvider.refresh();
            }
        }),

        vscode.commands.registerCommand('copado-hx.authLogout', async () => {
            vscode.window.showInformationMessage(
                'To disconnect, run: sf org logout --target-org copadotrial'
            );
        }),

        vscode.commands.registerCommand('copado-hx.authStatus', async () => {
            runCliInTerminal(['auth', 'status']);
        })
    );
}
