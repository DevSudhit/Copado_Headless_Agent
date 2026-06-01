import { AiClient, LiveAiClient, MockAiClient } from "../clients/ai-client.js";
import { ConfigStore } from "../state/config-store.js";
import { ContextStore } from "../state/context-store.js";
import { TokenStore } from "../state/token-store.js";
import { CliError } from "../types/commands.js";
import { AgentName, AgentResponse, SessionContext } from "../types/api.js";

import { TestingService } from "./testing-service.js";

export interface AskOptions {
  promptContext?: string;
  storyId?: string;
  useActiveStory?: boolean;
}

export class AIAgentService {
  private readonly tokenStore: TokenStore;

  constructor(
    private readonly configStore = new ConfigStore(),
    private readonly contextStore = new ContextStore(),
    private readonly testingService: Pick<TestingService, "getResults"> = new TestingService(
      configStore,
      contextStore,
    ),
  ) {
    this.tokenStore = new TokenStore(configStore);
  }

  async ask(agent: AgentName, prompt: string, options: AskOptions = {}): Promise<AgentResponse> {
    const context = await this.contextStore.load();
    const client = await this.buildClient();
    const storyId = this.resolveStoryId(context, options);
    const promptParts = [
      await this.buildPromptContext(agent, context),
      options.promptContext?.trim(),
      prompt.trim(),
    ].filter((part): part is string => Boolean(part));

    return client.ask({
      agent,
      prompt: promptParts.join("\n\n"),
      storyId,
    });
  }

  private resolveStoryId(context: SessionContext, options: AskOptions): string | undefined {
    if (options.storyId) {
      return options.storyId;
    }

    return options.useActiveStory === false ? undefined : context.currentStoryId;
  }

  private async buildPromptContext(
    agent: AgentName,
    context: SessionContext,
  ): Promise<string | undefined> {
    if (agent !== "test" && agent !== "operate") {
      return undefined;
    }

    const lines = [
      "Verified local CLI facts:",
      context.currentStoryId
        ? `- Active story in this CLI session: ${context.currentStoryId}`
        : "- No active story is set in this CLI session.",
    ];

    if (context.lastTestExecutionId && context.lastTestSuiteId) {
      try {
        const result = await this.testingService.getResults(
          context.lastTestExecutionId,
          context.lastTestSuiteId,
        );

        lines.push(
          `- Live CRT execution ${result.executionId} for suite ${result.suiteId} reports status ${result.status}.`,
        );

        if (typeof result.passed === "number" || typeof result.failed === "number") {
          lines.push(`- Live CRT counts: passed ${result.passed ?? 0}, failed ${result.failed ?? 0}.`);
        }

        if (result.jobDashboardUrl) {
          lines.push(`- CRT job dashboard: ${result.jobDashboardUrl}`);
        }

        if (result.runsDashboardUrl) {
          lines.push(`- CRT runs dashboard: ${result.runsDashboardUrl}`);
        }
      } catch {
        lines.push(
          "- A previous CRT execution is recorded in local CLI state, but the latest live CRT refresh could not be fetched right now.",
        );
      }
    }

    lines.push("- Treat the verified CLI facts above as authoritative local context.");

    if (agent === "test") {
      lines.push(
        "- Do not describe CRT as unconfigured or unavailable if the verified CLI facts above show a live CRT execution.",
      );
    }

    if (agent === "operate") {
      lines.push(
        "- If pipeline linkage, release assignment, or deployment state cannot be confirmed from live data, say not confirmed instead of claiming it is missing.",
      );
    }

    lines.push("- Prefer unknown over guessing.");

    return lines.join("\n");
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