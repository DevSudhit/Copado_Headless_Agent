import { readAiEnv } from "./env-config.js";
import { AgentName, AgentResponse } from "../types/api.js";

export interface AskAgentRequest {
  agent: AgentName;
  prompt: string;
  storyId?: string;
}

export interface AiClient {
  ask(request: AskAgentRequest): Promise<AgentResponse>;
}

/** Returns a LiveAiClient when COPADO_AI_* env vars are present, otherwise MockAiClient. */
export function createAiClient(): AiClient {
  const env = readAiEnv();
  if (env) {
    return new LiveAiClient(env.baseUrl, env.token, env.organizationId, env.workspaceId);
  }
  return new MockAiClient();
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

// ── Live Copado AI client ────────────────────────────────────────────────────
// Copado AI Gateway: copadogpt-api.robotic.copado.com
// Endpoint shape confirmed via OpenAPI spec:
//   POST /organizations/{orgId}/dialogues          → create an ephemeral dialogue
//   POST /organizations/{orgId}/dialogues/{id}/messages → send prompt
//   Response: NDJSON streaming — collect events where type === "token"

interface DialogueCreateBody { name: string; workspaceId?: string; }
interface DialogueResponse   { id: string; }
interface MessageCreateBody  { request_id: string; prompt: string; }
interface StreamEvent        { type: string; content?: string; }

export class LiveAiClient implements AiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly organizationId: string,
    private readonly workspaceId: string,
  ) {}

  async ask(request: AskAgentRequest): Promise<AgentResponse> {
    const headers = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // Step 1 — create an ephemeral dialogue
    const dlgBody: DialogueCreateBody = {
      name: `TrinetraOps-${request.agent}-${Date.now()}`,
      workspaceId: this.workspaceId,
    };
    const dlgRes = await fetch(
      `${this.baseUrl}/organizations/${this.organizationId}/dialogues`,
      { method: "POST", headers, body: JSON.stringify(dlgBody) },
    );
    if (!dlgRes.ok) {
      const text = await dlgRes.text();
      throw new Error(`Copado AI create dialogue failed (${dlgRes.status}): ${text}`);
    }
    const dlg = (await dlgRes.json()) as DialogueResponse;

    // Step 2 — send the prompt and stream the NDJSON response
    const msgBody: MessageCreateBody = { request_id: crypto.randomUUID(), prompt: request.prompt };
    const msgRes = await fetch(
      `${this.baseUrl}/organizations/${this.organizationId}/dialogues/${dlg.id}/messages`,
      { method: "POST", headers, body: JSON.stringify(msgBody) },
    );
    if (!msgRes.ok) {
      const text = await msgRes.text();
      throw new Error(`Copado AI send message failed (${msgRes.status}): ${text}`);
    }

    const answer = await collectStreamedAnswer(msgRes);
    return { agent: request.agent, prompt: request.prompt, storyId: request.storyId, answer };
  }
}

async function collectStreamedAnswer(response: Response): Promise<string> {
  const decoder = new TextDecoder();
  let answer = "";
  let buffer = "";

  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const event = JSON.parse(trimmed) as StreamEvent;
        if (event.type === "token" && typeof event.content === "string") answer += event.content;
      } catch { /* partial or non-JSON line — skip */ }
    }
  }
  if (buffer.trim()) {
    try {
      const event = JSON.parse(buffer.trim()) as StreamEvent;
      if (event.type === "token" && typeof event.content === "string") answer += event.content;
    } catch { /* ignore */ }
  }
  return answer.trim() || "(no answer returned by Copado AI)";
}