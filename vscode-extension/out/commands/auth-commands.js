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
exports.registerAuthCommands = registerAuthCommands;
const vscode = __importStar(require("vscode"));
const cli_runner_1 = require("../utils/cli-runner");
function registerAuthCommands(context, authProvider) {
    context.subscriptions.push(
    // "Login" now just shows the live connection status — no prompts needed.
    // The CLI auto-detects live mode via sf CLI session + env vars.
    vscode.commands.registerCommand('copado-hx.authLogin', async () => {
        const result = await (0, cli_runner_1.runCliJson)(['auth', 'status']);
        if (result) {
            vscode.window.showInformationMessage(`Copado: ${result.summary ?? 'Connected'}`);
            authProvider.refresh();
        }
    }), vscode.commands.registerCommand('copado-hx.authLogout', async () => {
        vscode.window.showInformationMessage('To disconnect, run: sf org logout --target-org copadotrial');
    }), vscode.commands.registerCommand('copado-hx.authStatus', async () => {
        (0, cli_runner_1.runCliInTerminal)(['auth', 'status']);
    }));
}
//# sourceMappingURL=auth-commands.js.map