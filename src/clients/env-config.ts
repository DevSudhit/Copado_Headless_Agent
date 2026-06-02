// ────────────────────────────────────────────────────────────────────────────
// Centralised environment variable reader.
// All live clients read credentials from here — never from process.env directly.
// ────────────────────────────────────────────────────────────────────────────

export interface CicdEnvConfig {
  baseUrl: string;
  token: string;
}

export interface AiEnvConfig {
  baseUrl: string;
  token: string;
  organizationId: string;
  workspaceId: string;
}

export interface CrtEnvConfig {
  baseUrl: string;
  token: string;
  organizationId: string;
  projectId: string;
}

function get(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

/** Returns CI/CD config if all required vars are present, otherwise undefined. */
export function readCicdEnv(): CicdEnvConfig | undefined {
  const baseUrl = get("COPADO_CICD_BASE_URL");
  const token = get("COPADO_CICD_TOKEN");
  if (!baseUrl || !token) return undefined;
  return { baseUrl, token };
}

/** Returns AI config if all required vars are present, otherwise undefined. */
export function readAiEnv(): AiEnvConfig | undefined {
  const baseUrl = get("COPADO_AI_BASE_URL");
  const token = get("COPADO_AI_TOKEN");
  const organizationId = get("COPADO_AI_ORGANIZATION_ID");
  const workspaceId = get("COPADO_AI_WORKSPACE_ID");
  if (!baseUrl || !token || !organizationId || !workspaceId) return undefined;
  return { baseUrl, token, organizationId, workspaceId };
}

/** Returns CRT config if all required vars are present, otherwise undefined. */
export function readCrtEnv(): CrtEnvConfig | undefined {
  const baseUrl = get("COPADO_CRT_BASE_URL");
  const token = get("COPADO_CRT_TOKEN");
  const organizationId = get("COPADO_CRT_ORGANIZATION_ID");
  const projectId = get("COPADO_CRT_PROJECT_ID");
  if (!baseUrl || !token || !organizationId || !projectId) return undefined;
  return { baseUrl, token, organizationId, projectId };
}
