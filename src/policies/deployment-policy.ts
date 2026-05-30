import { CliError } from "../types/commands.js";

import { requiresExplicitApproval } from "./approval-policy.js";

export function assertDeploymentAllowed(environment: string, approved: boolean): void {
  if (requiresExplicitApproval(environment) && !approved) {
    throw new CliError(
      "Deploying to PROD requires explicit approval. Re-run with --approve when you are ready.",
      3,
      { environment },
    );
  }
}