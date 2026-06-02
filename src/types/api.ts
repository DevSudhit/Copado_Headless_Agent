export type OutputMode = "text" | "json";

export type RuntimeMode = "mock" | "live";

export type OperationStatus = "queued" | "running" | "success" | "failed";

export type TestStatus = "queued" | "running" | "passed" | "failed";

export type AgentName = "plan" | "build" | "test" | "release" | "operate";

export interface ProjectConfig {
  apiBaseUrl?: string;
  runtimeMode: RuntimeMode;
  defaultOutput: OutputMode;
  tokenEnvVar?: string;
}

export interface CliCommitRecord {
  operationId: string;
  storyId: string;
  message: string;
  timestamp: string;
}

export interface SessionContext {
  currentStoryId?: string;
  lastPromotionEnvironment?: string;
  lastDeploymentEnvironment?: string;
  commitHistory?: CliCommitRecord[];
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
  passed?: number;
  failed?: number;
}

export interface AgentResponse {
  agent: AgentName;
  prompt: string;
  answer: string;
  storyId?: string;
}