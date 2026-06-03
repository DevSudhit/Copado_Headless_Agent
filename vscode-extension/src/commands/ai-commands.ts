import * as vscode from 'vscode';
import { runCliJson, runCliInTerminal } from '../utils/cli-runner';

const AGENTS = ['plan', 'build', 'test', 'release', 'operate'];

export function registerAICommands(
    context: vscode.ExtensionContext
): void {

    context.subscriptions.push(
        vscode.commands.registerCommand('copado-hx.aiAsk', async (agentArg?: string) => {
            let agent = agentArg;
            if (!agent) {
                const pick = await vscode.window.showQuickPick(
                    AGENTS.map(a => ({
                        label: a,
                        description: agentDescription(a),
                    })),
                    { placeHolder: 'Select an AI agent' }
                );
                if (!pick) { return; }
                agent = pick.label;
            }

            const prompt = await vscode.window.showInputBox({
                prompt: `Ask the ${agent} agent`,
                placeHolder: 'Type your question or request...',
                validateInput: v => v.trim().length === 0 ? 'Prompt cannot be empty' : null,
            });
            if (!prompt) { return; }

            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: `Copado AI (${agent}): Thinking...`, cancellable: false },
                async () => {
                    const result = await runCliJson<{ data?: { agent: string; answer: string } }>([
                        'ai', 'ask', '--agent', agent!, prompt,
                    ]);
                    if (result?.data?.answer) {
                        // Show in output channel for easy reading
                        const channel = vscode.window.createOutputChannel('Copado AI', { log: true });
                        channel.appendLine(`━━━ ${agent!.toUpperCase()} AGENT ━━━`);
                        channel.appendLine(`Prompt: ${prompt}`);
                        channel.appendLine('');
                        channel.appendLine(result.data.answer);
                        channel.appendLine('');
                        channel.show();
                    }
                }
            );
        }),

        vscode.commands.registerCommand('copado-hx.openTerminal', () => {
            runCliInTerminal(['status']);
        }),

        vscode.commands.registerCommand('copado-hx.status', () => {
            runCliInTerminal(['status']);
        })
    );
}

function agentDescription(agent: string): string {
    switch (agent) {
        case 'plan': return 'Break work into actionable steps';
        case 'build': return 'Implementation guidance';
        case 'test': return 'Testing strategy & coverage';
        case 'release': return 'Release analysis & outcomes';
        case 'operate': return 'Operational notes & monitoring';
        default: return '';
    }
}
