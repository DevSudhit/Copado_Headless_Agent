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
exports.StateReader = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DEFAULT_CONFIG = {
    runtimeMode: 'mock',
    defaultOutput: 'text',
};
/**
 * Reads CLI state files directly for fast, non-blocking state access.
 * This avoids spawning CLI subprocesses for simple state reads.
 */
class StateReader {
    workspaceRoot;
    _onDidChange = new vscode.EventEmitter();
    onDidChange = this._onDidChange.event;
    watcher;
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
    }
    start() {
        const pattern = new vscode.RelativePattern(this.workspaceRoot, '.copado-hx*.json');
        this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
        this.watcher.onDidChange(() => this._onDidChange.fire());
        this.watcher.onDidCreate(() => this._onDidChange.fire());
        this.watcher.onDidDelete(() => this._onDidChange.fire());
    }
    dispose() {
        this.watcher?.dispose();
        this._onDidChange.dispose();
    }
    getConfig() {
        return this.readJsonFile('.copado-hx.json') ?? DEFAULT_CONFIG;
    }
    getContext() {
        return this.readJsonFile('.copado-hx.state.json') ?? {};
    }
    /** Check if a given env var key exists in the workspace .env file */
    hasEnvVar(varName) {
        const envPath = path.join(this.workspaceRoot, '.env');
        try {
            const content = fs.readFileSync(envPath, 'utf-8');
            return content.split('\n').some(line => {
                const trimmed = line.trim();
                if (trimmed.startsWith('#') || !trimmed.includes('=')) {
                    return false;
                }
                const key = trimmed.split('=')[0].trim();
                return key === varName;
            });
        }
        catch {
            return false;
        }
    }
    /** Check which live client groups have credentials in .env */
    getCredentialStatus() {
        const keys = this.getEnvVarKeys();
        return {
            cicd: keys.includes('COPADO_CICD_BASE_URL') && keys.includes('COPADO_CICD_TOKEN'),
            ai: keys.includes('COPADO_AI_BASE_URL') && keys.includes('COPADO_AI_TOKEN'),
            crt: keys.includes('COPADO_CRT_BASE_URL') && keys.includes('COPADO_CRT_TOKEN'),
        };
    }
    getEnvVarKeys() {
        const envPath = path.join(this.workspaceRoot, '.env');
        try {
            const content = fs.readFileSync(envPath, 'utf-8');
            return content.split('\n')
                .map(line => line.trim())
                .filter(line => !line.startsWith('#') && line.includes('='))
                .map(line => line.split('=')[0].trim())
                .filter(key => key.length > 0);
        }
        catch {
            return [];
        }
    }
    readJsonFile(filename) {
        const filePath = path.join(this.workspaceRoot, filename);
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(content);
        }
        catch {
            return undefined;
        }
    }
}
exports.StateReader = StateReader;
//# sourceMappingURL=state-reader.js.map