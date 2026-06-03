import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/** Mirrors the CLI's ProjectConfig from .copado-hx.json */
export interface ProjectConfig {
    runtimeMode: 'mock' | 'live';
    apiBaseUrl?: string;
    defaultOutput: 'text' | 'json';
    tokenEnvVar?: string;
}

/** Mirrors the CLI's SessionContext from .copado-hx.state.json */
export interface SessionContext {
    currentStoryId?: string;
    lastPromotionEnvironment?: string;
    lastDeploymentEnvironment?: string;
    commitHistory?: CliCommitRecord[];
}

export interface CliCommitRecord {
    operationId: string;
    storyId: string;
    message: string;
    timestamp: string;
}

const DEFAULT_CONFIG: ProjectConfig = {
    runtimeMode: 'mock',
    defaultOutput: 'text',
};

/**
 * Reads CLI state files directly for fast, non-blocking state access.
 * This avoids spawning CLI subprocesses for simple state reads.
 */
export class StateReader {
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChange = this._onDidChange.event;
    private watcher?: vscode.FileSystemWatcher;

    constructor(private readonly workspaceRoot: string) {}

    start(): void {
        const pattern = new vscode.RelativePattern(this.workspaceRoot, '.copado-hx*.json');
        this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
        this.watcher.onDidChange(() => this._onDidChange.fire());
        this.watcher.onDidCreate(() => this._onDidChange.fire());
        this.watcher.onDidDelete(() => this._onDidChange.fire());
    }

    dispose(): void {
        this.watcher?.dispose();
        this._onDidChange.dispose();
    }

    getConfig(): ProjectConfig {
        return this.readJsonFile<ProjectConfig>('.copado-hx.json') ?? DEFAULT_CONFIG;
    }

    getContext(): SessionContext {
        return this.readJsonFile<SessionContext>('.copado-hx.state.json') ?? {};
    }

    /** Check if a given env var key exists in the workspace .env file */
    hasEnvVar(varName: string): boolean {
        const envPath = path.join(this.workspaceRoot, '.env');
        try {
            const content = fs.readFileSync(envPath, 'utf-8');
            return content.split('\n').some(line => {
                const trimmed = line.trim();
                if (trimmed.startsWith('#') || !trimmed.includes('=')) { return false; }
                const key = trimmed.split('=')[0].trim();
                return key === varName;
            });
        } catch {
            return false;
        }
    }

    /** Check which live client groups have credentials in .env */
    getCredentialStatus(): { cicd: boolean; ai: boolean; crt: boolean } {
        const keys = this.getEnvVarKeys();
        return {
            cicd: keys.includes('COPADO_CICD_BASE_URL') && keys.includes('COPADO_CICD_TOKEN'),
            ai: keys.includes('COPADO_AI_BASE_URL') && keys.includes('COPADO_AI_TOKEN'),
            crt: keys.includes('COPADO_CRT_BASE_URL') && keys.includes('COPADO_CRT_TOKEN'),
        };
    }

    private getEnvVarKeys(): string[] {
        const envPath = path.join(this.workspaceRoot, '.env');
        try {
            const content = fs.readFileSync(envPath, 'utf-8');
            return content.split('\n')
                .map(line => line.trim())
                .filter(line => !line.startsWith('#') && line.includes('='))
                .map(line => line.split('=')[0].trim())
                .filter(key => key.length > 0);
        } catch {
            return [];
        }
    }

    private readJsonFile<T>(filename: string): T | undefined {
        const filePath = path.join(this.workspaceRoot, filename);
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(content) as T;
        } catch {
            return undefined;
        }
    }
}
