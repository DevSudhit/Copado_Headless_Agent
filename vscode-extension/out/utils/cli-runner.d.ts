export interface CliResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}
/**
 * Runs a copado-hx CLI command and returns the parsed output.
 * Always uses --json for machine-readable output.
 */
export declare function runCli(args: string[], cwd?: string): Promise<CliResult>;
/**
 * Runs CLI and parses JSON output. Returns undefined on failure.
 */
export declare function runCliJson<T>(args: string[]): Promise<T | undefined>;
/**
 * Runs CLI in the integrated terminal (visible to user).
 */
export declare function runCliInTerminal(args: string[]): void;
