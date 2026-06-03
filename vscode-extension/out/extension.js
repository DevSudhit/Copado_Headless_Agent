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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const state_reader_1 = require("./services/state-reader");
const auth_provider_1 = require("./providers/auth-provider");
const story_provider_1 = require("./providers/story-provider");
const pipeline_provider_1 = require("./providers/pipeline-provider");
const testing_provider_1 = require("./providers/testing-provider");
const doctor_provider_1 = require("./providers/doctor-provider");
const ai_provider_1 = require("./providers/ai-provider");
const status_bar_1 = require("./providers/status-bar");
const auth_commands_1 = require("./commands/auth-commands");
const story_commands_1 = require("./commands/story-commands");
const pipeline_commands_1 = require("./commands/pipeline-commands");
const testing_commands_1 = require("./commands/testing-commands");
const doctor_commands_1 = require("./commands/doctor-commands");
const ai_commands_1 = require("./commands/ai-commands");
function activate(context) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        return;
    }
    // --- State reader (watches .copado-hx.json & .copado-hx.state.json) ---
    const stateReader = new state_reader_1.StateReader(workspaceRoot);
    stateReader.start();
    context.subscriptions.push({ dispose: () => stateReader.dispose() });
    // --- Tree View providers ---
    const authProvider = new auth_provider_1.AuthProvider(stateReader);
    const storyProvider = new story_provider_1.StoryProvider(stateReader);
    const pipelineProvider = new pipeline_provider_1.PipelineProvider(stateReader);
    const testingProvider = new testing_provider_1.TestingProvider();
    const doctorProvider = new doctor_provider_1.DoctorProvider();
    const aiProvider = new ai_provider_1.AIProvider();
    context.subscriptions.push(vscode.window.registerTreeDataProvider('copadoAuth', authProvider), vscode.window.registerTreeDataProvider('copadoStories', storyProvider), vscode.window.registerTreeDataProvider('copadoPipeline', pipelineProvider), vscode.window.registerTreeDataProvider('copadoTesting', testingProvider), vscode.window.registerTreeDataProvider('copadoDoctor', doctorProvider), vscode.window.registerTreeDataProvider('copadoAI', aiProvider));
    // --- Status bar ---
    const statusBar = new status_bar_1.CopadoStatusBar(stateReader);
    context.subscriptions.push({ dispose: () => statusBar.dispose() });
    // --- Register all commands ---
    (0, auth_commands_1.registerAuthCommands)(context, authProvider);
    (0, story_commands_1.registerStoryCommands)(context, storyProvider);
    (0, pipeline_commands_1.registerPipelineCommands)(context, pipelineProvider);
    (0, testing_commands_1.registerTestingCommands)(context, testingProvider);
    (0, doctor_commands_1.registerDoctorCommands)(context);
    (0, ai_commands_1.registerAICommands)(context);
}
function deactivate() {
    // Cleanup handled by disposables
}
//# sourceMappingURL=extension.js.map