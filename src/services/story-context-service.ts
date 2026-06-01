import { ConfigStore } from "../state/config-store.js";
import { ContextStore } from "../state/context-store.js";
import { CliError } from "../types/commands.js";
import { Story, StoryCreateInput, StoryListFilters } from "../types/api.js";

import { AIAgentService } from "./ai-agent-service.js";
import { coerceString, extractStoryId, parseStructuredJson } from "../utils/structured-ai.js";

const MOCK_STORIES: Story[] = [
  {
    id: "US-1234",
    title: "Scoring service improvements",
    status: "Ready for Build",
    description: "Update scoring logic and commit metadata handling.",
    pipelineId: "PIPE-100",
    pipelineName: "Trial - Salesforce Source Format Pipeline",
  },
  {
    id: "US-2345",
    title: "Lead routing validation",
    status: "In Progress",
    description: "Add validation rules and smoke coverage for lead assignment.",
    pipelineId: "PIPE-100",
    pipelineName: "Trial - Salesforce Source Format Pipeline",
  },
  {
    id: "US-3456",
    title: "Release notes generation",
    status: "Ready for QA",
    description: "Automate release note generation after promotion and deployment.",
    pipelineId: "PIPE-200",
    pipelineName: "Release Automation Pipeline",
  },
];

export class StoryContextService {
  constructor(
    private readonly configStore = new ConfigStore(),
    private readonly contextStore = new ContextStore(),
    private readonly aiService: Pick<AIAgentService, "ask"> = new AIAgentService(
      configStore,
      contextStore,
    ),
  ) {}

  async listStories(filters: StoryListFilters = {}): Promise<Story[]> {
    const config = await this.configStore.load();
    const stories = config.runtimeMode !== "mock" ? await this.listLiveStories(filters) : MOCK_STORIES;

    return filterStories(stories, filters);
  }

  async getStory(storyId: string): Promise<Story> {
    const config = await this.configStore.load();

    if (config.runtimeMode !== "mock") {
      return this.getLiveStory(storyId);
    }

    const stories = await this.listStories();
    const story = stories.find((item) => item.id === storyId);

    if (!story) {
      throw new CliError("Story not found in the current runtime mode.", 2, { storyId });
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
      throw new CliError("No active story is set. Use `copado-hx story set --id <story-id>` first.", 2);
    }

    return this.getStory(context.currentStoryId);
  }

  async createStory(input: StoryCreateInput): Promise<Story> {
    const config = await this.configStore.load();

    if (config.runtimeMode === "mock") {
      return {
        id: createMockStoryId(),
        title: input.title,
        status: "Draft",
        description: input.description,
        pipelineId: input.pipeline,
        pipelineName: input.pipeline,
      };
    }

    return this.createLiveStory(input);
  }

  private async listLiveStories(filters: StoryListFilters): Promise<Story[]> {
    const response = await this.aiService.ask(
      "build",
      [
        "Return only valid JSON.",
        "List up to 20 Copado user stories visible in the current workspace.",
        filters.pipeline
          ? `Only include stories whose pipeline id or pipeline name matches: ${filters.pipeline}.`
          : "Include stories across all visible pipelines.",
        filters.status
          ? `Only include stories whose status matches: ${filters.status}.`
          : "Include stories across all visible statuses.",
        'Return either a JSON array or an object with a "stories" array.',
        'Each story must include: id, title, status, description, pipelineId, pipelineName.',
        "Use the Copado user story id like US-0000026 in the id field, never a Salesforce record id.",
        "Do not include markdown or prose.",
      ].join("\n"),
      { useActiveStory: false },
    );

    const payload = parseStructuredJson<LiveStoryListPayload | LiveStoryPayload[]>(
      response.answer,
      "Copado story list",
    );
    const items = Array.isArray(payload) ? payload : payload.stories ?? [];
    const stories = items
      .map((item) => normalizeLiveStory(item))
      .filter((item): item is Story => Boolean(item));

    if (stories.length === 0) {
      return [];
    }

    return dedupeStories(stories);
  }

  private async getLiveStory(storyId: string): Promise<Story> {
    const response = await this.aiService.ask(
      "build",
      [
        `Find the Copado user story ${storyId}.`,
        "Return only valid JSON.",
        `If found, return {"found":true,"id":"${storyId}","title":"...","status":"...","description":"...","pipelineId":"...","pipelineName":"..."}.`,
        `If the story is not found or not accessible, return {"found":false,"id":"${storyId}","message":"..."}.`,
        "Use the Copado user story id like US-0000026 in the id field, never a Salesforce record id.",
        "Do not include markdown or prose.",
      ].join("\n"),
      { storyId, useActiveStory: false },
    );

    const payload = parseStructuredJson<LiveStoryLookupPayload>(response.answer, `Copado story ${storyId}`);

    if (payload.found === false) {
      throw new CliError(payload.message ?? `Story ${storyId} was not found in Copado.`, 2, {
        storyId,
      });
    }

    const story = normalizeLiveStory(payload, storyId);

    if (!story) {
      throw new CliError(`Copado AI returned an incomplete story payload for ${storyId}.`, 2, {
        storyId,
      });
    }

    return {
      ...story,
      id: storyId,
    };
  }

