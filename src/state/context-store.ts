import { access, readFile, writeFile } from "node:fs/promises";
import { constants, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CliError } from "../types/commands.js";
import { SessionContext } from "../types/api.js";

const STATE_FILE_NAME = ".copado-hx.state.json";

export class ContextStore {
  constructor(private readonly rootDir = resolveRootDir(STATE_FILE_NAME)) {}

  get filePath(): string {
    return resolve(this.rootDir, STATE_FILE_NAME);
  }

  async load(): Promise<SessionContext> {
    if (!(await fileExists(this.filePath))) {
      return {};
    }

    try {
      const raw = await readFile(this.filePath, "utf8");
      return JSON.parse(raw) as SessionContext;
    } catch (error) {
      throw new CliError(
        `Unable to read ${STATE_FILE_NAME}. Delete it if it becomes corrupted.`,
        1,
        error instanceof Error ? { message: error.message } : undefined,
      );
    }
  }

  async save(context: SessionContext): Promise<void> {
    await writeFile(this.filePath, `${JSON.stringify(context, null, 2)}\n`, "utf8");
  }

  async update(partial: Partial<SessionContext>): Promise<SessionContext> {
    const nextContext = {
      ...(await this.load()),
      ...partial,
    };

    await this.save(nextContext);
    return nextContext;
  }
}

function resolveRootDir(fileName: string): string {
  const cwd = process.cwd();

  if (existsSync(resolve(cwd, fileName))) {
    return cwd;
  }

  return resolve(fileURLToPath(new URL("../..", import.meta.url)));
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}