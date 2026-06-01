import { AiClient, LiveAiClient, MockAiClient } from "../clients/ai-client.js";
import { ConfigStore } from "../state/config-store.js";
import { ContextStore } from "../state/context-store.js";
import { TokenStore } from "../state/token-store.js";
import { CliError } from "../types/commands.js";
import { AgentName, AgentResponse } from "../types/api.js";

export class AIAgentService {
  private readonly tokenStore: TokenStore;

  constructor(
    private readonly configStore = new ConfigStore(),
    private readonly contextStore = new ContextStore(),
  ) {
    this.tokenStore = new TokenStore(configStore);
  }

  async ask(agent: AgentName, prompt: string): Promise<AgentResponse> {
    const context = await this.contextStore.load();
    const client = await this.buildClient();

    return client.ask({
      agent,
      prompt,
      storyId: context.currentStoryId,
    });
  }

  private async buildClient(): Promise<AiClient> {
    const config = await this.configStore.load();

    if (config.runtimeMode === "mock") {
      return new MockAiClient();
    }

    const aiConfig = config.services.ai;

    if (!aiConfig.enabled || !aiConfig.baseUrl) {
      throw new CliError(
        "Copado AI live mode requires the AI service to be enabled with a base URL. Run `copado-hx auth login --mode live --service ai ...` first.",
        2,
      );
    }

    const token = await this.tokenStore.getToken("ai");

    if (!token) {
      throw new CliError(
        "Copado AI live mode requires the configured token environment variable to be present in the current shell.",
        2,
      );
    }

    const organizationId = Number.parseInt(process.env.COPADO_AI_ORGANIZATION_ID ?? "", 10);

    if (!Number.isInteger(organizationId)) {
      throw new CliError(
        "Copado AI live mode requires COPADO_AI_ORGANIZATION_ID to be set to a numeric organization id.",
        2,
      );
    }

    const workspaceId = process.env.COPADO_AI_WORKSPACE_ID?.trim() || undefined;

    return new LiveAiClient({
      baseUrl: aiConfig.baseUrl,
      token,
      organizationId,
      workspaceId,
    });
  }
}