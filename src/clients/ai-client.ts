import { CliError } from "../types/commands.js";
import { AgentName, AgentResponse } from "../types/api.js";

export interface AskAgentRequest {
  agent: AgentName;
  prompt: string;
  storyId?: string;
}

export interface AiClient {
  ask(request: AskAgentRequest): Promise<AgentResponse>;
}

interface LiveAiClientOptions {
  baseUrl: string;
  token: string;
  organizationId: number;
  workspaceId?: string;
  clientName?: string;
}

interface WorkspaceSummary {
  id: string;
  name: string;
}

interface ChatContentPart {
  type?: string;
  text?: string;
  refusal?: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | ChatContentPart[] | null;
    };
  }>;
}

interface ApiErrorBody {
  detail?: unknown;
  message?: string;
  error?: string;
}

export class MockAiClient implements AiClient {
  async ask(request: AskAgentRequest): Promise<AgentResponse> {
    return {
      agent: request.agent,
      prompt: request.prompt,
      storyId: request.storyId,
      answer: buildMockAnswer(request.agent, request.prompt, request.storyId),
    };
  }
}

export class LiveAiClient implements AiClient {
  constructor(private readonly options: LiveAiClientOptions) {}

  async ask(request: AskAgentRequest): Promise<AgentResponse> {
    const workspaceId = await this.resolveWorkspaceId();
    const primaryAnswer = await this.requestAnswer(workspaceId, request, true);
    const answer = primaryAnswer || (await this.requestAnswer(workspaceId, request, false));

    if (!answer) {
      throw new CliError("Copado AI returned no answer text for the requested prompt.", 2);
    }

    return {
      agent: request.agent,
      prompt: request.prompt,
      storyId: request.storyId,
      answer,
    };
  }

  private async requestAnswer(
    workspaceId: string,
    request: AskAgentRequest,
    useExpertRoute: boolean,
  ): Promise<string> {
    const url = new URL(
      `/organizations/${this.options.organizationId}/workspaces/${workspaceId}/v1/chat/completions`,
      normalizeBaseUrl(this.options.baseUrl),
    );

    if (useExpertRoute) {
      url.searchParams.set("expert", request.agent);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: this.buildHeaders(true),
      body: JSON.stringify(buildChatRequest(request, useExpertRoute)),
    });

    if (!response.ok) {
      throw await buildApiError("Copado AI request failed", response);
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    return extractResponseText(payload);
  }

