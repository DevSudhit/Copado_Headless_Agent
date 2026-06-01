import { ConfigStore } from "./config-store.js";
import { CopadoServiceName } from "../types/api.js";

export class TokenStore {
  constructor(private readonly configStore: ConfigStore) {}

  async getToken(service: CopadoServiceName): Promise<string | undefined> {
    const config = await this.configStore.load();
    const tokenEnvVar = config.services[service].auth.tokenEnvVar;

    if (!tokenEnvVar) {
      return undefined;
    }

    return process.env[tokenEnvVar];
  }
}