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
  it("lists stories (live from org or mock fallback)", async () => {
    const service = await createService();

    const stories = await service.listStories();

    expect(stories.length).toBeGreaterThan(0);
    expect(stories[0]).toHaveProperty("id");
    expect(stories[0]).toHaveProperty("title");
    expect(stories[0]).toHaveProperty("status");
  }, 30_000);

  it("persists and reloads the active story", async () => {
    const service = await createService();

    // Use a story ID we know exists in the live org (or mock fallback)
    const stories = await service.listStories();
    const firstStory = stories[0];

    await service.setCurrentStory(firstStory.id);

    const activeStory = await service.getCurrentStory();

    expect(activeStory.id).toBe(firstStory.id);
  }, 30_000);
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