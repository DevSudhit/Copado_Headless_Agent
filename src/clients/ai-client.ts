import { AgentName, AgentResponse } from "../types/api.js";

export interface AskAgentRequest {
  agent: AgentName;
  prompt: string;
  storyId?: string;
}

export interface AiClient {
  ask(request: AskAgentRequest): Promise<AgentResponse>;
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