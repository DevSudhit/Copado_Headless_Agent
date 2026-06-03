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
exports.registerTestingCommands = registerTestingCommands;
const vscode = __importStar(require("vscode"));
const cli_runner_1 = require("../utils/cli-runner");
function registerTestingCommands(context, testingProvider) {
    context.subscriptions.push(vscode.commands.registerCommand('copado-hx.testRun', async () => {
        const suiteId = await vscode.window.showInputBox({
            prompt: 'Test suite ID to run',
            placeHolder: 'smoke',
        });
        if (!suiteId) {
            return;
        }
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Copado: Running test suite "${suiteId}"...`, cancellable: false }, async () => {
            const result = await (0, cli_runner_1.runCliJson)(['test', 'run', '--suite', suiteId]);
            if (result?.data) {
                testingProvider.addExecution({
                    executionId: result.data.executionId,
                    suiteId: result.data.suiteId,
                    status: result.data.status,
                    timestamp: new Date().toISOString(),
                });
                vscode.window.showInformationMessage(`Copado: Test suite queued — ${result.data.executionId}`);
            }
        });
    }), vscode.commands.registerCommand('copado-hx.testStatus', async (executionIdArg) => {
        let executionId = executionIdArg;
        if (!executionId) {
            executionId = await vscode.window.showInputBox({
                prompt: 'Execution ID to check',
                placeHolder: 'EX-...',
            });
        }
        if (!executionId) {
            return;
        }
        const result = await (0, cli_runner_1.runCliJson)(['test', 'status', '--execution', executionId]);
        if (result?.data) {
            testingProvider.updateExecution(executionId, { status: result.data.status });
            vscode.window.showInformationMessage(`Copado: Test ${executionId} — ${result.data.status}`);
        }
    }), vscode.commands.registerCommand('copado-hx.testResults', async (executionIdArg) => {
        let executionId = executionIdArg;
        if (!executionId) {
            executionId = await vscode.window.showInputBox({
                prompt: 'Execution ID for results',
                placeHolder: 'EX-...',
            });
        }
        if (!executionId) {
            return;
        }
        const result = await (0, cli_runner_1.runCliJson)(['test', 'results', '--execution', executionId]);
        if (result?.data) {
            testingProvider.updateExecution(executionId, {
                status: result.data.status,
                passed: result.data.passed,
                failed: result.data.failed,
            });
            const msg = `Tests: ${result.data.passed ?? 0} passed, ${result.data.failed ?? 0} failed`;
            if (result.data.failed && result.data.failed > 0) {
                vscode.window.showWarningMessage(`Copado: ${msg}`);
            }
            else {
                vscode.window.showInformationMessage(`Copado: ${msg}`);
            }
        }
    }), vscode.commands.registerCommand('copado-hx.refreshTesting', () => {
        testingProvider.refresh();
    }));
}
//# sourceMappingURL=testing-commands.js.map