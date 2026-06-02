import { CicdClient, createCicdClient } from "../clients/cicd-client.js";
import { assertDeploymentAllowed } from "../policies/deployment-policy.js";
import { ContextStore } from "../state/context-store.js";
import { CliError } from "../types/commands.js";
import { PipelineOperationResult } from "../types/api.js";

export class PipelineService {
  private readonly client: CicdClient;

  constructor(
    private readonly contextStore = new ContextStore(),
  ) {
    this.client = createCicdClient();
  }

  async commit(message: string): Promise<PipelineOperationResult> {
    const storyId = await this.requireCurrentStoryId();
    const result = await this.client.commit({ storyId, message });
    // Record the CLI commit in local state so Replay Engine can surface it
    const ctx = await this.contextStore.load();
    const history = ctx.commitHistory ?? [];
    history.push({
      operationId: result.operationId,
      storyId,
      message,
      timestamp: new Date().toISOString(),
    });
    await this.contextStore.update({ commitHistory: history });
    return result;
  }

  async promote(environment: string, validate: boolean): Promise<PipelineOperationResult> {
    const storyId = await this.requireCurrentStoryId();
    const result = await this.client.promote({ storyId, environment, validate });
    await this.contextStore.update({ lastPromotionEnvironment: environment });
    return result;
  }

  async deploy(environment: string, approved: boolean): Promise<PipelineOperationResult> {
    assertDeploymentAllowed(environment, approved);
    const storyId = await this.requireCurrentStoryId();
    const result = await this.client.deploy({ storyId, environment });
    await this.contextStore.update({ lastDeploymentEnvironment: environment });
    return result;
  }

  private async requireCurrentStoryId(): Promise<string> {
    const context = await this.contextStore.load();
    if (!context.currentStoryId) {
      throw new CliError("No active story is set. Use `copado-hx story set --id <story-id>` first.", 2);
    }
    return context.currentStoryId;
  }
}