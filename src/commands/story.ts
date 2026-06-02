import { Command } from "commander";

import { StoryContextService } from "../services/story-context-service.js";

import { formatStoryLine, runCommand } from "./command-support.js";

interface StoryIdentityOptions {
  id: string;
}

interface StoryUpdateOptions {
  id: string;
  status: string;
}

export function registerStoryCommands(program: Command, storyService: StoryContextService): void {
  const story = program.command("story").description("Manage active Copado user story context");

  story
    .command("list")
    .description("List stories in the current runtime mode")
    .action(async (_options: Record<string, never>, command: Command) => {
      await runCommand(command, async () => {
        const stories = await storyService.listStories();
        return {
          summary: stories
            .map((item) => formatStoryLine(item.id, item.status, item.title))
            .join("\n"),
          data: stories,
        };
      });
    });

  story
    .command("show")
    .description("Show one story by ID")
    .requiredOption("--id <story-id>", "Story ID to show")
    .action(async (options: StoryIdentityOptions, command: Command) => {
      await runCommand(command, async () => {
        const item = await storyService.getStory(options.id);
        return {
          summary: [
            `Story: ${item.id}`,
            `Title: ${item.title}`,
            `Status: ${item.status}`,
            `Description: ${item.description ?? "n/a"}`,
          ].join("\n"),
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
          summary: [
            `Active story: ${item.id}`,
            `Title: ${item.title}`,
            `Status: ${item.status}`,
          ].join("\n"),
          data: item,
        };
      });
    });

  story
    .command("update")
    .description("Update a story field (e.g. status)")
    .requiredOption("--id <story-id>", "Story ID to update")
    .requiredOption("--status <status>", "New status value (e.g. Completed, In Progress, Draft)")
    .action(async (options: StoryUpdateOptions, command: Command) => {
      await runCommand(command, async () => {
        const item = await storyService.updateStory(options.id, options.status);
        return {
          summary: `Story ${item.id} updated — Status: ${item.status}`,
          data: item,
        };
      });
    });
}