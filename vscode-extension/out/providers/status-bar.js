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
exports.CopadoStatusBar = void 0;
const vscode = __importStar(require("vscode"));
class CopadoStatusBar {
    stateReader;
    storyItem;
    modeItem;
    constructor(stateReader) {
        this.stateReader = stateReader;
        this.modeItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.modeItem.command = 'copado-hx.authLogin';
        this.modeItem.tooltip = 'Copado: Click to change runtime mode';
        this.storyItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
        this.storyItem.command = 'copado-hx.storySet';
        this.storyItem.tooltip = 'Copado: Click to change active story';
        stateReader.onDidChange(() => this.update());
        this.update();
    }
    update() {
        const config = this.stateReader.getConfig();
        const ctx = this.stateReader.getContext();
        const showStatusBar = vscode.workspace.getConfiguration('copado-hx').get('showStatusBar', true);
        if (!showStatusBar) {
            this.modeItem.hide();
            this.storyItem.hide();
            return;
        }
        // Mode indicator
        if (config.runtimeMode === 'live') {
            this.modeItem.text = '$(cloud) Copado Live';
            this.modeItem.backgroundColor = undefined;
        }
        else {
            this.modeItem.text = '$(beaker) Copado Mock';
            this.modeItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
        this.modeItem.show();
        // Active story
        if (ctx.currentStoryId) {
            this.storyItem.text = `$(bookmark) ${ctx.currentStoryId}`;
            this.storyItem.tooltip = `Active story: ${ctx.currentStoryId}\nLast promote: ${ctx.lastPromotionEnvironment ?? '—'}\nLast deploy: ${ctx.lastDeploymentEnvironment ?? '—'}`;
        }
        else {
            this.storyItem.text = '$(bookmark) No story';
            this.storyItem.tooltip = 'Click to set an active story';
        }
        this.storyItem.show();
    }
    dispose() {
        this.storyItem.dispose();
        this.modeItem.dispose();
    }
}
exports.CopadoStatusBar = CopadoStatusBar;
//# sourceMappingURL=status-bar.js.map