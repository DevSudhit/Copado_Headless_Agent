import { AiClient, createAiClient } from "../clients/ai-client.js";
import { ContextStore } from "../state/context-store.js";
import { AgentName, AgentResponse } from "../types/api.js";

export class AIAgentService {
  private readonly client: AiClient;

  constructor(
    private readonly contextStore = new ContextStore(),
  ) {
    this.client = createAiClient();
  }

  async ask(agent: AgentName, prompt: string): Promise<AgentResponse> {
    const context = await this.contextStore.load();

    return this.client.ask({
      agent,
      prompt,
      storyId: context.currentStoryId,
    });
  }
}