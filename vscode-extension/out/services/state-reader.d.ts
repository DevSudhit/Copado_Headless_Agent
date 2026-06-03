import * as vscode from 'vscode';
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
/**
 * Reads CLI state files directly for fast, non-blocking state access.
 * This avoids spawning CLI subprocesses for simple state reads.
 */
export declare class StateReader {
    private readonly workspaceRoot;
    private readonly _onDidChange;
    readonly onDidChange: vscode.Event<void>;
    private watcher?;
    constructor(workspaceRoot: string);
    start(): void;
    dispose(): void;
    getConfig(): ProjectConfig;
    getContext(): SessionContext;
    /** Check if a given env var key exists in the workspace .env file */
    hasEnvVar(varName: string): boolean;
    /** Check which live client groups have credentials in .env */
    getCredentialStatus(): {
        cicd: boolean;
        ai: boolean;
        crt: boolean;
    };
    private getEnvVarKeys;
    private readJsonFile;
}
