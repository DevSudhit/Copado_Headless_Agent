export function requiresExplicitApproval(environment: string): boolean {
  return environment.trim().toUpperCase() === "PROD";
}