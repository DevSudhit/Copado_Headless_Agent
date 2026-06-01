import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { ConfigValidationService } from "../src/services/config-validation-service.js";
import { ConfigStore } from "../src/state/config-store.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dirPath) => rm(dirPath, { recursive: true, force: true })));
});

describe("ConfigValidationService", () => {
  it("reports mock mode as valid for local demo use", async () => {
    const service = await createValidationService();

    const result = await service.validate();

    expect(result.valid).toBe(true);
    expect(result.runtimeMode).toBe("mock");
    expect(result.findings.some((finding) => finding.message.includes("Runtime mode is mock"))).toBe(true);
  });

  it("reports an enabled service without token env config as invalid", async () => {
    const tempDir = await createTempDir();
    const configStore = new ConfigStore(tempDir);

    await configStore.save({
      ...(await configStore.load()),
      runtimeMode: "live",
      services: {
        ...(await configStore.load()).services,
        cicd: {
          enabled: true,
          baseUrl: "https://example.copado.test",
          auth: {
            type: "bearer",
          },
        },
      },
    });

    const service = new ConfigValidationService(configStore);
    const result = await service.validate("cicd");

    expect(result.valid).toBe(false);
    expect(result.findings.some((finding) => finding.level === "error" && finding.message.includes("missing a token environment variable"))).toBe(true);
  });
});

async function createValidationService(): Promise<ConfigValidationService> {
  const tempDir = await createTempDir();
  return new ConfigValidationService(new ConfigStore(tempDir));
}

async function createTempDir(): Promise<string> {
  const dirPath = await mkdtemp(join(tmpdir(), "copado-hx-config-test-"));
  tempDirs.push(dirPath);
  return dirPath;
}