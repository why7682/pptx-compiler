export interface CliExecutionOptions {
  readonly argv: readonly string[];
}

export interface CliExecutionResult {
  readonly exitCode: 0 | 1 | 2;
  readonly stdout: string;
  readonly stderr: string;
}

export declare function executeCli(
  options: CliExecutionOptions
): Promise<Readonly<CliExecutionResult>>;
