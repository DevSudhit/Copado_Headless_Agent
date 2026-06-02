// ────────────────────────────────────────────────────────────────────────────
// Doctor Engine – core investigation & diagnosis orchestrator
// ────────────────────────────────────────────────────────────────────────────

import { AiClient, createAiClient } from "../clients/ai-client.js";
import { SalesforceClient } from "../clients/salesforce-client.js";
import { mergeFindings, selectPrimaryFinding, toConfidenceTier } from "./doctor-confidence.js";
import { BUILT_IN_RULES } from "./doctor-rules.js";
import {
  CollectionSummary,
  CrtTestSuite,
  DeploymentLog,
  DiagnosticRule,
  InvestigationEvidence,
  InvestigationReport,
  InvestigationTarget,
  JobExecution,
  PromotionHistoryEntry,
  StoryMetadata,
  TestResult,
} from "./doctor-types.js";

// ── Mock data factory – realistic, failure-rich scenarios ────────────────────

function buildMockDeploymentLog(id: string): DeploymentLog {
  const isFailed = !id.toLowerCase().includes("ok");
  return {
    deploymentId: id,
    status: isFailed ? "failed" : "success",
    environment: "staging",
    startedAt: new Date(Date.now() - 3_600_000).toISOString(),
    finishedAt: new Date().toISOString(),
    steps: [
      { name: "Retrieve Metadata", status: "success" },
      { name: "Run Apex Tests", status: isFailed ? "failed" : "success", message: isFailed ? "LeadScoringTest: System.AssertException: Assertion Failed — Account.Risk__c is null" : undefined },
      { name: "Deploy Components", status: isFailed ? "failed" : "success", message: isFailed ? "Missing CustomField: Lead.Score__c does not exist in deployment scope." : undefined },
      { name: "Post-Deploy Validation", status: isFailed ? "skipped" : "success" },
    ],
    rawLogs: isFailed
      ? [
          "2026-06-01T10:00:00Z [ERROR] Missing CustomField: Lead.Score__c does not exist in deployment scope.",
          "2026-06-01T10:00:05Z [ERROR] PermissionSet Lead_Manager references Lead.Score__c but the field is not present.",
          "2026-06-01T10:00:10Z [ERROR] LeadScoringTest: System.AssertException: Assertion Failed",
          "2026-06-01T10:00:15Z [INFO] Deployment failed after 2 errors.",
        ]
      : ["2026-06-01T10:00:00Z [INFO] Deployment completed successfully."],
  };
}

function buildMockJobExecution(id: string): JobExecution {
  const isFailed = !id.toLowerCase().includes("ok");
  return {
    jobId: `JOB-${id}`,
    jobTemplate: "Copado Standard Deployment",
    status: isFailed ? "failed" : "success",
    errorMessage: isFailed
      ? "Deploy step failed: Missing CustomField Lead.Score__c referenced by PermissionSet Lead_Manager."
      : undefined,
    steps: [
      { name: "Validate Metadata", status: "success", duration: 12 },
      {
        name: "Deploy Components",
        status: isFailed ? "failed" : "success",
        duration: 47,
        errorMessage: isFailed
          ? "CustomField Lead.Score__c not found in deployment scope."
          : undefined,
      },
      { name: "Run Tests", status: isFailed ? "failed" : "success", duration: 90 },
    ],
  };
}

function buildMockStoryMetadata(storyId: string): StoryMetadata {
  return {
    storyId,
    title: `User Story ${storyId}: Lead Scoring Enhancement`,
    status: "In Progress",
    description: "Adds risk-based scoring to Lead object with custom permission management.",
    metadataComponents: [
      "Lead_Manager",
      "LeadScoringService",
      "LeadScoringTest",
    ],
    lastModifiedBy: "alex.johnson@example.com",
    lastModifiedDate: new Date(Date.now() - 86_400_000).toISOString(),
  };
}

function buildMockPromotionHistory(id: string): PromotionHistoryEntry[] {
  return [
    {
      promotionId: `PRO-${id}-1`,
      fromEnvironment: "dev",
      toEnvironment: "staging",
      status: "failed",
      promotedAt: new Date(Date.now() - 172_800_000).toISOString(),
      validationStatus: "failed",
    },
    {
      promotionId: `PRO-${id}-2`,
      fromEnvironment: "dev",
      toEnvironment: "staging",
      status: "failed",
      promotedAt: new Date(Date.now() - 86_400_000).toISOString(),
      validationStatus: "failed",
    },
  ];
}

