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
exports.AuthProvider = void 0;
const vscode = __importStar(require("vscode"));
const cli_runner_1 = require("../utils/cli-runner");
class AuthProvider {
    stateReader;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    _liveStatus = {};
    constructor(stateReader) {
        this.stateReader = stateReader;
        stateReader.onDidChange(() => this.refresh());
        this.loadLiveStatus();
    }
    refresh() {
        this.loadLiveStatus();
    }
    loadLiveStatus() {
        (0, cli_runner_1.runCliJson)(['auth', 'status']).then(result => {
            this._liveStatus = result?.data ?? {};
            this._onDidChangeTreeData.fire(undefined);
        }).catch(() => {
            this._onDidChangeTreeData.fire(undefined);
        });
    }
    getTreeItem(element) {
        return element;
    }
    getChildren() {
        const items = [];
        const status = this._liveStatus;
        const isLive = status.runtimeMode === 'live';
        // Runtime mode
        items.push(AuthItem.create(`Mode: ${isLive ? 'LIVE' : 'MOCK'}`, isLive ? 'cloud' : 'beaker', new vscode.MarkdownString(isLive
            ? `**Live mode** — connected to Copado org via Salesforce CLI`
            : `**Mock mode** — run \`sf org login web --alias copadotrial\` to connect`), 'copado-hx.authStatus'));
        // Salesforce CLI
        items.push(AuthItem.create(`Salesforce CLI: ${status.sfCliConnected ? `connected (${status.sfOrgAlias})` : 'not connected'}`, status.sfCliConnected ? 'pass-filled' : 'warning', new vscode.MarkdownString(status.sfCliConnected
            ? `✅ **sf CLI** connected to \`${status.sfOrgAlias}\`\n\nUsed by: commit, promote, deploy, story list`
            : `❌ Run \`sf org login web --alias copadotrial\` to connect`)));
        // AI
        items.push(AuthItem.create(`Copado AI: ${status.aiConnected ? 'connected' : 'not connected'}`, status.aiConnected ? 'pass-filled' : 'warning', new vscode.MarkdownString(status.aiConnected
            ? `✅ **Copado AI** connected\n\nUsed by: ai ask (plan, build, test, release, operate)`
            : `❌ Set \`COPADO_AI_TOKEN\`, \`COPADO_AI_ORGANIZATION_ID\`, \`COPADO_AI_WORKSPACE_ID\` in \`.env\``)));
        // CRT
        items.push(AuthItem.create(`CRT Testing: ${status.crtConnected ? 'connected' : 'not connected'}`, status.crtConnected ? 'pass-filled' : 'warning', new vscode.MarkdownString(status.crtConnected
            ? `✅ **Copado CRT** connected\n\nUsed by: test run, test status, test results`
            : `❌ Set \`COPADO_CRT_TOKEN\`, \`COPADO_CRT_PROJECT_ID\` in \`.env\``)));
        // Active story
        const ctx = this.stateReader.getContext();
        if (ctx.currentStoryId) {
            const storyTooltip = new vscode.MarkdownString();
            storyTooltip.appendMarkdown(`### Active Story\n\n**${ctx.currentStoryId}**\n\n`);
            if (ctx.lastPromotionEnvironment) {
                storyTooltip.appendMarkdown(`Last promoted to: **${ctx.lastPromotionEnvironment}**\n\n`);
            }
            if (ctx.lastDeploymentEnvironment) {
                storyTooltip.appendMarkdown(`Last deployed to: **${ctx.lastDeploymentEnvironment}**\n\n`);
            }
            items.push(AuthItem.create(`Active: ${ctx.currentStoryId}`, 'bookmark', storyTooltip, 'copado-hx.storyShow', ctx.currentStoryId));
        }
        return items;
    }
}
exports.AuthProvider = AuthProvider;
class AuthItem extends vscode.TreeItem {
    static create(label, icon, tooltip, command, ...args) {
        const item = new AuthItem(label, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.tooltip = tooltip;
        if (command) {
            item.command = { command, title: label, arguments: args.length > 0 ? args : undefined };
        }
        return item;
    }
}
//# sourceMappingURL=auth-provider.js.map