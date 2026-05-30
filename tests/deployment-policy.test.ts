import { describe, expect, it } from "vitest";

import { assertDeploymentAllowed } from "../src/policies/deployment-policy.js";
import { CliError } from "../src/types/commands.js";

describe("assertDeploymentAllowed", () => {
  it("blocks production deploys without approval", () => {
    expect(() => assertDeploymentAllowed("PROD", false)).toThrowError(CliError);

    try {
      assertDeploymentAllowed("PROD", false);
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);

      const cliError = error as CliError;
      expect(cliError.exitCode).toBe(3);
      expect(cliError.data).toEqual({ environment: "PROD" });
    }
  });

  it("allows non-production deploys without approval", () => {
    expect(() => assertDeploymentAllowed("UAT", false)).not.toThrow();
  });
});