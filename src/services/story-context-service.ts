import { ConfigStore } from "../state/config-store.js";
import { ContextStore } from "../state/context-store.js";
import { CliError } from "../types/commands.js";
import { Story } from "../types/api.js";

const MOCK_STORIES: Story[] = [
  {
    id: "US-1234",
    title: "Scoring service improvements",
    status: "Ready for Build",
    description: "Update scoring logic and commit metadata handling.",
  },
  {
    id: "US-2345",
    title: "Lead routing validation",
    status: "In Progress",
    description: "Add validation rules and smoke coverage for lead assignment.",
  },
  {
    id: "US-3456",
    title: "Release notes generation",
    status: "Ready for QA",
    description: "Automate release note generation after promotion and deployment.",
  },
];

export class StoryContextService {
  constructor(
    private readonly configStore = new ConfigStore(),
    private readonly contextStore = new ContextStore(),
  ) {}

  async listStories(): Promise<Story[]> {
    const config = await this.configStore.load();

    if (config.runtimeMode !== "mock") {
      throw new CliError(
        "Live Copado story APIs are not wired yet. Switch to mock mode or implement the real client next.",
        2,
      );
    }

    return MOCK_STORIES;
  }

  async getStory(storyId: string): Promise<Story> {
    const stories = await this.listStories();
    const story = stories.find((item) => item.id === storyId);

    if (!story) {
      throw new CliError("Story not found in the current runtime mode.", 2, { storyId });
    }

    return story;
  }

  async setCurrentStory(storyId: string): Promise<Story> {
    const story = await this.getStory(storyId);
    await this.contextStore.update({ currentStoryId: storyId });
    return story;
  }

  async getCurrentStory(): Promise<Story> {
    const context = await this.contextStore.load();

    if (!context.currentStoryId) {
      throw new CliError("No active story is set. Use `copado-hx story set --id <story-id>` first.", 2);
    }

    return this.getStory(context.currentStoryId);
  }
}