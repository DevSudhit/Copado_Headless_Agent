import { CicdClient, MockCicdClient } from "../clients/cicd-client.js";
import { assertDeploymentAllowed } from "../policies/deployment-policy.js";
import { ConfigStore } from "../state/config-store.js";
import { ContextStore } from "../state/context-store.js";
import { CliError } from "../types/commands.js";
import { PipelineOperationResult } from "../types/api.js";

import { AIAgentService } from "./ai-agent-service.js";
import {
  compactText,
  coerceString,
  createSyntheticOperationId,
  extractStoryId,
  normalizeOperationStatus,
  parseStructuredJson,
} from "../utils/structured-ai.js";

export class PipelineService {
  private readonly client: CicdClient;

  constructor(
    private readonly configStore = new ConfigStore(),
    private readonly contextStore = new ContextStore(),
    private readonly aiService: Pick<AIAgentService, "ask"> = new AIAgentService(
      configStore,
      contextStore,
    ),
  ) {
    this.client = new MockCicdClient();
  }

  async commit(message: string | undefined, storyIdOverride?: string): Promise<PipelineOperationResult> {
    const storyId = await this.resolveStoryId(storyIdOverride);
    const normalizedMessage = message?.trim() || `chore: copado-hx commit for ${storyId}`;

    if (await this.isMockMode()) {
      return this.client.commit({ storyId, message: normalizedMessage });
    }

    return this.runLiveOperation(
      "build",
      buildCommitPrompt(storyId, normalizedMessage),
      "commit",
      storyId,
    );
  }

  async promote(
    environment: string,
    validate: boolean,
    storyIdOverride?: string,
  ): Promise<PipelineOperationResult> {
    const storyId = await this.resolveStoryId(storyIdOverride);

    if (await this.isMockMode()) {
      const result = await this.client.promote({
        storyId,
        environment,
        validate,
      });

      await this.contextStore.update({ lastPromotionEnvironment: environment });
      return result;
    }

    const result = await this.runLiveOperation(
      "release",
      buildPromotePrompt(storyId, environment, validate),
      "promote",
      storyId,
      environment,
      validate,
    );

    if (result.status !== "failed") {
      await this.contextStore.update({ lastPromotionEnvironment: environment });
    }

    return result;
  }

  async deploy(
    environment: string,
    approved: boolean,
    storyIdOverride?: string,
  ): Promise<PipelineOperationResult> {
    assertDeploymentAllowed(environment, approved);
    const storyId = await this.resolveStoryId(storyIdOverride);

    if (await this.isMockMode()) {
      const result = await this.client.deploy({ storyId, environment });

      await this.contextStore.update({ lastDeploymentEnvironment: environment });
      return result;
    }

    const result = await this.runLiveOperation(
      "release",
      buildDeployPrompt(storyId, environment, approved),
      "deploy",
      storyId,
      environment,
    );

    if (result.status !== "failed") {
      await this.contextStore.update({ lastDeploymentEnvironment: environment });
    }

    return result;
  }

  private async runLiveOperation(
    agent: "build" | "release",
    prompt: string,
    operation: PipelineOperationResult["operation"],
    storyId: string,
    environment?: string,
    validationRequested?: boolean,
  ): Promise<PipelineOperationResult> {
    const response = await this.aiService.ask(agent, prompt, { storyId, useActiveStory: false });

    return toLivePipelineResult(response.answer, operation, storyId, environment, validationRequested);
  }

  private async isMockMode(): Promise<boolean> {
    const config = await this.configStore.load();
    return config.runtimeMode === "mock";
  }

  private async resolveStoryId(storyIdOverride?: string): Promise<string> {
    if (storyIdOverride?.trim()) {
      return storyIdOverride.trim();
    }

    return this.requireCurrentStoryId();
  }

  private async requireCurrentStoryId(): Promise<string> {
    const context = await this.contextStore.load();

    if (!context.currentStoryId) {
      throw new CliError("No active story is set. Use `copado-hx story set --id <story-id>` first.", 2);
    }

    return context.currentStoryId;
  }
}

interface LivePipelineOperationPayload {
  executable?: boolean;
  status?: string;
  operationId?: string;
  storyId?: string;
  environment?: string;
  message?: string;
  detail?: string;
  reason?: string;
  validationRequested?: boolean;
  missing?: string[] | string;
}

