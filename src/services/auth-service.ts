import { ConfigStore } from "../state/config-store.js";
import { TokenStore } from "../state/token-store.js";
import { CliError } from "../types/commands.js";
import {
  COPADO_SERVICES,
  CopadoServiceName,
  ProjectConfig,
  RuntimeMode,
  ServiceStatus,
} from "../types/api.js";

export interface LoginOptions {
  runtimeMode: RuntimeMode;
  service?: CopadoServiceName;
  activeProfile?: string;
  baseUrl?: string;
  tokenEnvVar?: string;
}

export interface AuthStatus {
  configured: boolean;
  runtimeMode: RuntimeMode;
  activeProfile?: string;
  services: ServiceStatus[];
}

export class AuthService {
  private readonly tokenStore: TokenStore;

  constructor(private readonly configStore = new ConfigStore()) {
    this.tokenStore = new TokenStore(configStore);
  }

  async login(options: LoginOptions): Promise<AuthStatus> {
    if (options.runtimeMode === "live" && !options.service) {
      throw new CliError("Live mode requires --service <cicd|ai|crt>.", 2);
    }

    if (options.runtimeMode === "live" && !options.baseUrl) {
      throw new CliError("Live mode requires --base-url.", 2);
    }

    const currentConfig = await this.configStore.load();
    let nextConfig: ProjectConfig = {
      ...currentConfig,
      runtimeMode: options.runtimeMode,
      activeProfile: options.activeProfile ?? currentConfig.activeProfile,
    };

    if (options.runtimeMode === "live" && options.service) {
      nextConfig = {
        ...nextConfig,
        services: {
          ...currentConfig.services,
          [options.service]: {
            ...currentConfig.services[options.service],
            enabled: true,
            baseUrl: options.baseUrl,
            auth: {
              ...currentConfig.services[options.service].auth,
              tokenEnvVar: options.tokenEnvVar ?? currentConfig.services[options.service].auth.tokenEnvVar,
            },
          },
        },
      };
    }

    await this.configStore.save(nextConfig);
    return this.status();
  }

  async status(): Promise<AuthStatus> {
    const config = await this.configStore.load();
    const services = await Promise.all(COPADO_SERVICES.map((service) => this.buildServiceStatus(service, config)));

    return {
      configured: config.runtimeMode === "mock" || services.some((service) => service.configured),
      runtimeMode: config.runtimeMode,
      activeProfile: config.activeProfile,
      services,
    };
  }

  async logout(): Promise<AuthStatus> {
    const currentConfig = await this.configStore.load();

    await this.configStore.save({
      ...currentConfig,
      runtimeMode: "mock",
      defaultOutput: currentConfig.defaultOutput,
      services: {
        cicd: {
          enabled: false,
          auth: {
            type: "bearer",
          },
        },
        ai: {
          enabled: false,
          auth: {
            type: "bearer",
          },
        },
        crt: {
          enabled: false,
          auth: {
            type: "bearer",
          },
        },
      },
    });

    return this.status();
  }

  private async buildServiceStatus(service: CopadoServiceName, config: ProjectConfig): Promise<ServiceStatus> {
    const serviceConfig = config.services[service];
    const tokenEnvVar = serviceConfig.auth.tokenEnvVar;
    const token = tokenEnvVar ? await this.tokenStore.getToken(service) : undefined;

    return {
      service,
      enabled: serviceConfig.enabled,
      configured: serviceConfig.enabled && Boolean(serviceConfig.baseUrl) && Boolean(tokenEnvVar),
      baseUrl: serviceConfig.baseUrl,
      tokenEnvVar,
      tokenPresent: Boolean(token),
    };
  }
}