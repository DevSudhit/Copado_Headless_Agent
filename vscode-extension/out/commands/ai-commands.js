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
exports.registerAICommands = registerAICommands;
const vscode = __importStar(require("vscode"));
const cli_runner_1 = require("../utils/cli-runner");
const AGENTS = ['plan', 'build', 'test', 'release', 'operate'];
function registerAICommands(context) {
    context.subscriptions.push(vscode.commands.registerCommand('copado-hx.aiAsk', async (agentArg) => {
        let agent = agentArg;
        if (!agent) {
            const pick = await vscode.window.showQuickPick(AGENTS.map(a => ({
                label: a,
                description: agentDescription(a),
            })), { placeHolder: 'Select an AI agent' });
            if (!pick) {
                return;
            }
            agent = pick.label;
        }
        const prompt = await vscode.window.showInputBox({
            prompt: `Ask the ${agent} agent`,
            placeHolder: 'Type your question or request...',
            validateInput: v => v.trim().length === 0 ? 'Prompt cannot be empty' : null,
        });
        if (!prompt) {
            return;
        }
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Copado AI (${agent}): Thinking...`, cancellable: false }, async () => {
            const result = await (0, cli_runner_1.runCliJson)([
                'ai', 'ask', '--agent', agent, prompt,
            ]);
            if (result?.data?.answer) {
                // Show in output channel for easy reading
                const channel = vscode.window.createOutputChannel('Copado AI', { log: true });
                channel.appendLine(`━━━ ${agent.toUpperCase()} AGENT ━━━`);
                channel.appendLine(`Prompt: ${prompt}`);
                channel.appendLine('');
                channel.appendLine(result.data.answer);
                channel.appendLine('');
                channel.show();
            }
        });
    }), vscode.commands.registerCommand('copado-hx.openTerminal', () => {
        (0, cli_runner_1.runCliInTerminal)(['status']);
    }), vscode.commands.registerCommand('copado-hx.status', () => {
        (0, cli_runner_1.runCliInTerminal)(['status']);
    }));
}
function agentDescription(agent) {
    switch (agent) {
        case 'plan': return 'Break work into actionable steps';
        case 'build': return 'Implementation guidance';
        case 'test': return 'Testing strategy & coverage';
        case 'release': return 'Release analysis & outcomes';
        case 'operate': return 'Operational notes & monitoring';
        default: return '';
    }
}
//# sourceMappingURL=ai-commands.js.map