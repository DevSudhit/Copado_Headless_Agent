import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { StoryContextService } from "../src/services/story-context-service.js";
import { ConfigStore } from "../src/state/config-store.js";
import { ContextStore } from "../src/state/context-store.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dirPath) => rm(dirPath, { recursive: true, force: true })));
});

describe("StoryContextService", () => {
  it("lists the mock stories in mock runtime mode", async () => {
    const service = await createService();

    const stories = await service.listStories();

    expect(stories).toHaveLength(3);
    expect(stories[0]?.id).toBe("US-1234");
  });

  it("persists and reloads the active story", async () => {
    const tempDir = await createTempDir();
    const configStore = new ConfigStore(tempDir);
    const contextStore = new ContextStore(tempDir);
    const service = new StoryContextService(configStore, contextStore);

    await service.setCurrentStory("US-2345");

    const activeStory = await service.getCurrentStory();
    const savedContext = await contextStore.load();

    expect(activeStory.id).toBe("US-2345");
    expect(activeStory.title).toBe("Lead routing validation");
    expect(savedContext.currentStoryId).toBe("US-2345");
  });
});

async function createService(): Promise<StoryContextService> {
  const tempDir = await createTempDir();
  return new StoryContextService(new ConfigStore(tempDir), new ContextStore(tempDir));
}

async function createTempDir(): Promise<string> {
  const dirPath = await mkdtemp(join(tmpdir(), "copado-hx-test-"));
  tempDirs.push(dirPath);
  return dirPath;
}