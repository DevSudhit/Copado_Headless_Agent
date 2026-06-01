import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import type { AIAgentService } from "../src/services/ai-agent-service.js";
import { PipelineService } from "../src/services/pipeline-service.js";
import { ConfigStore } from "../src/state/config-store.js";
import { ContextStore } from "../src/state/context-store.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dirPath) => rm(dirPath, { recursive: true, force: true })));
});

describe("PipelineService", () => {
  it("returns a live failure result instead of the mock-only guard", async () => {
    const tempDir = await createTempDir();
    const configStore = new ConfigStore(tempDir);
    const contextStore = new ContextStore(tempDir);
    const aiService = {
      ask: async () => ({
        agent: "build",
        prompt: "",
        storyId: "US-0000026",
        answer:
          "I can see the user story details, but no metadata components are attached. CANNOT_EXECUTE",
      }),
    } as Pick<AIAgentService, "ask">;
    const service = new PipelineService(configStore, contextStore, aiService);

    await configStore.update({ runtimeMode: "live" });
    await contextStore.update({ currentStoryId: "US-0000026" });

    const result = await service.commit("test commit from vitest");

    expect(result.operation).toBe("commit");
    expect(result.status).toBe("failed");
    expect(result.message).toContain("no metadata components are attached");
  });
});

async function createTempDir(): Promise<string> {
  const dirPath = await mkdtemp(join(tmpdir(), "copado-hx-test-"));
  tempDirs.push(dirPath);
  return dirPath;
}