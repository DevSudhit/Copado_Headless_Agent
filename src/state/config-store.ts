import { access, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

import { CliError } from "../types/commands.js";
import {
  COPADO_SERVICES,
  CopadoServiceConfig,
  CopadoServiceName,
  EnvironmentPolicy,
  ProjectConfig,
  SalesforceProjectConfig,
  ServiceAuthConfig,
} from "../types/api.js";

const CONFIG_FILE_NAME = ".copado-hx.json";

const DEFAULT_CONFIG: ProjectConfig = {
  runtimeMode: "mock",
  defaultOutput: "text",
  activeProfile: "playground",
  services: {
    cicd: createDefaultServiceConfig(),
    ai: createDefaultServiceConfig(),
    crt: createDefaultServiceConfig(),
  },
  salesforce: {
    sourceFormatRequired: true,
    projectRoot: "force-app",
    connectedAppsRequired: true,
  },
  environments: {
    UAT: {
      requiresValidation: true,
    },
    PROD: {
      requiresApproval: true,
      requiresValidation: true,
    },
  },
};

interface LegacyProjectConfig {
  runtimeMode?: ProjectConfig["runtimeMode"];
  defaultOutput?: ProjectConfig["defaultOutput"];
  activeProfile?: ProjectConfig["activeProfile"];
  apiBaseUrl?: string;
  tokenEnvVar?: string;
  services?: Partial<Record<CopadoServiceName, LegacyServiceConfig>>;
  salesforce?: Partial<SalesforceProjectConfig>;
  environments?: Record<string, Partial<EnvironmentPolicy>>;
}

interface LegacyServiceConfig {
  enabled?: boolean;
  baseUrl?: string;
  auth?: Partial<ServiceAuthConfig>;
}

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
      const parsed = JSON.parse(raw) as LegacyProjectConfig;
      return normalizeProjectConfig(parsed);
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
    const currentConfig = await this.load();
    const nextConfig = normalizeProjectConfig({
      ...currentConfig,
      ...partial,
      services: mergeServices(currentConfig.services, partial.services),
      salesforce: {
        ...currentConfig.salesforce,
        ...partial.salesforce,
      },
      environments: mergeEnvironments(currentConfig.environments, partial.environments),
    });

    await this.save(nextConfig);
    return nextConfig;
  }
}

function createDefaultServiceConfig(): CopadoServiceConfig {
  return {
    enabled: false,
    auth: {
      type: "bearer",
    },
  };
}

function normalizeProjectConfig(parsed: LegacyProjectConfig): ProjectConfig {
  return {
    runtimeMode: parsed.runtimeMode ?? DEFAULT_CONFIG.runtimeMode,
    defaultOutput: parsed.defaultOutput ?? DEFAULT_CONFIG.defaultOutput,
    activeProfile: parsed.activeProfile ?? DEFAULT_CONFIG.activeProfile,
    services: {
      cicd: normalizeServiceConfig(parsed.services?.cicd, parsed.apiBaseUrl, parsed.tokenEnvVar),
      ai: normalizeServiceConfig(parsed.services?.ai),
      crt: normalizeServiceConfig(parsed.services?.crt),
    },
    salesforce: {
      ...DEFAULT_CONFIG.salesforce,
      ...parsed.salesforce,
    },
    environments: mergeEnvironments(DEFAULT_CONFIG.environments, parsed.environments),
  };
}

function normalizeServiceConfig(
  service: LegacyServiceConfig | undefined,
  legacyBaseUrl?: string,
  legacyTokenEnvVar?: string,
): CopadoServiceConfig {
  const baseUrl = service?.baseUrl ?? legacyBaseUrl;
  const tokenEnvVar = service?.auth?.tokenEnvVar ?? legacyTokenEnvVar;

  return {
    enabled: service?.enabled ?? Boolean(baseUrl || tokenEnvVar),
    baseUrl,
    auth: {
      type: service?.auth?.type ?? "bearer",
      tokenEnvVar,
    },
  };
}

function mergeServices(
  currentServices: ProjectConfig["services"],
  partialServices: Partial<ProjectConfig["services"]> | undefined,
): ProjectConfig["services"] {
  if (!partialServices) {
    return currentServices;
  }

  return {
    cicd: mergeServiceConfig(currentServices.cicd, partialServices.cicd),
    ai: mergeServiceConfig(currentServices.ai, partialServices.ai),
    crt: mergeServiceConfig(currentServices.crt, partialServices.crt),
  };
}

function mergeServiceConfig(
  currentService: CopadoServiceConfig,
  partialService: Partial<CopadoServiceConfig> | undefined,
): CopadoServiceConfig {
  if (!partialService) {
    return currentService;
  }

  return {
    ...currentService,
    ...partialService,
    auth: {
      ...currentService.auth,
      ...partialService.auth,
    },
  };
}

function mergeEnvironments(
  currentEnvironments: Record<string, EnvironmentPolicy>,
  partialEnvironments: Record<string, Partial<EnvironmentPolicy>> | undefined,
): Record<string, EnvironmentPolicy> {
  if (!partialEnvironments) {
    return currentEnvironments;
  }

  const mergedEnvironments = { ...currentEnvironments };

  for (const [environment, policy] of Object.entries(partialEnvironments)) {
    mergedEnvironments[environment] = {
      ...(currentEnvironments[environment] ?? {}),
      ...policy,
    };
  }

  return mergedEnvironments;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}