import { PipelineOperationResult } from "../types/api.js";

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