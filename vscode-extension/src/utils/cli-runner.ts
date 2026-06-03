import * as vscode from 'vscode';
import { execFile } from 'node:child_process';
import type { ExecFileException } from 'node:child_process';

export interface CliResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

/**
 * Runs a copado-hx CLI command and returns the parsed output.
 * Always uses --json for machine-readable output.
 */
export function runCli(args: string[], cwd?: string): Promise<CliResult> {
    const config = vscode.workspace.getConfiguration('copado-hx');
    const cliPath = config.get<string>('cliPath', 'copado-hx');
    const workspaceFolder = cwd ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    return new Promise((resolve, reject) => {
        if (!workspaceFolder) {
            reject(new Error('No workspace folder open'));
            return;
        }

        // When cliPath is 'npx', prepend 'copado-hx' so npx knows what package to run.
        const isNpx = cliPath === 'npx';
        const fullArgs = isNpx
            ? ['copado-hx', '--json', ...args]
            : ['--json', ...args];

        execFile(cliPath, fullArgs, {
            cwd: workspaceFolder,
            timeout: 120_000,
            env: { ...process.env }
        }, (error: ExecFileException | null, stdout: string, stderr: string) => {
            const exitCode = error?.code != null ? (typeof error.code === 'number' ? error.code : 1) : 0;
            resolve({ stdout: stdout ?? '', stderr: stderr ?? '', exitCode });
        });
    });
}

/**
 * Runs CLI and parses JSON output. Returns undefined on failure.
 */
export async function runCliJson<T>(args: string[]): Promise<T | undefined> {
    const result = await runCli(args);
    if (result.exitCode !== 0) {
        const errorMsg = tryParseError(result.stdout) ?? (result.stderr || `Command failed with exit code ${result.exitCode}`);
        vscode.window.showErrorMessage(`Copado: ${errorMsg}`);
        return undefined;
    }
    const jsonStart = result.stdout.indexOf('{');
    const jsonStr = jsonStart >= 0 ? result.stdout.substring(jsonStart) : result.stdout;
    try {
        return JSON.parse(jsonStr) as T;
    } catch {
        return { summary: result.stdout } as T;
    }
}

function tryParseError(stdout: string): string | undefined {
    try {
        const parsed = JSON.parse(stdout);
        return parsed?.error ?? parsed?.message;
    } catch {
        return undefined;
    }
}

/**
 * Runs CLI in the integrated terminal (visible to user).
 */
export function runCliInTerminal(args: string[]): void {
    const config = vscode.workspace.getConfiguration('copado-hx');
    const cliPath = config.get<string>('cliPath', 'copado-hx');
    const isNpx = cliPath === 'npx';
    const cmdArgs = isNpx ? ['copado-hx', ...args] : args;

    let terminal = vscode.window.terminals.find(t => t.name === 'Copado HX');
    if (!terminal) {
        terminal = vscode.window.createTerminal({ name: 'Copado HX' });
    }
    terminal.show();
    terminal.sendText(`${cliPath} ${cmdArgs.join(' ')}`);
}

