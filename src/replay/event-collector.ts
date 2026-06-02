// ────────────────────────────────────────────────────────────────────────────
// Replay Engine — event collector
// Queries live Copado SOQL data via the SF CLI bridge and returns structured
// raw records for the timeline builder to process.
// ────────────────────────────────────────────────────────────────────────────

import { readFileSync } from "node:fs";

import { SalesforceClient } from "../clients/salesforce-client.js";
import { CliCommitRecord } from "../types/api.js";
import { EntityType } from "./replay-types.js";

// ── Structured raw records ────────────────────────────────────────────────────

export interface StoryRecord {
  id: string;
  name: string;
  title: string;
  status: string;
  project: string;
  environment: string;
  apexCoverage: number | null;
  apexTestsPassed: boolean;
  lastCommitDate: string | null;
  lastPromotionDate: string | null;
  lastValidationDeployment: string | null;
  createdDate: string;
  lastModifiedDate: string;
  createdBy: string;
  lastModifiedBy: string;
}

export interface PromotionRecord {
  id: string;
  name: string;
  status: string;
  sourceEnv: string;
  targetEnv: string;
  date: string;
}

export interface DeploymentRecord {
  id: string;
  name: string;
  status: string;
  lastStep: string;
  date: string;
  sourceEnv: string;
}

export interface ApexTestRecord {
  id: string;
  name: string;
  status: string;
}

export interface CollectedData {
  /** true when SF CLI was available and queries ran successfully */
  live: boolean;
  story?: StoryRecord;
  promotions: PromotionRecord[];
  deployments: DeploymentRecord[];
  apexTests: ApexTestRecord[];
  /** CLI-initiated commits recorded in local .copado-hx.state.json */
  cliCommits: CliCommitRecord[];
}

// ── Helper: resolve story name from various ID formats ────────────────────────

function resolveStoryName(entityId: string, entityType: EntityType): string {
  // If it's already a story reference, use it directly
  if (entityType === "story" || /^US-\d+/i.test(entityId)) return entityId;
  // For deployment/promotion IDs, strip the prefix and try US-XXXXX
  return `US-${entityId.replace(/^[A-Z]+-/i, "")}`;
}

// ── Live Salesforce collection ────────────────────────────────────────────────

