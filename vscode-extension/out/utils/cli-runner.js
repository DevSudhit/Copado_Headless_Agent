"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCli = runCli;
exports.runCliJson = runCliJson;
exports.runCliInTerminal = runCliInTerminal;
const vscode = __importStar(require("vscode"));
const node_child_process_1 = require("node:child_process");
/**
 * Runs a copado-hx CLI command and returns the parsed output.
 * Always uses --json for machine-readable output.
 */
function runCli(args, cwd) {
    const config = vscode.workspace.getConfiguration('copado-hx');
    const cliPath = config.get('cliPath', 'copado-hx');
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
        (0, node_child_process_1.execFile)(cliPath, fullArgs, {
            cwd: workspaceFolder,
            timeout: 120_000,
            env: { ...process.env }
        }, (error, stdout, stderr) => {
            const exitCode = error?.code != null ? (typeof error.code === 'number' ? error.code : 1) : 0;
            resolve({ stdout: stdout ?? '', stderr: stderr ?? '', exitCode });
        });
    });
}
/**
 * Runs CLI and parses JSON output. Returns undefined on failure.
 */
async function runCliJson(args) {
    const result = await runCli(args);
    if (result.exitCode !== 0) {
        const errorMsg = tryParseError(result.stdout) ?? (result.stderr || `Command failed with exit code ${result.exitCode}`);
        vscode.window.showErrorMessage(`Copado: ${errorMsg}`);
        return undefined;
    }
    const jsonStart = result.stdout.indexOf('{');
    const jsonStr = jsonStart >= 0 ? result.stdout.substring(jsonStart) : result.stdout;
    try {
        return JSON.parse(jsonStr);
    }
    catch {
        return { summary: result.stdout };
    }
}
function tryParseError(stdout) {
    try {
        const parsed = JSON.parse(stdout);
        return parsed?.error ?? parsed?.message;
    }
    catch {
        return undefined;
    }
}
/**
 * Runs CLI in the integrated terminal (visible to user).
 */
function runCliInTerminal(args) {
    const config = vscode.workspace.getConfiguration('copado-hx');
    const cliPath = config.get('cliPath', 'copado-hx');
    const isNpx = cliPath === 'npx';
    const cmdArgs = isNpx ? ['copado-hx', ...args] : args;
    let terminal = vscode.window.terminals.find(t => t.name === 'Copado HX');
    if (!terminal) {
        terminal = vscode.window.createTerminal({ name: 'Copado HX' });
    }
    terminal.show();
    terminal.sendText(`${cliPath} ${cmdArgs.join(' ')}`);
}
//# sourceMappingURL=cli-runner.js.map