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
exports.AIItem = exports.AIProvider = void 0;
const vscode = __importStar(require("vscode"));
const AI_AGENTS = [
    { name: 'plan', icon: 'map', desc: 'Break work into actionable steps' },
    { name: 'build', icon: 'tools', desc: 'Implementation guidance' },
    { name: 'test', icon: 'beaker', desc: 'Testing strategy & coverage' },
    { name: 'release', icon: 'rocket', desc: 'Release analysis & outcomes' },
    { name: 'operate', icon: 'pulse', desc: 'Operational notes & monitoring' },
];
class AIProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (element) {
            return element.children ?? [];
        }
        const agentItems = AI_AGENTS.map(a => AIItem.action(a.name, a.icon, a.desc, 'copado-hx.aiAsk', a.name));
        return [
            AIItem.section('Ask an Agent', 'sparkle', agentItems),
            AIItem.section('Available Agents', 'info', AI_AGENTS.map(a => AIItem.detail(`${a.name}: ${a.desc}`, a.icon))),
        ];
    }
}
exports.AIProvider = AIProvider;
class AIItem extends vscode.TreeItem {
    children;
    static detail(label, icon) {
        const item = new AIItem(label, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.contextValue = 'aiDetail';
        return item;
    }
    static section(label, icon, children) {
        const item = new AIItem(label, vscode.TreeItemCollapsibleState.Expanded);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.children = children;
        item.contextValue = 'aiSection';
        return item;
    }
    static action(label, icon, description, command, ...args) {
        const item = new AIItem(label, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.description = description;
        item.command = { command, title: label, arguments: args };
        item.contextValue = 'aiAction';
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`### ${label} Agent\n\n`);
        md.appendMarkdown(`${description}\n\n`);
        md.appendMarkdown(`_Click to ask this agent a question_`);
        item.tooltip = md;
        return item;
    }
}
exports.AIItem = AIItem;
//# sourceMappingURL=ai-provider.js.map