function buildCommitPrompt(storyId: string, message: string): string {
  return [
    `Attempt to execute a real Copado commit for user story ${storyId}.`,
    `Commit message: ${message}`,
    "Return only valid JSON.",
    `If the commit starts or completes, return {"executable":true,"status":"queued|running|success|failed","operationId":"...","storyId":"${storyId}","message":"..."}.`,
    `If the commit cannot be executed because of live preconditions, permissions, or missing metadata, return {"executable":false,"status":"failed","storyId":"${storyId}","message":"...","missing":["..."]}.`,
    "Do not invent metadata, environments, credentials, or success.",
    "Do not include markdown or prose.",
  ].join("\n");
}

function buildPromotePrompt(storyId: string, environment: string, validate: boolean): string {
  return [
    `Attempt to execute a real Copado promotion for user story ${storyId} to environment ${environment}.`,
    `Validation requested: ${validate ? "yes" : "no"}`,
    "Return only valid JSON.",
    `If the promotion starts or completes, return {"executable":true,"status":"queued|running|success|failed","operationId":"...","storyId":"${storyId}","environment":"${environment}","validationRequested":${validate ? "true" : "false"},"message":"..."}.`,
    `If the promotion cannot be executed because of live preconditions, permissions, or missing configuration, return {"executable":false,"status":"failed","storyId":"${storyId}","environment":"${environment}","validationRequested":${validate ? "true" : "false"},"message":"...","missing":["..."]}.`,
    "Do not invent environments, approvals, or success.",
    "Do not include markdown or prose.",
  ].join("\n");
}

function buildDeployPrompt(storyId: string, environment: string, approved: boolean): string {
  return [
    `Attempt to execute a real Copado deployment for user story ${storyId} to environment ${environment}.`,
    `Approval provided in this CLI request: ${approved ? "yes" : "no"}`,
    "Return only valid JSON.",
    `If the deployment starts or completes, return {"executable":true,"status":"queued|running|success|failed","operationId":"...","storyId":"${storyId}","environment":"${environment}","message":"..."}.`,
    `If the deployment cannot be executed because of live preconditions, permissions, or missing approval/configuration, return {"executable":false,"status":"failed","storyId":"${storyId}","environment":"${environment}","message":"...","missing":["..."]}.`,
    "Do not invent approvals or success.",
    "Do not include markdown or prose.",
  ].join("\n");
}

function toLivePipelineResult(
  answer: string,
  operation: PipelineOperationResult["operation"],
  storyId: string,
  environment?: string,
  validationRequested?: boolean,
): PipelineOperationResult {
  const defaultOperationId = createSyntheticOperationId(operation.slice(0, 3).toUpperCase());

  if (/CANNOT_EXECUTE/i.test(answer)) {
    return {
      operationId: defaultOperationId,
      operation,
      storyId,
      environment,
      status: "failed",
      message: extractBlockedMessage(answer, operation),
      validationRequested,
    };
  }

  let payload: LivePipelineOperationPayload;

  try {
    payload = parseStructuredJson<LivePipelineOperationPayload>(answer, `Copado ${operation}`);
  } catch {
    return {
      operationId: defaultOperationId,
      operation,
      storyId,
      environment,
      status: "failed",
      message: extractBlockedMessage(answer, operation),
      validationRequested,
    };
  }

  const status = normalizeOperationStatus(payload.status, payload.executable) ?? "failed";
  const missing = normalizeMissing(payload.missing);
  const messageParts = [
    coerceString(payload.message, payload.detail, payload.reason) ??
      `Copado ${operation} returned status ${status}.`,
    missing.length > 0 ? `Missing: ${missing.join(", ")}` : undefined,
  ].filter((part): part is string => Boolean(part));

  return {
    operationId:
      coerceString(payload.operationId) ??
      createSyntheticOperationId(operation.slice(0, 3).toUpperCase()),
    operation,
    storyId: extractStoryId(payload.storyId, storyId) ?? storyId,
    environment: coerceString(payload.environment) ?? environment,
    status,
    message: compactText(messageParts.join(" ")),
    validationRequested: operation === "promote" ? Boolean(payload.validationRequested ?? validationRequested) : undefined,
  };
}

function normalizeMissing(value: string[] | string | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }

  const text = coerceString(value);
  return text ? [text] : [];
}

function extractBlockedMessage(
  answer: string,
  operation: PipelineOperationResult["operation"],
): string {
  const normalized = answer
    .replace(/\*\*/g, "")
    .replace(/CANNOT_EXECUTE/gi, "")
    .replace(/---/g, " ")
    .trim();
  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((item) => compactText(item))
    .filter(Boolean);

  const bestParagraph =
    paragraphs.find((item) => /(cannot|missing|requires|reason|metadata|environment|credential|approval)/i.test(item)) ??
    paragraphs[0];

  return bestParagraph || `Copado ${operation} could not be executed.`;
}