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
exports.TestItem = exports.TestingProvider = void 0;
const vscode = __importStar(require("vscode"));
class TestingProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    executions = [];
    refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }
    addExecution(execution) {
        this.executions.unshift(execution);
        if (this.executions.length > 20) {
            this.executions.pop();
        }
        this.refresh();
    }
    updateExecution(executionId, update) {
        const idx = this.executions.findIndex(e => e.executionId === executionId);
        if (idx >= 0) {
            this.executions[idx] = { ...this.executions[idx], ...update };
            this.refresh();
        }
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (element) {
            return element.children ?? [];
        }
        const items = [];
        // Actions
        items.push(TestItem.section('Run Tests', 'beaker', [
            TestItem.action('Run Test Suite', 'play', 'copado-hx.testRun'),
        ]));
        // Executions
        if (this.executions.length > 0) {
            const execItems = this.executions.map(e => {
                const statusIcon = this.statusIcon(e.status);
                const label = `${e.suiteId} — ${e.executionId}`;
                const children = [
                    TestItem.detail(`Status: ${e.status}`, 'info'),
                ];
                if (e.passed != null || e.failed != null) {
                    children.push(TestItem.detail(`Passed: ${e.passed ?? 0}`, 'pass'));
                    children.push(TestItem.detail(`Failed: ${e.failed ?? 0}`, 'error'));
                }
                children.push(TestItem.action('Refresh Status', 'sync', 'copado-hx.testStatus'));
                children.push(TestItem.action('View Results', 'checklist', 'copado-hx.testResults'));
                const section = TestItem.section(label, statusIcon, children);
                // Rich tooltip on the execution row
                const md = new vscode.MarkdownString();
                md.appendMarkdown(`### Test Execution\n\n`);
                md.appendMarkdown(`| | |\n|---|---|\n`);
                md.appendMarkdown(`| Suite | \`${e.suiteId}\` |\n`);
                md.appendMarkdown(`| Execution | \`${e.executionId}\` |\n`);
                md.appendMarkdown(`| Status | **${e.status}** |\n`);
                if (e.passed != null) {
                    md.appendMarkdown(`| Passed | ${e.passed} |\n`);
                }
                if (e.failed != null) {
                    md.appendMarkdown(`| Failed | ${e.failed} |\n`);
                }
                if (e.timestamp) {
                    md.appendMarkdown(`| Time | ${new Date(e.timestamp).toLocaleString()} |\n`);
                }
                md.appendMarkdown(`\n_Expand for actions_`);
                section.tooltip = md;
                // Click to view results
                section.command = { command: 'copado-hx.testResults', title: 'View Results', arguments: [e.executionId] };
                return section;
            });
            items.push(TestItem.section(`Executions (${this.executions.length})`, 'list-ordered', execItems));
        }
        else {
            items.push(TestItem.detail('No test executions yet', 'info'));
        }
        return items;
    }
    statusIcon(status) {
        switch (status) {
            case 'passed': return 'pass-filled';
            case 'failed': return 'error';
            case 'running': return 'sync~spin';
            case 'queued': return 'clock';
            default: return 'question';
        }
    }
}
exports.TestingProvider = TestingProvider;
class TestItem extends vscode.TreeItem {
    children;
    static detail(label, icon) {
        const item = new TestItem(label, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.contextValue = 'testDetail';
        return item;
    }
    static section(label, icon, children) {
        const item = new TestItem(label, vscode.TreeItemCollapsibleState.Collapsed);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.children = children;
        item.contextValue = 'testSection';
        return item;
    }
    static action(label, icon, command) {
        const item = new TestItem(label, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.command = { command, title: label };
        item.contextValue = 'testAction';
        return item;
    }
}
exports.TestItem = TestItem;
//# sourceMappingURL=testing-provider.js.map