  private async resolveWorkspaceId(): Promise<string> {
    if (this.options.workspaceId) {
      return this.options.workspaceId;
    }

    const url = new URL(
      `/organizations/${this.options.organizationId}/workspaces`,
      normalizeBaseUrl(this.options.baseUrl),
    );
    const response = await fetch(url, {
      method: "GET",
      headers: this.buildHeaders(false),
    });

    if (!response.ok) {
      throw await buildApiError(
        "Copado AI workspace discovery failed. Set COPADO_AI_WORKSPACE_ID to skip discovery",
        response,
      );
    }

    const workspaces = (await response.json()) as WorkspaceSummary[];

    if (workspaces.length === 1) {
      return workspaces[0].id;
    }

    if (workspaces.length === 0) {
      throw new CliError(
        "Copado AI returned no accessible workspaces. Set COPADO_AI_WORKSPACE_ID after creating or joining a workspace.",
        2,
      );
    }

    const workspaceNames = workspaces
      .map((workspace) => workspace.name.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(", ");
    const suffix = workspaceNames ? ` Visible workspaces include: ${workspaceNames}.` : "";

    throw new CliError(
      `Multiple Copado AI workspaces are accessible. Set COPADO_AI_WORKSPACE_ID to choose one.${suffix}`,
      2,
      { workspaceCount: workspaces.length },
    );
  }

  private buildHeaders(includeJsonContentType: boolean): Record<string, string> {
    return {
      ...(includeJsonContentType ? { "Content-Type": "application/json" } : {}),
      "X-Authorization": this.options.token,
      "X-Client": this.options.clientName ?? "copado-hx",
    };
  }
}

function buildMockAnswer(agent: AgentName, prompt: string, storyId?: string): string {
  const storyContext = storyId ? ` for ${storyId}` : "";

  switch (agent) {
    case "plan":
      return `Plan${storyContext}: break the work into implementation, validation, and deployment steps. Prompt received: ${prompt}`;
    case "build":
      return `Build guidance${storyContext}: implement the smallest change set first, then validate it. Prompt received: ${prompt}`;
    case "test":
      return `Testing guidance${storyContext}: run smoke coverage first, then fetch detailed CRT results. Prompt received: ${prompt}`;
    case "release":
      return `Release guidance${storyContext}: summarize promotion, validation, and deployment outcomes. Prompt received: ${prompt}`;
    case "operate":
      return `Operational guidance${storyContext}: capture deployment notes and follow-up actions. Prompt received: ${prompt}`;
  }
}

function buildLivePrompt(request: AskAgentRequest): string {
  if (!request.storyId) {
    return request.prompt;
  }

  return `Current Copado story context: ${request.storyId}\n\n${request.prompt}`;
}

function buildChatRequest(
  request: AskAgentRequest,
  useExpertRoute: boolean,
): { model: string; messages: Array<{ role: "system" | "user"; content: string }>; stream: false } {
  return {
    model: useExpertRoute ? "copado-ai" : "gpt-4.1-mini",
    messages: useExpertRoute
      ? [
          {
            role: "user",
            content: buildLivePrompt(request),
          },
        ]
      : [
          {
            role: "system",
            content: buildFallbackSystemPrompt(request.agent),
          },
          {
            role: "user",
            content: buildLivePrompt(request),
          },
        ],
    stream: false,
  };
}

function buildFallbackSystemPrompt(agent: AgentName): string {
  switch (agent) {
    case "plan":
      return "You are a Copado planning assistant. Return a concise implementation plan with build, test, and release steps.";
    case "build":
      return "You are a Copado build assistant. Return focused implementation guidance and the next concrete engineering steps.";
    case "test":
      return "You are a Copado testing assistant. Return validation guidance with emphasis on fast feedback and test execution.";
    case "release":
      return "You are a Copado release assistant. Return release guidance covering promotion, deployment, and operational risk.";
    case "operate":
      return "You are a Copado operations assistant. Return concise post-deployment and operational guidance.";
  }
}

function normalizeBaseUrl(baseUrl: string): URL {
  return new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
}

function extractResponseText(response: ChatCompletionResponse): string {
  const content = response.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => {
      if (part.type === "text" || part.type === "thinking" || part.type === "tool_use") {
        return part.text ?? "";
      }

      return part.refusal ?? "";
    })
    .join("\n")
    .trim();
}

async function buildApiError(prefix: string, response: Response): Promise<CliError> {
  const detail = await readErrorDetail(response);
  const suffix = detail ? `: ${detail}` : "";

  return new CliError(`${prefix} (${response.status} ${response.statusText})${suffix}`, 2, {
    status: response.status,
  });
}

async function readErrorDetail(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as ApiErrorBody;
    return formatApiErrorBody(payload);
  }

  return (await response.text()).trim().slice(0, 300);
}

function formatApiErrorBody(payload: ApiErrorBody): string {
  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }

  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }

  if (Array.isArray(payload.detail)) {
    return payload.detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item && typeof item === "object" && "msg" in item && typeof item.msg === "string") {
          return item.msg;
        }

        return JSON.stringify(item);
      })
      .join("; ")
      .slice(0, 300);
  }

  if (typeof payload.detail === "string") {
    return payload.detail.trim();
  }

  if (payload.detail !== undefined) {
    return JSON.stringify(payload.detail).slice(0, 300);
  }

  return "";
}