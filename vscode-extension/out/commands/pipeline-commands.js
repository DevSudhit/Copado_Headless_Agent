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
exports.registerPipelineCommands = registerPipelineCommands;
const vscode = __importStar(require("vscode"));
const cli_runner_1 = require("../utils/cli-runner");
function registerPipelineCommands(context, pipelineProvider) {
    context.subscriptions.push(vscode.commands.registerCommand('copado-hx.commit', async () => {
        const message = await vscode.window.showInputBox({
            prompt: 'Commit message',
            placeHolder: 'Describe your changes...',
            validateInput: v => v.trim().length === 0 ? 'Message cannot be empty' : null,
        });
        if (!message) {
            return;
        }
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Copado: Committing...', cancellable: false }, async () => {
            const result = await (0, cli_runner_1.runCliJson)(['commit', '--message', message]);
            if (result) {
                vscode.window.showInformationMessage(`Copado: ${result.summary ?? 'Commit successful'}`);
                pipelineProvider.refresh();
            }
        });
    }), vscode.commands.registerCommand('copado-hx.promote', async () => {
        const config = vscode.workspace.getConfiguration('copado-hx');
        const environments = config.get('defaultEnvironments', ['dev', 'integration', 'staging', 'uat', 'prod']);
        const env = await vscode.window.showQuickPick(environments.map(e => ({ label: e, description: `Promote to ${e}` })), { placeHolder: 'Select target environment for promotion' });
        if (!env) {
            return;
        }
        const validate = await vscode.window.showQuickPick([
            { label: 'No', description: 'Promote without validation' },
            { label: 'Yes', description: 'Request validation during promotion' },
        ], { placeHolder: 'Request validation?' });
        const args = ['promote', '--env', env.label];
        if (validate?.label === 'Yes') {
            args.push('--validate');
        }
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Copado: Promoting to ${env.label}...`, cancellable: false }, async () => {
            const result = await (0, cli_runner_1.runCliJson)(args);
            if (result) {
                vscode.window.showInformationMessage(`Copado: ${result.summary ?? `Promoted to ${env.label}`}`);
                pipelineProvider.refresh();
            }
        });
    }), vscode.commands.registerCommand('copado-hx.deploy', async () => {
        const config = vscode.workspace.getConfiguration('copado-hx');
        const environments = config.get('defaultEnvironments', ['dev', 'integration', 'staging', 'uat', 'prod']);
        const env = await vscode.window.showQuickPick(environments.map(e => ({
            label: e,
            description: e.toLowerCase() === 'prod' ? '⚠ Requires approval' : `Deploy to ${e}`,
        })), { placeHolder: 'Select target environment for deployment' });
        if (!env) {
            return;
        }
        const args = ['deploy', '--env', env.label];
        // PROD safety gate
        if (env.label.toLowerCase() === 'prod') {
            const confirm = await vscode.window.showWarningMessage('Deploying to PROD requires explicit approval. Are you sure?', { modal: true }, 'Approve & Deploy');
            if (confirm !== 'Approve & Deploy') {
                return;
            }
            args.push('--approve');
        }
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Copado: Deploying to ${env.label}...`, cancellable: false }, async () => {
            const result = await (0, cli_runner_1.runCliJson)(args);
            if (result) {
                vscode.window.showInformationMessage(`Copado: ${result.summary ?? `Deployed to ${env.label}`}`);
                pipelineProvider.refresh();
            }
        });
    }), vscode.commands.registerCommand('copado-hx.refreshPipeline', () => {
        pipelineProvider.refresh();
    }));
}
//# sourceMappingURL=pipeline-commands.js.map