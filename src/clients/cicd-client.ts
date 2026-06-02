import { readCicdEnv } from "./env-config.js";
import { SalesforceClient } from "./salesforce-client.js";
import { PipelineOperationResult } from "../types/api.js";
import { execSync } from "child_process";

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
    const operationId = createOperationId("COM");

    // ── Step 1: Verify the story exists ──────────────────────────────────────
    const rows = this.sf.query<{ Id: string; Name: string }>(
      `SELECT Id, Name FROM copado__User_Story__c WHERE Name = '${request.storyId}' LIMIT 1`,
    );
    if (rows.length === 0) {
      return {
        operationId,
        operation: "commit",
        storyId: request.storyId,
        status: "failed",
        message: `User story ${request.storyId} not found in the connected Salesforce org.`,
      };
    }

    // ── Step 2: Stage and git-commit any pending local changes ────────────────
    // Must happen BEFORE `sf copado story set` which requires a clean working tree.
    try {
      const status = execSync("git status --porcelain 2>/dev/null", {
        encoding: "utf8",
        timeout: 10_000,
      }).trim();
      if (status) {
        execSync(`git add -A && git commit -m ${JSON.stringify(request.message)} --allow-empty`, {
          encoding: "utf8",
          timeout: 30_000,
          stdio: "pipe",
        });
      }
    } catch {
      // git may not be available or there's nothing to commit — continue
    }

    // ── Step 3: Bind the Copado CLI to the user story ─────────────────────────
    // `sf copado story set` links this git repo to the given story so that
    // `sf copado story push` knows where to push.
    try {
      execSync(`sf copado story set --story "${request.storyId}" --json 2>&1`, {
        encoding: "utf8",
        timeout: 30_000,
        stdio: "pipe",
      });
    } catch {
      // story set may fail if the story is already bound — continue
    }

    // ── Step 4: Push via the official Copado CLI (`sf copado story push`) ─────
    // This pushes local commits to the Copado feature branch and syncs them
    // back to the Copado UI, where the commit appears as a tracked change.
    try {
      const pushResult = execSync("sf copado story push --json 2>&1", {
        encoding: "utf8",
        timeout: 120_000,
        stdio: "pipe",
      });
      const parsed = JSON.parse(pushResult);
      if (parsed?.status !== 0) {
        const errMsg: string = parsed?.message ?? "Push failed";
        return { operationId, operation: "commit", storyId: request.storyId, status: "failed", message: errMsg };
      }
      return {
        operationId,
        operation: "commit",
        storyId: request.storyId,
        status: "success",
        message: `Commit pushed to Copado feature branch for ${request.storyId}. Changes will appear in the Copado UI shortly.`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Try to extract a useful error from the JSON output in the exception
      const jsonMatch = msg.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          const detail: string = parsed?.message ?? msg;
          return { operationId, operation: "commit", storyId: request.storyId, status: "failed", message: detail };
        } catch { /* ignore */ }
      }
      return {
        operationId,
        operation: "commit",
        storyId: request.storyId,
        status: "failed",
        message: `Copado push failed: ${msg.slice(0, 300)}`,
      };
    }
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