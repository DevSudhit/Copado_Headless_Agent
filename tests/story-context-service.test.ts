import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import type { AIAgentService } from "../src/services/ai-agent-service.js";
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

  it("filters mock stories by pipeline and status", async () => {
    const service = await createService();

    const stories = await service.listStories({
      pipeline: "Trial - Salesforce Source Format Pipeline",
      status: "In Progress",
    });

    expect(stories).toHaveLength(1);
    expect(stories[0]?.id).toBe("US-2345");
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

  it("uses the live AI-backed story lookup in live runtime mode", async () => {
    const tempDir = await createTempDir();
    const configStore = new ConfigStore(tempDir);
    const contextStore = new ContextStore(tempDir);
    const aiService = {
      ask: async () => ({
        agent: "build",
        prompt: "",
        storyId: "US-0000026",
        answer:
          'Looking it up now.\n\n{"found":true,"id":"US-0000026","title":"Live story","status":"In Progress","description":"Live description"}',
      }),
    } as Pick<AIAgentService, "ask">;
    const service = new StoryContextService(configStore, contextStore, aiService);

    await configStore.update({ runtimeMode: "live" });

    const story = await service.getStory("US-0000026");

    expect(story.id).toBe("US-0000026");
    expect(story.title).toBe("Live story");
    expect(story.status).toBe("In Progress");
  });

  it("creates a mock story with pipeline metadata in mock runtime mode", async () => {
    const service = await createService();

    const story = await service.createStory({
      title: "Demo story",
      pipeline: "Trial - Salesforce Source Format Pipeline",
      description: "Created during a focused test.",
    });

    expect(story.id).toMatch(/^US-\d+$/);
    expect(story.title).toBe("Demo story");
    expect(story.status).toBe("Draft");
    expect(story.pipelineName).toBe("Trial - Salesforce Source Format Pipeline");
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