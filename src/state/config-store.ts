import { access, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

import { CliError } from "../types/commands.js";
import { ProjectConfig } from "../types/api.js";

const CONFIG_FILE_NAME = ".copado-hx.json";

const DEFAULT_CONFIG: ProjectConfig = {
  runtimeMode: "mock",
  defaultOutput: "text",
};

export class ConfigStore {
  constructor(private readonly rootDir = process.cwd()) {}

  get filePath(): string {
    return resolve(this.rootDir, CONFIG_FILE_NAME);
  }

  async load(): Promise<ProjectConfig> {
    if (!(await fileExists(this.filePath))) {
      return { ...DEFAULT_CONFIG };
    }

    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<ProjectConfig>;
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
      };
    } catch (error) {
      throw new CliError(
        `Unable to read ${CONFIG_FILE_NAME}. Fix the JSON or recreate the file.`,
        1,
        error instanceof Error ? { message: error.message } : undefined,
      );
    }
  }

  async save(config: ProjectConfig): Promise<void> {
    await writeFile(this.filePath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  }

  async update(partial: Partial<ProjectConfig>): Promise<ProjectConfig> {
    const nextConfig = {
      ...(await this.load()),
      ...partial,
    };

    await this.save(nextConfig);
    return nextConfig;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}