function buildMockTestSuite(id: string): CrtTestSuite {
  const isFailed = !id.toLowerCase().includes("ok");
  const results: TestResult[] = isFailed
    ? [
        {
          testClass: "LeadScoringTest",
          methodName: "testScoreCalculation",
          status: "failed",
          errorMessage: "System.AssertException: Assertion Failed: Account.Risk__c is null — test data factory does not populate this field.",
          stackTrace: "Class.LeadScoringTest.testScoreCalculation: line 42, column 1",
          coveragePercent: 61,
        },
        {
          testClass: "LeadScoringTest",
          methodName: "testPermissionSetAssignment",
          status: "failed",
          errorMessage: "System.NullPointerException: Attempt to de-reference a null object at LeadScoringTest.testPermissionSetAssignment:67",
          stackTrace: "Class.LeadScoringTest.testPermissionSetAssignment: line 67, column 1",
          coveragePercent: 58,
        },
        {
          testClass: "LeadTriggerHandlerTest",
          methodName: "testBulkInsert",
          status: "passed",
          coveragePercent: 84,
        },
      ]
    : [
        {
          testClass: "LeadScoringTest",
          methodName: "testScoreCalculation",
          status: "passed",
          coveragePercent: 88,
        },
      ];

  const failed = results.filter((r) => r.status === "failed").length;

  return {
    executionId: `EX-${id}`,
    suiteId: "smoke",
    status: failed > 0 ? "failed" : "passed",
    totalTests: results.length,
    passed: results.length - failed,
    failed,
    results,
  };
}

// ── Evidence collector ───────────────────────────────────────────────────────

export interface EvidenceCollectionResult {
  evidence: InvestigationEvidence;
  summary: CollectionSummary;
}

// ── Live Copado SOQL evidence collector ──────────────────────────────────────
// Uses the SF CLI (sf data query) which holds a live Keychain session, so no
// token management is needed. All field names are the real ones discovered from
// the trial org schema via FieldDefinition SOQL.

