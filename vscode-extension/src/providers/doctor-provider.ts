import * as vscode from 'vscode';

export class DoctorProvider implements vscode.TreeDataProvider<DoctorItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<DoctorItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: DoctorItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: DoctorItem): DoctorItem[] {
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

export class DoctorItem extends vscode.TreeItem {
    children?: DoctorItem[];

    static section(label: string, icon: string, children: DoctorItem[]): DoctorItem {
        const item = new DoctorItem(label, vscode.TreeItemCollapsibleState.Expanded);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.children = children;
        item.contextValue = 'doctorSection';
        return item;
    }

    static action(label: string, icon: string, command: string, ...args: string[]): DoctorItem {
        const item = new DoctorItem(label, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.command = { command, title: label, arguments: args };
        item.contextValue = 'doctorAction';
        const md = new vscode.MarkdownString(`_Click to ${label.toLowerCase()}_`);
        item.tooltip = md;
        return item;
    }

    static detail(label: string, icon: string): DoctorItem {
        const item = new DoctorItem(label, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.contextValue = 'doctorDetail';
        return item;
    }
}
