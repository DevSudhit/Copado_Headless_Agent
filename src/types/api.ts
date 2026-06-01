export type OutputMode = "text" | "json";

export type RuntimeMode = "mock" | "live";

export const COPADO_SERVICES = ["cicd", "ai", "crt"] as const;

export type CopadoServiceName = (typeof COPADO_SERVICES)[number];

export type OperationStatus = "queued" | "running" | "success" | "failed";

export type TestStatus = "queued" | "running" | "passed" | "failed" | "aborted";

export type AgentName = "plan" | "build" | "test" | "release" | "operate";

export interface ServiceAuthConfig {
  type: "bearer";
  tokenEnvVar?: string;
}

export interface CopadoServiceConfig {
  enabled: boolean;
  baseUrl?: string;
  auth: ServiceAuthConfig;
}

export interface SalesforceProjectConfig {
  sourceFormatRequired: boolean;
  projectRoot?: string;
  connectedAppsRequired: boolean;
}

export interface EnvironmentPolicy {
  requiresApproval?: boolean;
  requiresValidation?: boolean;
}

export interface ProjectConfig {
  runtimeMode: RuntimeMode;
  defaultOutput: OutputMode;
  activeProfile?: string;
  services: Record<CopadoServiceName, CopadoServiceConfig>;
  salesforce: SalesforceProjectConfig;
  environments: Record<string, EnvironmentPolicy>;
}

export interface ServiceStatus {
  service: CopadoServiceName;
  enabled: boolean;
  configured: boolean;
  baseUrl?: string;
  tokenEnvVar?: string;
  tokenPresent: boolean;
}

export interface SessionContext {
  currentStoryId?: string;
  lastPromotionEnvironment?: string;
  lastDeploymentEnvironment?: string;
  lastTestSuiteId?: string;
  lastTestExecutionId?: string;
}

export interface Story {
  id: string;
  title: string;
  status: string;
  description?: string;
}

export interface PipelineOperationResult {
  operationId: string;
  operation: "commit" | "promote" | "deploy";
  storyId: string;
  environment?: string;
  status: OperationStatus;
  message: string;
  validationRequested?: boolean;
}

export interface TestExecutionResult {
  executionId: string;
  suiteId: string;
  status: TestStatus;
  initialStatus?: TestStatus;
  passed?: number;
  failed?: number;
  jobDashboardUrl?: string;
  runsDashboardUrl?: string;
}

export interface AgentResponse {
  agent: AgentName;
  prompt: string;
  answer: string;
  storyId?: string;
}