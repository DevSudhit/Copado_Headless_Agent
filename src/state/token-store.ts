import { ConfigStore } from "./config-store.js";

export class TokenStore {
  constructor(private readonly configStore: ConfigStore) {}

  async getToken(): Promise<string | undefined> {
    const config = await this.configStore.load();

    if (!config.tokenEnvVar) {
      return undefined;
    }

    return process.env[config.tokenEnvVar];
  }
}