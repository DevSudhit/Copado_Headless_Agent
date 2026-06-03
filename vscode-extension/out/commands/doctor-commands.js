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
exports.registerDoctorCommands = registerDoctorCommands;
const vscode = __importStar(require("vscode"));
const cli_runner_1 = require("../utils/cli-runner");
const replay_panel_1 = require("../webviews/replay-panel");
function registerDoctorCommands(context) {
    context.subscriptions.push(vscode.commands.registerCommand('copado-hx.doctorInvestigate', async (typeArg) => {
        let targetType = typeArg;
        if (!targetType) {
            const pick = await vscode.window.showQuickPick([
                { label: '$(bug) Deployment', value: 'deployment' },
                { label: '$(arrow-up) Promotion', value: 'promotion' },
                { label: '$(beaker) Test', value: 'test' },
                { label: '$(git-commit) Commit', value: 'commit' },
            ], { placeHolder: 'What type of issue to investigate?' });
            if (!pick) {
                return;
            }
            targetType = pick.value;
        }
        const targetId = await vscode.window.showInputBox({
            prompt: `Enter the ${targetType} ID to investigate`,
            placeHolder: targetType === 'deployment' ? 'DEP-...' :
                targetType === 'promotion' ? 'PRO-...' :
                    targetType === 'test' ? 'EX-...' : 'COM-...',
        });
        if (!targetId) {
            return;
        }
        // Run in terminal for rich output
        (0, cli_runner_1.runCliInTerminal)(['doctor', targetType, targetId]);
    }), vscode.commands.registerCommand('copado-hx.doctorWhy', async () => {
        const targetId = await vscode.window.showInputBox({
            prompt: 'Enter an ID to investigate (auto-detects type from prefix)',
            placeHolder: 'DEP-..., PRO-..., EX-..., COM-..., US-...',
        });
        if (!targetId) {
            return;
        }
        (0, cli_runner_1.runCliInTerminal)(['why', targetId]);
    }), vscode.commands.registerCommand('copado-hx.replay', async (entityIdArg) => {
        let entityId;
        if (typeof entityIdArg === 'string') {
            entityId = entityIdArg;
        }
        else if (entityIdArg && typeof entityIdArg === 'object') {
            const obj = entityIdArg;
            if (obj.story && typeof obj.story === 'object') {
                entityId = obj.story.id;
            }
            else if (typeof obj.id === 'string') {
                entityId = obj.id;
            }
        }
        if (!entityId) {
            entityId = await vscode.window.showInputBox({
                prompt: 'Enter an entity ID to replay',
                placeHolder: 'US-1234, DEP-..., PRO-..., EX-..., COM-...',
            });
        }
        if (!entityId) {
            return;
        }
        const options = await vscode.window.showQuickPick([
            { label: '$(diff) Include metadata diff', value: '--diff', picked: false },
            { label: '$(megaphone) Generate incident summary', value: '--incident', picked: false },
            { label: '$(sparkle) AI analysis', value: '--ai', picked: false },
        ], { placeHolder: 'Replay options (optional)', canPickMany: true });
        const args = ['replay', entityId];
        if (options) {
            for (const opt of options) {
                args.push(opt.value);
            }
        }
        // Show in webview panel for rich display
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Copado: Building replay for ${entityId}...`, cancellable: false }, async () => {
            const result = await (0, cli_runner_1.runCliJson)(args);
            if (result) {
                replay_panel_1.ReplayPanel.createOrShow(context.extensionUri, entityId, result);
            }
        });
    }));
}
//# sourceMappingURL=doctor-commands.js.map