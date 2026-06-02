import { SalesforceClient } from "../clients/salesforce-client.js";
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
    // Prefer live Salesforce data when the SF CLI session is available
    const sf = new SalesforceClient();
    if (sf.isAvailable()) {
      const rows = sf.query<Record<string, unknown>>(
        `SELECT Id, Name, copado__Status__c, copado__User_Story_Title__c
         FROM copado__User_Story__c
         ORDER BY Name ASC LIMIT 50`,
      );
      if (rows.length > 0) {
        return rows.map((r) => ({
          id: r["Name"] as string,
          title: (r["copado__User_Story_Title__c"] as string | null) ?? (r["Name"] as string),
          status: (r["copado__Status__c"] as string) ?? "Unknown",
        }));
      }
    }

    // Fall back to mock data
    return MOCK_STORIES;
  }

  async getStory(storyId: string): Promise<Story> {
    const sf = new SalesforceClient();
    if (sf.isAvailable()) {
      const rows = sf.query<Record<string, unknown>>(
        `SELECT Id, Name, copado__Status__c, copado__User_Story_Title__c
         FROM copado__User_Story__c WHERE Name = '${storyId}' LIMIT 1`,
      );
      if (rows.length > 0) {
        const r = rows[0];
        return {
          id: r["Name"] as string,
          title: (r["copado__User_Story_Title__c"] as string | null) ?? (r["Name"] as string),
          status: (r["copado__Status__c"] as string) ?? "Unknown",
        };
      }
    }

    // Fall back to mock
    const story = MOCK_STORIES.find((item) => item.id === storyId);
    if (!story) {
      throw new CliError("Story not found.", 2, { storyId });
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
      throw new CliError("No active story is set. Use `trinetra story set --id <story-id>` first.", 2);
    }

    return this.getStory(context.currentStoryId);
  }
}