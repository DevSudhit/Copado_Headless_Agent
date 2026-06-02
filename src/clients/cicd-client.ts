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
// Delegates to the SF CLI (sf copado story push) which manages its own
// Keychain auth. Direct REST is unavailable because na.api.copado.com is
// IP-restricted; SF CLI handles token refresh transparently.

export class LiveCicdClient implements CicdClient {
  private readonly sf = new SalesforceClient();

  async commit(request: CommitRequest): Promise<PipelineOperationResult> {
    const operationId = createOperationId("COM");

    // Step 1: Verify the story exists via SOQL
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

    // Step 2: Stage and git-commit any pending local changes
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
      // nothing to commit — continue
    }

    // Step 3: Bind the Copado CLI to the user story
    try {
      execSync(`sf copado story set --story "${request.storyId}" 2>&1`, {
        encoding: "utf8",
        timeout: 30_000,
        stdio: "pipe",
      });
    } catch {
      // already bound or non-fatal — continue
    }

    // Step 4: Push via sf copado story push (human output, more reliable than --json)
    try {
      const pushOutput = execSync("sf copado story push 2>&1", {
        encoding: "utf8",
        timeout: 120_000,
        stdio: "pipe",
      }).trim();

      const noNewCommits = /no new commits/i.test(pushOutput);
      const successMsg = noNewCommits
        ? `Story ${request.storyId} is already up to date in Copado — no new commits to push.`
        : `Commit pushed to Copado feature branch for ${request.storyId}. Changes will appear in the Copado UI shortly.`;

      return { operationId, operation: "commit", storyId: request.storyId, status: "success", message: successMsg };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const jsonMatch = msg.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]) as { message?: string };
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
    const operationId = createOperationId("PRO");

    try {
      execSync(`sf copado story set --story "${request.storyId}" 2>&1`, {
        encoding: "utf8",
        timeout: 30_000,
        stdio: "pipe",
      });
    } catch { /* already bound — continue */ }

    try {
      const flag = request.validate ? "--validate" : "--promote";
      const output = execSync(`sf copado story submit ${flag} --wait 2>&1`, {
        encoding: "utf8",
        timeout: 120_000,
        stdio: "pipe",
      }).trim();

      const succeeded = /success|complet|promot/i.test(output);
      return {
        operationId,
        operation: "promote",
        storyId: request.storyId,
        environment: request.environment,
        status: succeeded ? "success" : "queued",
        message: output.slice(0, 300) || `Story ${request.storyId} submitted for promotion to ${request.environment}.`,
        validationRequested: request.validate,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        operationId,
        operation: "promote",
        storyId: request.storyId,
        environment: request.environment,
        status: "failed",
        message: `Promotion failed: ${msg.slice(0, 300)}`,
        validationRequested: request.validate,
      };
    }
  }

  async deploy(request: DeployRequest): Promise<PipelineOperationResult> {
    const operationId = createOperationId("DEP");

    try {
      execSync(`sf copado story set --story "${request.storyId}" 2>&1`, {
        encoding: "utf8",
        timeout: 30_000,
        stdio: "pipe",
      });
    } catch { /* already bound — continue */ }

    try {
      const output = execSync("sf copado story submit --deploy --wait 2>&1", {
        encoding: "utf8",
        timeout: 120_000,
        stdio: "pipe",
      }).trim();

      const succeeded = /success|complet|deploy/i.test(output);
      return {
        operationId,
        operation: "deploy",
        storyId: request.storyId,
        environment: request.environment,
        status: succeeded ? "success" : "queued",
        message: output.slice(0, 300) || `Story ${request.storyId} submitted for deployment to ${request.environment}.`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        operationId,
        operation: "deploy",
        storyId: request.storyId,
        environment: request.environment,
        status: "failed",
        message: `Deployment failed: ${msg.slice(0, 300)}`,
      };
    }
  }
}