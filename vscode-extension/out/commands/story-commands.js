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
exports.registerStoryCommands = registerStoryCommands;
const vscode = __importStar(require("vscode"));
const cli_runner_1 = require("../utils/cli-runner");
const story_detail_panel_1 = require("../webviews/story-detail-panel");
/** Extract story ID from a string arg or a StoryItem tree node. */
function resolveStoryId(arg) {
    if (typeof arg === 'string') {
        return arg;
    }
    if (arg && typeof arg === 'object') {
        const obj = arg;
        // StoryItem has .story.id
        if (obj.story && typeof obj.story === 'object') {
            const story = obj.story;
            if (typeof story.id === 'string' && story.id) {
                return story.id;
            }
        }
        // fallback: direct .id
        if (typeof obj.id === 'string' && obj.id) {
            return obj.id;
        }
    }
    return undefined;
}
function registerStoryCommands(context, storyProvider) {
    context.subscriptions.push(vscode.commands.registerCommand('copado-hx.storyList', async () => {
        storyProvider.refresh();
        vscode.window.showInformationMessage('Copado: Stories refreshed');
    }), vscode.commands.registerCommand('copado-hx.storySet', async (storyIdArg) => {
        let storyId = resolveStoryId(storyIdArg);
        if (!storyId) {
            storyId = await vscode.window.showInputBox({
                prompt: 'Enter the story ID to set as active',
                placeHolder: 'US-1234',
            });
        }
        if (!storyId) {
            return;
        }
        const result = await (0, cli_runner_1.runCliJson)(['story', 'set', '--id', storyId]);
        if (result) {
            vscode.window.showInformationMessage(`Copado: Active story set to ${storyId}`);
            storyProvider.refresh();
            // Fire a global event for status bar
            vscode.commands.executeCommand('copado-hx.refreshPipeline');
        }
    }), vscode.commands.registerCommand('copado-hx.storyCurrent', async () => {
        (0, cli_runner_1.runCliInTerminal)(['story', 'current']);
    }), vscode.commands.registerCommand('copado-hx.storyShow', async (storyIdArg) => {
        let storyId = resolveStoryId(storyIdArg);
        if (!storyId) {
            storyId = await vscode.window.showInputBox({
                prompt: 'Enter the story ID to view',
                placeHolder: 'US-1234',
            });
        }
        if (!storyId) {
            return;
        }
        const result = await (0, cli_runner_1.runCliJson)(['story', 'show', '--id', storyId]);
        if (result) {
            story_detail_panel_1.StoryDetailPanel.createOrShow(context.extensionUri, storyId, result.data ?? { summary: result.summary });
        }
    }), vscode.commands.registerCommand('copado-hx.refreshStories', () => {
        storyProvider.refresh();
    }));
}
//# sourceMappingURL=story-commands.js.map