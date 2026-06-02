// ────────────────────────────────────────────────────────────────────────────
// Salesforce SOQL client — delegates to the SF CLI `sf data query` command
// which holds the live authenticated session in its own keychain store.
// This avoids the need to manage OAuth tokens directly in .env.
// ────────────────────────────────────────────────────────────────────────────

import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export class SalesforceClient {
  constructor(private readonly targetOrg = "copadotrial") {}

  query<T extends Record<string, unknown>>(soql: string): T[] {
    try {
      const result = execSync(
        `sf data query --target-org "${this.targetOrg}" --query "${soql.replace(/"/g, "'")}" --json 2>/dev/null`,
        { encoding: "utf8", timeout: 30_000 },
      );
      const parsed = JSON.parse(result);
      return (parsed?.result?.records ?? []) as T[];
    } catch {
      return [];
    }
  }

  /**
   * Execute anonymous Apex in the connected org via `sf apex run --file`.
   * Returns `{ success, output }` — never throws.
   */
  runApex(code: string): { success: boolean; output: string } {
    const tmpFile = join(tmpdir(), `copado-hx-apex-${Date.now()}.apex`);
    try {
      writeFileSync(tmpFile, code, "utf8");
      const result = execSync(
        `sf apex run --target-org "${this.targetOrg}" --file "${tmpFile}" --json 2>&1`,
        { encoding: "utf8", timeout: 60_000 },
      );
      const parsed = JSON.parse(result);
      const success = parsed?.status === 0 && parsed?.result?.success === true;
      const logs: string = parsed?.result?.logs ?? parsed?.message ?? "";
      return { success, output: logs };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // execSync throws on non-zero exit; try to parse JSON from stdout/stderr
      const jsonMatch = msg.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          const output: string =
            parsed?.result?.compileProblem ??
            parsed?.result?.exceptionMessage ??
            parsed?.message ??
            msg;
          return { success: false, output };
        } catch { /* ignore */ }
      }
      return { success: false, output: msg };
    } finally {
      try { unlinkSync(tmpFile); } catch { /* ignore cleanup errors */ }
    }
  }

  /** Check if the CLI org session is active. */
  isAvailable(): boolean {
    try {
      const result = execSync(
        `sf data query --target-org "${this.targetOrg}" --query "SELECT Id FROM Organization LIMIT 1" --json 2>/dev/null`,
        { encoding: "utf8", timeout: 10_000 },
      );
      const parsed = JSON.parse(result);
      return parsed?.status === 0;
    } catch {
      return false;
    }
  }
}