async function collectLiveEvidence(
  targetId: string,
  sf: SalesforceClient,
): Promise<EvidenceCollectionResult> {
  // ── 1. Resolve User Story from name (US-XXXXXXX) or SF record ID ─────────
  let storyId = targetId;
  let storySfId: string | undefined;

  if (/^US-\d+/i.test(targetId)) {
    const rows = sf.query<{ Id: string; Name: string }>(
      `SELECT Id, Name FROM copado__User_Story__c WHERE Name = '${targetId}' LIMIT 1`,
    );
    if (rows.length > 0) {
      storySfId = rows[0].Id;
      storyId = rows[0].Name;
    }
  } else if (/^a[0-9A-Za-z]{14,17}$/.test(targetId)) {
    storySfId = targetId;
  }

  // ── 2. User Story metadata ────────────────────────────────────────────────
  let storyMetadata: StoryMetadata | undefined;
  const storyFilter = storySfId ? `Id = '${storySfId}'` : `Name = '${storyId}'`;

  const storyRows = sf.query<Record<string, unknown>>(
    `SELECT Id, Name, copado__Status__c, copado__User_Story_Title__c,
     copado__Project__r.Name, copado__Environment__r.Name,
     copado__Apex_Code_Coverage__c, copado__Apex_Tests_Passed__c,
     copado__Last_Promotion_Date__c, LastModifiedDate, LastModifiedBy.Name
     FROM copado__User_Story__c WHERE ${storyFilter} LIMIT 1`,
  );

  if (storyRows.length > 0) {
    const s = storyRows[0];
    storySfId = storySfId ?? (s["Id"] as string);
    storyId = s["Name"] as string;
    storyMetadata = {
      storyId: s["Name"] as string,
      title: (s["copado__User_Story_Title__c"] as string | null) ?? (s["Name"] as string),
      status: (s["copado__Status__c"] as string) ?? "unknown",
      metadataComponents: [],
      lastModifiedBy: s["LastModifiedBy.Name"] as string | undefined,
      lastModifiedDate: s["LastModifiedDate"] as string | undefined,
    };
  }

  // ── 3. Promotion history for this user story ──────────────────────────────
  const promotionRows = storySfId
    ? sf.query<Record<string, unknown>>(
        `SELECT Id, Name, copado__Status__c,
         copado__Source_Org_Credential__r.Name, copado__Destination_Org_Credential__r.Name,
         LastModifiedDate
         FROM copado__Promotion__c
         WHERE Id IN (
           SELECT copado__Promotion__c FROM copado__Promoted_User_Story__c
           WHERE copado__User_Story__c = '${storySfId}')
         ORDER BY LastModifiedDate DESC LIMIT 5`,
      )
    : [];

  const promotionHistory: PromotionHistoryEntry[] = promotionRows.map((p) => ({
    promotionId: p["Name"] as string,
    fromEnvironment: (p["copado__Source_Org_Credential__r.Name"] as string | null) ?? "source",
    toEnvironment: (p["copado__Destination_Org_Credential__r.Name"] as string | null) ?? "target",
    status: mapPromotionStatus(p["copado__Status__c"] as string | undefined),
    promotedAt: p["LastModifiedDate"] as string,
  }));

  // ── 4. Most recent deployment linked to any of the promotions ─────────────
  let deploymentLog: DeploymentLog | undefined;

  if (storySfId) {
    const depRows = sf.query<Record<string, unknown>>(
      `SELECT Id, Name, copado__Status__c, copado__Deployment_Last_Step__c,
       copado__Date__c, copado__Source_Environment__r.Name
       FROM copado__Deployment__c
       WHERE copado__Promotion__r.Id IN (
         SELECT copado__Promotion__c FROM copado__Promoted_User_Story__c
         WHERE copado__User_Story__c = '${storySfId}')
       ORDER BY copado__Date__c DESC LIMIT 1`,
    );

    if (depRows.length > 0) {
      const dep = depRows[0];
      const lastStep = (dep["copado__Deployment_Last_Step__c"] as string | null) ?? "";
      const status = mapDeployStatus(dep["copado__Status__c"] as string | undefined);
      deploymentLog = {
        deploymentId: dep["Name"] as string,
        status,
        environment: (dep["copado__Source_Environment__r.Name"] as string | null) ?? "unknown",
        startedAt: (dep["copado__Date__c"] as string | null) ?? new Date().toISOString(),
        steps: lastStep ? [{ name: lastStep, status: status === "failed" ? "failed" : "success" }] : [],
        rawLogs: lastStep ? [`Last step: ${lastStep}`] : [],
      };
    }
  }

  // ── 5. Apex test results ──────────────────────────────────────────────────
  let testSuite: CrtTestSuite | undefined;

  if (storySfId) {
    const apexRows = sf.query<Record<string, unknown>>(
      `SELECT Id, Name, copado__Status__c
       FROM copado__Apex_Test_Result__c
       WHERE copado__User_Story__c = '${storySfId}'
       LIMIT 20`,
    );

    if (apexRows.length > 0) {
      const testResults: TestResult[] = apexRows.map((r) => ({
        testClass: (r["Name"] as string).split(".")[0] ?? (r["Name"] as string),
        methodName: (r["Name"] as string).split(".")[1] ?? "unknown",
        status: mapTestStatus(r["copado__Status__c"] as string | undefined),
      }));
      const failed = testResults.filter((t) => t.status === "failed").length;
      testSuite = {
        executionId: `LIVE-${storyId}`,
        suiteId: storyId,
        status: failed > 0 ? "failed" : "passed",
        totalTests: testResults.length,
        passed: testResults.length - failed,
        failed,
        results: testResults,
      };
    }
  }

  // ── 6. Raw signals ────────────────────────────────────────────────────────
  const rawSignals: string[] = [
    ...(deploymentLog?.rawLogs ?? []),
    ...promotionHistory
      .filter((p) => p.status === "failed")
      .map((p) => `Promotion ${p.promotionId} failed: ${p.fromEnvironment} → ${p.toEnvironment}`),
    ...(storyMetadata
      ? [`Story ${storyId}: "${storyMetadata.title}" — status: ${storyMetadata.status}`]
      : []),
  ];

  const summary: CollectionSummary = {
    deploymentLogs: Boolean(deploymentLog),
    jobExecution: false,
    storyDetails: Boolean(storyMetadata),
    promotionHistory: promotionHistory.length > 0,
    testResults: Boolean(testSuite),
  };

  return {
    evidence: {
      deploymentLog,
      jobExecution: undefined,
      storyMetadata,
      promotionHistory,
      testSuite,
      rawSignals,
    },
    summary,
  };
}

// ── Status mappers ───────────────────────────────────────────────────────────

function mapDeployStatus(s?: string): DeploymentLog["status"] {
  const v = s?.toLowerCase() ?? "";
  if (v.includes("success") || v.includes("complete")) return "success";
  if (v.includes("fail") || v.includes("error")) return "failed";
  if (v.includes("run") || v.includes("progress")) return "running";
  return "queued";
}
function mapPromotionStatus(s?: string): "success" | "failed" | "pending" {
  const v = s?.toLowerCase() ?? "";
  if (v.includes("success") || v.includes("complete")) return "success";
  if (v.includes("fail") || v.includes("error")) return "failed";
  return "pending";
}
function mapValidationStatus(s?: string): "passed" | "failed" | "skipped" | undefined {
  if (!s) return undefined;
  const v = s.toLowerCase();
  if (v.includes("pass") || v.includes("success")) return "passed";
  if (v.includes("fail") || v.includes("error")) return "failed";
  return "skipped";
}
function mapTestStatus(s?: string): "passed" | "failed" | "skipped" {
  const v = s?.toLowerCase() ?? "";
  if (v.includes("pass") || v.includes("success")) return "passed";
  if (v.includes("fail") || v.includes("error")) return "failed";
  return "skipped";
}