export function collectLiveData(
  entityId: string,
  entityType: EntityType,
): CollectedData {
  // Load CLI commit history from local state (sync-safe via JSON read)
  const cliCommits = loadCliCommits();

  const sf = new SalesforceClient();
  if (!sf.isAvailable()) {
    return { live: false, promotions: [], deployments: [], apexTests: [], cliCommits };
  }

  const storyName = resolveStoryName(entityId, entityType);

  // ── 1. User Story ───────────────────────────────────────────────────────────
  const storyRows = sf.query<Record<string, unknown>>(
    `SELECT Id, Name, copado__Status__c, copado__User_Story_Title__c,
     copado__Project__r.Name, copado__Environment__r.Name,
     copado__Apex_Code_Coverage__c, copado__Apex_Tests_Passed__c,
     copado__Last_Commit_Date__c, copado__Last_Promotion_Date__c,
     copado__Last_Validation_Deployment__c,
     CreatedDate, LastModifiedDate, CreatedBy.Name, LastModifiedBy.Name
     FROM copado__User_Story__c WHERE Name = '${storyName}' LIMIT 1`,
  );

  if (storyRows.length === 0) {
    return { live: true, promotions: [], deployments: [], apexTests: [], cliCommits };
  }

  const raw = storyRows[0];
  const story: StoryRecord = {
    id: raw["Id"] as string,
    name: raw["Name"] as string,
    title: (raw["copado__User_Story_Title__c"] as string | null) ?? (raw["Name"] as string),
    status: (raw["copado__Status__c"] as string) ?? "Unknown",
    project: (raw["copado__Project__r.Name"] as string | null) ?? "",
    environment: (raw["copado__Environment__r.Name"] as string | null) ?? "",
    apexCoverage: raw["copado__Apex_Code_Coverage__c"] as number | null,
    apexTestsPassed: Boolean(raw["copado__Apex_Tests_Passed__c"]),
    lastCommitDate: raw["copado__Last_Commit_Date__c"] as string | null,
    lastPromotionDate: raw["copado__Last_Promotion_Date__c"] as string | null,
    lastValidationDeployment: raw["copado__Last_Validation_Deployment__c"] as string | null,
    createdDate: raw["CreatedDate"] as string,
    lastModifiedDate: raw["LastModifiedDate"] as string,
    createdBy: (raw["CreatedBy.Name"] as string | null) ?? "Unknown",
    lastModifiedBy: (raw["LastModifiedBy.Name"] as string | null) ?? "Unknown",
  };

  // ── 2. Promotions linked to this story ────────────────────────────────────
  const promoRows = sf.query<Record<string, unknown>>(
    `SELECT Id, Name, copado__Status__c,
     copado__Source_Org_Credential__r.Name,
     copado__Destination_Org_Credential__r.Name,
     LastModifiedDate
     FROM copado__Promotion__c
     WHERE Id IN (
       SELECT copado__Promotion__c FROM copado__Promoted_User_Story__c
       WHERE copado__User_Story__c = '${story.id}')
     ORDER BY LastModifiedDate ASC LIMIT 10`,
  );

  const promotions: PromotionRecord[] = promoRows.map((p) => ({
    id: p["Id"] as string,
    name: p["Name"] as string,
    status: (p["copado__Status__c"] as string) ?? "Unknown",
    sourceEnv: (p["copado__Source_Org_Credential__r.Name"] as string | null) ?? "source",
    targetEnv: (p["copado__Destination_Org_Credential__r.Name"] as string | null) ?? "target",
    date: p["LastModifiedDate"] as string,
  }));

  // ── 3. Deployments linked via promotions ──────────────────────────────────
  const depRows = sf.query<Record<string, unknown>>(
    `SELECT Id, Name, copado__Status__c, copado__Deployment_Last_Step__c,
     copado__Date__c, copado__Source_Environment__r.Name
     FROM copado__Deployment__c
     WHERE copado__Promotion__r.Id IN (
       SELECT copado__Promotion__c FROM copado__Promoted_User_Story__c
       WHERE copado__User_Story__c = '${story.id}')
     ORDER BY copado__Date__c ASC LIMIT 10`,
  );

  const deployments: DeploymentRecord[] = depRows.map((d) => ({
    id: d["Id"] as string,
    name: d["Name"] as string,
    status: (d["copado__Status__c"] as string) ?? "Unknown",
    lastStep: (d["copado__Deployment_Last_Step__c"] as string | null) ?? "",
    date: (d["copado__Date__c"] as string | null) ?? (d["LastModifiedDate"] as string) ?? new Date().toISOString(),
    sourceEnv: (d["copado__Source_Environment__r.Name"] as string | null) ?? "unknown",
  }));

  // ── 4. Apex test results ──────────────────────────────────────────────────
  const apexRows = sf.query<Record<string, unknown>>(
    `SELECT Id, Name, copado__Status__c
     FROM copado__Apex_Test_Result__c
     WHERE copado__User_Story__c = '${story.id}'
     LIMIT 20`,
  );

  const apexTests: ApexTestRecord[] = apexRows.map((a) => ({
    id: a["Id"] as string,
    name: a["Name"] as string,
    status: (a["copado__Status__c"] as string | null) ?? "unknown",
  }));

  return { live: true, story, promotions, deployments, apexTests, cliCommits };
}

// ── Load CLI commits from local state file ────────────────────────────────────

function loadCliCommits(): CliCommitRecord[] {
  try {
    const raw = readFileSync(`${process.cwd()}/.copado-hx.state.json`, "utf8");
    const ctx = JSON.parse(raw) as { commitHistory?: CliCommitRecord[] };
    return ctx.commitHistory ?? [];
  } catch {
    return [];
  }
}
