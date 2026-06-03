import { SalesforceClient } from "../clients/salesforce-client.js";
import { readAiEnv, readCicdEnv, readCrtEnv } from "../clients/env-config.js";
import { CliError } from "../types/commands.js";

export interface AuthStatus {
  configured: boolean;
  runtimeMode: string;
  sfCliConnected: boolean;
  sfOrgAlias: string;
  aiConnected: boolean;
  crtConnected: boolean;
  cicdConnected: boolean;
}

export class AuthService {
  async status(): Promise<AuthStatus> {
    const sf = new SalesforceClient();
    const sfConnected = sf.isAvailable();
    const aiEnv = readAiEnv();
    const crtEnv = readCrtEnv();
    const cicdEnv = readCicdEnv();

    const runtimeMode = sfConnected || aiEnv || crtEnv ? "live" : "mock";

    return {
      configured: sfConnected || Boolean(aiEnv) || Boolean(crtEnv),
      runtimeMode,
      sfCliConnected: sfConnected,
      sfOrgAlias: sfConnected ? "copadotrial" : "not connected",
      aiConnected: Boolean(aiEnv),
      crtConnected: Boolean(crtEnv),
      cicdConnected: sfConnected,
    };
  }

  async login(): Promise<AuthStatus> {
    return this.status();
  }

  async logout(): Promise<AuthStatus> {
    throw new CliError("To disconnect, run: sf org logout --target-org copadotrial", 2);
  }
}