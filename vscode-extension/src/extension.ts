import * as vscode from 'vscode';
import { StateReader } from './services/state-reader';
import { AuthProvider } from './providers/auth-provider';
import { StoryProvider } from './providers/story-provider';
import { PipelineProvider } from './providers/pipeline-provider';
import { TestingProvider } from './providers/testing-provider';
import { DoctorProvider } from './providers/doctor-provider';
import { AIProvider } from './providers/ai-provider';
import { CopadoStatusBar } from './providers/status-bar';
import { registerAuthCommands } from './commands/auth-commands';
import { registerStoryCommands } from './commands/story-commands';
import { registerPipelineCommands } from './commands/pipeline-commands';
import { registerTestingCommands } from './commands/testing-commands';
import { registerDoctorCommands } from './commands/doctor-commands';
import { registerAICommands } from './commands/ai-commands';

export function activate(context: vscode.ExtensionContext): void {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        return;
    }

    // --- State reader (watches .copado-hx.json & .copado-hx.state.json) ---
    const stateReader = new StateReader(workspaceRoot);
    stateReader.start();
    context.subscriptions.push({ dispose: () => stateReader.dispose() });

    // --- Tree View providers ---
    const authProvider = new AuthProvider(stateReader);
    const storyProvider = new StoryProvider(stateReader);
    const pipelineProvider = new PipelineProvider(stateReader);
    const testingProvider = new TestingProvider();
    const doctorProvider = new DoctorProvider();
    const aiProvider = new AIProvider();

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('copadoAuth', authProvider),
        vscode.window.registerTreeDataProvider('copadoStories', storyProvider),
        vscode.window.registerTreeDataProvider('copadoPipeline', pipelineProvider),
        vscode.window.registerTreeDataProvider('copadoTesting', testingProvider),
        vscode.window.registerTreeDataProvider('copadoDoctor', doctorProvider),
        vscode.window.registerTreeDataProvider('copadoAI', aiProvider),
    );

    // --- Status bar ---
    const statusBar = new CopadoStatusBar(stateReader);
    context.subscriptions.push({ dispose: () => statusBar.dispose() });

    // --- Register all commands ---
    registerAuthCommands(context, authProvider);
    registerStoryCommands(context, storyProvider);
    registerPipelineCommands(context, pipelineProvider);
    registerTestingCommands(context, testingProvider);
    registerDoctorCommands(context);
    registerAICommands(context);
}

export function deactivate(): void {
    // Cleanup handled by disposables
}
