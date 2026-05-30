import { AiClient, MockAiClient } from "../clients/ai-client.js";
import { ConfigStore } from "../state/config-store.js";
import { ContextStore } from "../state/context-store.js";
import { CliError } from "../types/commands.js";
import { AgentName, AgentResponse } from "../types/api.js";

export class AIAgentService {
  private readonly client: AiClient;

  constructor(
    private readonly configStore = new ConfigStore(),
    private readonly contextStore = new ContextStore(),
  ) {
    this.client = new MockAiClient();
  }

  async ask(agent: AgentName, prompt: string): Promise<AgentResponse> {
    const config = await this.configStore.load();

    if (config.runtimeMode !== "mock") {
      throw new CliError(
        "Copado AI integration is only mocked right now. Set runtime mode to mock or implement the live AI client next.",
        2,
      );
    }

    const context = await this.contextStore.load();

    return this.client.ask({
      agent,
      prompt,
      storyId: context.currentStoryId,
    });
  }
}