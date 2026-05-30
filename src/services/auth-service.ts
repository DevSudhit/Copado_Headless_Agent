import { ConfigStore } from "../state/config-store.js";
import { TokenStore } from "../state/token-store.js";
import { CliError } from "../types/commands.js";
import { ProjectConfig, RuntimeMode } from "../types/api.js";

export interface LoginOptions {
  runtimeMode: RuntimeMode;
  apiBaseUrl?: string;
  tokenEnvVar?: string;
}

export interface AuthStatus {
  configured: boolean;
  runtimeMode: RuntimeMode;
  apiBaseUrl?: string;
  tokenEnvVar?: string;
  tokenPresent: boolean;
}

export class AuthService {
  private readonly tokenStore: TokenStore;

  constructor(private readonly configStore = new ConfigStore()) {
    this.tokenStore = new TokenStore(configStore);
  }

  async login(options: LoginOptions): Promise<AuthStatus> {
    if (options.runtimeMode === "live" && !options.apiBaseUrl) {
      throw new CliError("Live mode requires --base-url.", 2);
    }

    const currentConfig = await this.configStore.load();
    const nextConfig: ProjectConfig = {
      ...currentConfig,
      runtimeMode: options.runtimeMode,
      apiBaseUrl: options.apiBaseUrl,
      tokenEnvVar: options.tokenEnvVar,
    };

    await this.configStore.save(nextConfig);
    return this.status();
  }

  async status(): Promise<AuthStatus> {
    const config = await this.configStore.load();
    const token = await this.tokenStore.getToken();

    return {
      configured: config.runtimeMode === "mock" || Boolean(config.apiBaseUrl),
      runtimeMode: config.runtimeMode,
      apiBaseUrl: config.apiBaseUrl,
      tokenEnvVar: config.tokenEnvVar,
      tokenPresent: Boolean(token),
    };
  }

  async logout(): Promise<AuthStatus> {
    const currentConfig = await this.configStore.load();

    await this.configStore.save({
      runtimeMode: "mock",
      defaultOutput: currentConfig.defaultOutput,
    });

    return this.status();
  }
}