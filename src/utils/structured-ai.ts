import { OperationStatus } from "../types/api.js";
import { CliError } from "../types/commands.js";

const STORY_ID_PATTERN = /\bUS-\d+\b/i;

export function parseStructuredJson<T>(answer: string, label: string): T {
  const trimmed = answer.trim();
  const candidates = new Set<string>();

  if (trimmed) {
    candidates.add(trimmed);
  }

  for (const match of trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
    const candidate = match[1]?.trim();

    if (candidate) {
      candidates.add(candidate);
    }
  }

  const firstObjectStart = trimmed.indexOf("{");
  const lastObjectEnd = trimmed.lastIndexOf("}");

  if (firstObjectStart >= 0 && lastObjectEnd > firstObjectStart) {
    candidates.add(trimmed.slice(firstObjectStart, lastObjectEnd + 1));
  }

  const firstArrayStart = trimmed.indexOf("[");
  const lastArrayEnd = trimmed.lastIndexOf("]");

  if (firstArrayStart >= 0 && lastArrayEnd > firstArrayStart) {
    candidates.add(trimmed.slice(firstArrayStart, lastArrayEnd + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      continue;
    }
  }

  throw new CliError(`${label} did not return valid structured JSON.`, 2, {
    answerPreview: trimmed.slice(0, 400),
  });
}

export function extractStoryId(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const match = value.match(STORY_ID_PATTERN);

    if (match) {
      return match[0].toUpperCase();
    }
  }

  return undefined;
}

export function coerceString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const normalized = value.trim();

    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

export function normalizeOperationStatus(
  value: unknown,
  executable?: boolean,
): OperationStatus | undefined {
  if (typeof value !== "string") {
    return executable === false ? "failed" : undefined;
  }

  switch (value.trim().toLowerCase()) {
    case "queued":
    case "pending":
      return "queued";
    case "running":
    case "started":
    case "in progress":
    case "in_progress":
      return "running";
    case "success":
    case "succeeded":
    case "completed":
    case "complete":
    case "done":
      return "success";
    case "failed":
    case "error":
    case "blocked":
    case "cannot_execute":
      return "failed";
    default:
      return executable === false ? "failed" : undefined;
  }
}

export function createSyntheticOperationId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export function compactText(value: string, maxLength = 280): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}