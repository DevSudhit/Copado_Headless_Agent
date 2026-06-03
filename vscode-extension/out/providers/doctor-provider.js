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
exports.DoctorItem = exports.DoctorProvider = void 0;
const vscode = __importStar(require("vscode"));
class DoctorProvider {
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
        return [
            DoctorItem.section('Investigate', 'search', [
                DoctorItem.action('Investigate Deployment', 'bug', 'copado-hx.doctorInvestigate', 'deployment'),
                DoctorItem.action('Investigate Promotion', 'arrow-up', 'copado-hx.doctorInvestigate', 'promotion'),
                DoctorItem.action('Investigate Test', 'beaker', 'copado-hx.doctorInvestigate', 'test'),
                DoctorItem.action('Investigate Commit', 'git-commit', 'copado-hx.doctorInvestigate', 'commit'),
            ]),
            DoctorItem.section('Quick Diagnosis', 'question', [
                DoctorItem.action('Why Did This Fail?', 'lightbulb', 'copado-hx.doctorWhy'),
            ]),
            DoctorItem.section('About Doctor Engine', 'info', [
                DoctorItem.detail('Collects evidence from Salesforce', 'database'),
                DoctorItem.detail('Applies diagnostic rules automatically', 'symbol-ruler'),
                DoctorItem.detail('Provides root cause with confidence score', 'target'),
                DoctorItem.detail('Suggests fix commands', 'wand'),
            ]),
        ];
    }
}
exports.DoctorProvider = DoctorProvider;
class DoctorItem extends vscode.TreeItem {
    children;
    static section(label, icon, children) {
        const item = new DoctorItem(label, vscode.TreeItemCollapsibleState.Expanded);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.children = children;
        item.contextValue = 'doctorSection';
        return item;
    }
    static action(label, icon, command, ...args) {
        const item = new DoctorItem(label, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.command = { command, title: label, arguments: args };
        item.contextValue = 'doctorAction';
        const md = new vscode.MarkdownString(`_Click to ${label.toLowerCase()}_`);
        item.tooltip = md;
        return item;
    }
    static detail(label, icon) {
        const item = new DoctorItem(label, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.contextValue = 'doctorDetail';
        return item;
    }
}
exports.DoctorItem = DoctorItem;
//# sourceMappingURL=doctor-provider.js.map