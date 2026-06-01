import { ConfigStore } from "../state/config-store.js";
import { TokenStore } from "../state/token-store.js";
import { COPADO_SERVICES, CopadoServiceName, RuntimeMode, ServiceStatus } from "../types/api.js";

export interface ConfigValidationFinding {
  level: "info" | "warning" | "error";
  scope?: string;
  message: string;
}

export interface ConfigValidationResult {
  valid: boolean;
  runtimeMode: RuntimeMode;
  activeProfile?: string;
  serviceStatuses: ServiceStatus[];
  findings: ConfigValidationFinding[];
}

export class ConfigValidationService {
  private readonly tokenStore: TokenStore;

  constructor(private readonly configStore = new ConfigStore()) {
    this.tokenStore = new TokenStore(configStore);
  }

  async validate(service?: CopadoServiceName): Promise<ConfigValidationResult> {
    const config = await this.configStore.load();
    const targetServices = service ? [service] : [...COPADO_SERVICES];
    const serviceStatuses = await Promise.all(targetServices.map((name) => this.buildServiceStatus(name)));
    const findings: ConfigValidationFinding[] = [];

    if (config.runtimeMode === "mock") {
      findings.push({
        level: "info",
        message: "Runtime mode is mock. Live Copado credentials are optional for local demos, but can still be prepared now.",
      });
    }

    for (const serviceStatus of serviceStatuses) {
      const serviceLabel = serviceStatus.service.toUpperCase();

      if (!serviceStatus.enabled) {
        findings.push({
          level: "warning",
          scope: serviceStatus.service,
          message: `${serviceLabel} service is disabled. Enable and configure it before attempting live integration.`,
        });
        continue;
      }

      if (!serviceStatus.baseUrl) {
        findings.push({
          level: "error",
          scope: serviceStatus.service,
          message: `${serviceLabel} service is enabled but missing a base URL.`,
        });
      }

      if (!serviceStatus.tokenEnvVar) {
        findings.push({
          level: "error",
          scope: serviceStatus.service,
          message: `${serviceLabel} service is enabled but missing a token environment variable name.`,
        });
      } else if (!serviceStatus.tokenPresent) {
        findings.push({
          level: "warning",
          scope: serviceStatus.service,
          message: `${serviceLabel} service token env var is configured, but it is not present in the current shell.`,
        });
      } else {
        findings.push({
          level: "info",
          scope: serviceStatus.service,
          message: `${serviceLabel} service is configured and the token is available in the current shell.`,
        });
      }
    }

    if (config.salesforce.sourceFormatRequired) {
      findings.push({
        level: config.salesforce.projectRoot ? "info" : "warning",
        scope: "salesforce",
        message: config.salesforce.projectRoot
          ? `Source-format pipelines are expected. Project root is set to ${config.salesforce.projectRoot}.`
          : "Source-format pipelines are required. Configure the Salesforce project root before going live.",
      });
    }

    if (config.salesforce.connectedAppsRequired) {
      findings.push({
        level: "warning",
        scope: "salesforce",
        message: "Copado connected apps must be installed on the target orgs before live Salesforce-backed execution.",
      });
    }

    for (const [environment, policy] of Object.entries(config.environments)) {
      const rules: string[] = [];

      if (policy.requiresApproval) {
        rules.push("approval required");
      }

      if (policy.requiresValidation) {
        rules.push("validation required");
      }

      findings.push({
        level: "info",
        scope: environment,
        message: rules.length > 0
          ? `${environment} policy: ${rules.join(", ")}.`
          : `${environment} policy: no extra restrictions configured.`,
      });
    }

    return {
      valid: findings.every((finding) => finding.level !== "error"),
      runtimeMode: config.runtimeMode,
      activeProfile: config.activeProfile,
      serviceStatuses,
      findings,
    };
  }

  private async buildServiceStatus(service: CopadoServiceName): Promise<ServiceStatus> {
    const config = await this.configStore.load();
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