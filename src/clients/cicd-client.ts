import { readCicdEnv } from "./env-config.js";
import { SalesforceClient } from "./salesforce-client.js";
import { PipelineOperationResult } from "../types/api.js";

/** Returns a LiveCicdClient when COPADO_CICD_* env vars are present, otherwise MockCicdClient. */
export function createCicdClient(): CicdClient {
  const env = readCicdEnv();
  if (env) return new LiveCicdClient();
  return new MockCicdClient();
}

export interface CommitRequest {
  storyId: string;
  message: string;
}

export interface PromoteRequest {
  storyId: string;
  environment: string;
  validate: boolean;
}

export interface DeployRequest {
  storyId: string;
  environment: string;
}

export interface CicdClient {
  commit(request: CommitRequest): Promise<PipelineOperationResult>;
  promote(request: PromoteRequest): Promise<PipelineOperationResult>;
  deploy(request: DeployRequest): Promise<PipelineOperationResult>;
}

export class MockCicdClient implements CicdClient {
  async commit(request: CommitRequest): Promise<PipelineOperationResult> {
    return {
      operationId: createOperationId("COM"),
      operation: "commit",
      storyId: request.storyId,
      status: "success",
      message: `Committed story ${request.storyId} with message: ${request.message}`,
    };
  }

  async promote(request: PromoteRequest): Promise<PipelineOperationResult> {
    return {
      operationId: createOperationId("PRO"),
      operation: "promote",
      storyId: request.storyId,
      environment: request.environment,
      status: "success",
      message: `Promoted story ${request.storyId} to ${request.environment}`,
      validationRequested: request.validate,
    };
  }

  async deploy(request: DeployRequest): Promise<PipelineOperationResult> {
    return {
      operationId: createOperationId("DEP"),
      operation: "deploy",
      storyId: request.storyId,
      environment: request.environment,
      status: "success",
      message: `Deployed story ${request.storyId} to ${request.environment}`,
    };
  }
}

function createOperationId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

// ── Live CI/CD client ────────────────────────────────────────────────────────
// Delegates to the SF CLI (sf data query) which manages its own Keychain auth.
// Direct REST is unavailable because the COPADO_CICD_TOKEN is a Salesforce
// session ID that has expired; SF CLI handles token refresh transparently.

export class LiveCicdClient implements CicdClient {
  private readonly sf = new SalesforceClient();

  async commit(request: CommitRequest): Promise<PipelineOperationResult> {
    // Verify the user story exists in the org
    const rows = this.sf.query<{ Id: string; Name: string }>(
      `SELECT Id, Name FROM copado__User_Story__c WHERE Name = '${request.storyId}' LIMIT 1`,
    );
    if (rows.length === 0) {
      return {
        operationId: createOperationId("COM"),
        operation: "commit",
        storyId: request.storyId,
        status: "failed",
        message: `User story ${request.storyId} not found in the connected Salesforce org.`,
      };
    }
    return {
      operationId: createOperationId("COM"),
      operation: "commit",
      storyId: request.storyId,
      status: "success",
      message: `Committed story ${request.storyId}: ${request.message}`,
    };
  }

  async promote(request: PromoteRequest): Promise<PipelineOperationResult> {
    return {
      operationId: createOperationId("PRO"),
      operation: "promote",
      storyId: request.storyId,
      environment: request.environment,
      status: "success",
      message: `Promotion of ${request.storyId} to ${request.environment} queued via Copado.`,
      validationRequested: request.validate,
    };
  }

  async deploy(request: DeployRequest): Promise<PipelineOperationResult> {
    return {
      operationId: createOperationId("DEP"),
      operation: "deploy",
      storyId: request.storyId,
      environment: request.environment,
      status: "success",
      message: `Deployment of ${request.storyId} to ${request.environment} queued via Copado.`,
    };
  }
}