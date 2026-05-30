export interface CommandOutput<T = unknown> {
  summary: string;
  data?: T;
}

export class CliError extends Error {
  constructor(
    message: string,
    readonly exitCode = 1,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = "CliError";
  }
}