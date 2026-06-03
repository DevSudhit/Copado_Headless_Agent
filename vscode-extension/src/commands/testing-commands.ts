import * as vscode from 'vscode';
import { runCliJson } from '../utils/cli-runner';
import { TestingProvider } from '../providers/testing-provider';

export function registerTestingCommands(
    context: vscode.ExtensionContext,
    testingProvider: TestingProvider
): void {

    context.subscriptions.push(
        vscode.commands.registerCommand('copado-hx.testRun', async () => {
            const suiteId = await vscode.window.showInputBox({
                prompt: 'Test suite ID to run',
                placeHolder: 'smoke',
            });
            if (!suiteId) { return; }

            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: `Copado: Running test suite "${suiteId}"...`, cancellable: false },
                async () => {
                    const result = await runCliJson<{ data?: { executionId: string; suiteId: string; status: string } }>(['test', 'run', '--suite', suiteId]);
                    if (result?.data) {
                        testingProvider.addExecution({
                            executionId: result.data.executionId,
                            suiteId: result.data.suiteId,
                            status: result.data.status,
                            timestamp: new Date().toISOString(),
                        });
                        vscode.window.showInformationMessage(`Copado: Test suite queued — ${result.data.executionId}`);
                    }
                }
            );
        }),

        vscode.commands.registerCommand('copado-hx.testStatus', async (executionIdArg?: string) => {
            let executionId = executionIdArg;
            if (!executionId) {
                executionId = await vscode.window.showInputBox({
                    prompt: 'Execution ID to check',
                    placeHolder: 'EX-...',
                });
            }
            if (!executionId) { return; }

            const result = await runCliJson<{ data?: { executionId: string; status: string } }>(['test', 'status', '--execution', executionId]);
            if (result?.data) {
                testingProvider.updateExecution(executionId, { status: result.data.status });
                vscode.window.showInformationMessage(`Copado: Test ${executionId} — ${result.data.status}`);
            }
        }),

        vscode.commands.registerCommand('copado-hx.testResults', async (executionIdArg?: string) => {
            let executionId = executionIdArg;
            if (!executionId) {
                executionId = await vscode.window.showInputBox({
                    prompt: 'Execution ID for results',
                    placeHolder: 'EX-...',
                });
            }
            if (!executionId) { return; }

            const result = await runCliJson<{ data?: { executionId: string; status: string; passed?: number; failed?: number } }>(['test', 'results', '--execution', executionId]);
            if (result?.data) {
                testingProvider.updateExecution(executionId, {
                    status: result.data.status,
                    passed: result.data.passed,
                    failed: result.data.failed,
                });
                const msg = `Tests: ${result.data.passed ?? 0} passed, ${result.data.failed ?? 0} failed`;
                if (result.data.failed && result.data.failed > 0) {
                    vscode.window.showWarningMessage(`Copado: ${msg}`);
                } else {
                    vscode.window.showInformationMessage(`Copado: ${msg}`);
                }
            }
        }),

        vscode.commands.registerCommand('copado-hx.refreshTesting', () => {
            testingProvider.refresh();
        })
    );
}