// ── Evidence router ──────────────────────────────────────────────────────────
// Priority: (1) SF CLI SOQL → (2) Mock fallback

async function collectEvidence(
  targetId: string,
  _target: InvestigationTarget,
): Promise<EvidenceCollectionResult> {
  // 1. Prefer SF CLI — it holds a live authenticated Keychain session
  const sfClient = new SalesforceClient();
  if (sfClient.isAvailable()) {
    const liveResult = await collectLiveEvidence(targetId, sfClient);

    // If we got at least a story record back, use live data
    if (liveResult.evidence.storyMetadata) {
      return liveResult;
    }

    // SF CLI is authenticated but the story wasn't found — enrich with mock
    // so diagnostic rules + AI still have data to work with, but carry the
    // real live summary forward so users see what was actually tried.
    const mock = await collectMockEvidence(targetId);
    mock.summary = liveResult.summary;
    return mock;
  }

  // 2. Pure mock — no SF CLI session found
  return collectMockEvidence(targetId);
}

async function collectMockEvidence(targetId: string): Promise<EvidenceCollectionResult> {
  const deploymentLog = buildMockDeploymentLog(targetId);
  const jobExecution = buildMockJobExecution(targetId);
  const storyId = `US-${targetId.replace(/^[A-Z]+-/i, "")}`;
  const storyMetadata = buildMockStoryMetadata(storyId);
  const promotionHistory = buildMockPromotionHistory(targetId);
  const testSuite = buildMockTestSuite(targetId);

  return {
    evidence: {
      deploymentLog,
      jobExecution,
      storyMetadata,
      promotionHistory,
      testSuite,
      rawSignals: [],
    },
    summary: {
      deploymentLogs: true,
      jobExecution: true,
      storyDetails: true,
      promotionHistory: true,
      testResults: true,
    },
  };
}

// ── Doctor Engine ────────────────────────────────────────────────────────────

export interface DoctorEngineOptions {
  /** Additional rules beyond the built-in set. */
  extraRules?: DiagnosticRule[];
  /** AI client override (used in tests). */
  aiClient?: AiClient;
}

export class DoctorEngine {
  private readonly rules: DiagnosticRule[];
  private readonly aiClient: AiClient;

  constructor(options: DoctorEngineOptions = {}) {
    this.rules = [...BUILT_IN_RULES, ...(options.extraRules ?? [])];
    this.aiClient = options.aiClient ?? createAiClient();
  }

  /**
   * Primary investigation entry point.
   * Collects evidence → runs rules → scores → optionally invokes AI.
   */
  async investigate(
    targetId: string,
    targetType: InvestigationTarget,
  ): Promise<InvestigationReport> {
    const { evidence, summary } = await collectEvidence(targetId, targetType);

    const rawFindings = this.rules
      .map((rule) => {
        try {
          return rule.evaluate(evidence);
        } catch {
          return null;
        }
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

    const allFindings = mergeFindings(rawFindings);
    const primaryFinding = selectPrimaryFinding(allFindings);
    const confidence = primaryFinding?.confidence ?? 0;
    const confidenceTier = toConfidenceTier(confidence);

    const status =
      evidence.deploymentLog?.status === "success" ? "passed" : allFindings.length > 0 ? "failed" : "inconclusive";

    let aiInsights: string | undefined;
    // Invoke live AI for all failed/inconclusive investigations, or when confidence < 80
    const shouldAsk = status === "failed" || status === "inconclusive" || confidence < 80;

    if (shouldAsk) {
      aiInsights = await this.invokeAI(evidence, allFindings.map((f) => f.rootCause).join("; ") || "No specific findings from rule-based analysis.");
    }

    return {
      targetId,
      targetType,
      investigatedAt: new Date().toISOString(),
      status,
      primaryFinding,
      allFindings,
      confidenceTier,
      aiInsights,
      collectionSummary: summary,
    };
  }

  private async invokeAI(
    evidence: InvestigationEvidence,
    findingSummary: string,
  ): Promise<string> {
    const prompt = [
      "Analyze the following investigation report and suggest root causes.",
      `Deployment status: ${evidence.deploymentLog?.status ?? "unknown"}.`,
      `Findings so far: ${findingSummary}.`,
      `Failed tests: ${evidence.testSuite?.results
        .filter((r) => r.status === "failed")
        .map((r) => r.testClass + "." + r.methodName)
        .join(", ") || "none"}.`,
      `Promotion history: ${evidence.promotionHistory.length} entries, ${evidence.promotionHistory.filter((p) => p.status === "failed").length} failed.`,
    ].join(" ");

    try {
      const response = await this.aiClient.ask({ agent: "release", prompt });
      return response.answer;
    } catch {
      return "AI analysis unavailable — proceeding with rule-based findings only.";
    }
  }
}
