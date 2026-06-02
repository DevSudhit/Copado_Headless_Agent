// ────────────────────────────────────────────────────────────────────────────
// Salesforce SOQL client — delegates to the SF CLI `sf data query` command
// which holds the live authenticated session in its own keychain store.
// This avoids the need to manage OAuth tokens directly in .env.
// ────────────────────────────────────────────────────────────────────────────

import { execSync } from "child_process";

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