  private async createLiveStory(input: StoryCreateInput): Promise<Story> {
    const response = await this.aiService.ask(
      "build",
      [
        `Attempt to create a Copado user story in pipeline ${input.pipeline}.`,
        `Title: ${input.title}`,
        input.description ? `Description: ${input.description}` : "Description: none provided.",
        "Return only valid JSON.",
        'If creation succeeds, return {"created":true,"id":"US-0000026","title":"...","status":"...","description":"...","pipelineId":"...","pipelineName":"...","message":"..."}.',
        'If creation fails or cannot be verified, return {"created":false,"id":"","title":"...","status":"Draft","description":"...","pipelineId":"...","pipelineName":"...","message":"..."}.',
        "Use the Copado user story id like US-0000026 in the id field, never a Salesforce record id.",
        "Do not include markdown or prose.",
      ].join("\n"),
      { useActiveStory: false },
    );

    const payload = parseStructuredJson<LiveStoryCreatePayload>(response.answer, "Copado story create");

    if (payload.created === false) {
      throw new CliError(payload.message ?? `Copado could not create the story \"${input.title}\".`, 2, {
        pipeline: input.pipeline,
        title: input.title,
      });
    }

    const story = normalizeLiveStory(
      {
        ...payload,
        title: payload.title ?? input.title,
        description: payload.description ?? input.description,
        pipelineId: payload.pipelineId ?? input.pipeline,
        pipelineName: payload.pipelineName ?? input.pipeline,
      },
      extractStoryId(payload.id, payload.message),
    );

    if (!story) {
      throw new CliError(`Copado AI returned an incomplete story creation payload for \"${input.title}\".`, 2, {
        pipeline: input.pipeline,
        title: input.title,
      });
    }

    return story;
  }
}

interface LiveStoryListPayload {
  stories?: LiveStoryPayload[];
}

interface LiveStoryLookupPayload extends LiveStoryPayload {
  found?: boolean;
  message?: string;
}

interface LiveStoryCreatePayload extends LiveStoryPayload {
  created?: boolean;
  message?: string;
}

interface LiveStoryPayload {
  id?: string;
  storyId?: string;
  name?: string;
  title?: string;
  summary?: string;
  status?: string;
  state?: string;
  description?: string;
  pipelineId?: string;
  pipelineName?: string;
  pipeline?: string;
  pipelineLabel?: string;
  deliveryPipeline?: string;
}

function normalizeLiveStory(payload: LiveStoryPayload, fallbackId?: string): Story | undefined {
  const id = extractStoryId(payload.id, payload.storyId, payload.name, payload.description, fallbackId);

  if (!id) {
    return undefined;
  }

  return {
    id,
    title: coerceString(payload.title, payload.name, payload.summary) ?? id,
    status: coerceString(payload.status, payload.state) ?? "Unknown",
    description: coerceString(payload.description, payload.summary),
    pipelineId: coerceString(payload.pipelineId),
    pipelineName: coerceString(
      payload.pipelineName,
      payload.pipelineLabel,
      payload.deliveryPipeline,
      payload.pipeline,
    ),
  };
}

function dedupeStories(stories: Story[]): Story[] {
  const byId = new Map<string, Story>();

  for (const story of stories) {
    const existing = byId.get(story.id);

    byId.set(story.id, {
      ...story,
      pipelineId: story.pipelineId ?? existing?.pipelineId,
      pipelineName: story.pipelineName ?? existing?.pipelineName,
      description: story.description ?? existing?.description,
    });
  }

  return [...byId.values()];
}

function filterStories(stories: Story[], filters: StoryListFilters): Story[] {
  const normalizedStatus = normalizeFilter(filters.status);
  const normalizedPipeline = normalizeFilter(filters.pipeline);

  return stories.filter((story) => {
    if (normalizedStatus && normalizeFilter(story.status) !== normalizedStatus) {
      return false;
    }

    if (!normalizedPipeline) {
      return true;
    }

    return [story.pipelineId, story.pipelineName]
      .map((value) => normalizeFilter(value))
      .some((value) => Boolean(value) && value.includes(normalizedPipeline));
  });
}

function normalizeFilter(value?: string): string {
  return value?.trim().toLowerCase() ?? "";
}

function createMockStoryId(): string {
  return `US-${Date.now().toString().slice(-7)}`;
}