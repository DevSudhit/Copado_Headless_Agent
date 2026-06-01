import { Command } from "commander";

import { StoryContextService } from "../services/story-context-service.js";
import { Story } from "../types/api.js";

import { formatStoryLine, runCommand } from "./command-support.js";

interface StoryListOptions {
  pipeline?: string;
  status?: string;
}

interface StoryShowOptions {
  id?: string;
}

interface StoryIdentityOptions {
  id: string;
}

interface StoryCreateOptions {
  title: string;
  pipeline: string;
  description?: string;
}

export function registerStoryCommands(program: Command, storyService: StoryContextService): void {
  const story = program.command("story").description("Manage active Copado user story context");

  story
    .command("list")
    .description("List stories in the current runtime mode")
    .option("--pipeline <pipeline-id-or-name>", "Filter stories by pipeline identifier or name")
    .option("--status <status>", "Filter stories by Copado status")
    .action(async (options: StoryListOptions, command: Command) => {
      await runCommand(command, async () => {
        const stories = await storyService.listStories(options);
        return {
          summary: stories.length > 0 ? stories.map(formatStorySummary).join("\n") : "No stories matched the provided filters.",
          data: stories,
        };
      });
    });

  story
    .command("show")
    .description("Show the current story, or one story by ID")
    .option("--id <story-id>", "Story ID to show")
    .action(async (options: StoryShowOptions, command: Command) => {
      await runCommand(command, async () => {
        const item = options.id ? await storyService.getStory(options.id) : await storyService.getCurrentStory();
        return {
          summary: formatStoryDetails(item, "Story"),
          data: item,
        };
      });
    });

  story
    .command("create")
    .description("Create a Copado user story")
    .requiredOption("--title <title>", "User story title")
    .requiredOption("--pipeline <pipeline-id-or-name>", "Target Copado pipeline identifier or name")
    .option("--description <description>", "User story description")
    .action(async (options: StoryCreateOptions, command: Command) => {
      await runCommand(command, async () => {
        const item = await storyService.createStory(options);
        return {
          summary: [`Created story ${item.id}`, formatStoryDetails(item, "Story")].join("\n"),
          data: item,
        };
      });
    });

  story
    .command("set")
    .description("Set the active story context")
    .requiredOption("--id <story-id>", "Story ID to set as active")
    .action(async (options: StoryIdentityOptions, command: Command) => {
      await runCommand(command, async () => {
        const item = await storyService.setCurrentStory(options.id);
        return {
          summary: `Active story set to ${item.id}: ${item.title}`,
          data: item,
        };
      });
    });

  story
    .command("current")
    .description("Show the active story context")
    .action(async (_options: Record<string, never>, command: Command) => {
      await runCommand(command, async () => {
        const item = await storyService.getCurrentStory();
        return {
          summary: formatStoryDetails(item, "Active story"),
          data: item,
        };
      });
    });
}

function formatStorySummary(item: Story): string {
  return formatStoryLine(item.id, item.status, item.title, item.pipelineName ?? item.pipelineId);
}

function formatStoryDetails(item: Story, label: string): string {
  return [
    `${label}: ${item.id}`,
    `Title: ${item.title}`,
    `Status: ${item.status}`,
    ...(item.pipelineName || item.pipelineId
      ? [`Pipeline: ${item.pipelineName ?? item.pipelineId}${item.pipelineName && item.pipelineId ? ` (${item.pipelineId})` : ""}`]
      : []),
    `Description: ${item.description ?? "n/a"}`,
  ].join("\n");
}