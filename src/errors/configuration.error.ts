export type ConfigurationIssue = {
  variable: string;
  message: string;
};

export class ConfigurationError extends Error {
  public readonly issues: readonly ConfigurationIssue[];

  public constructor(issues: readonly ConfigurationIssue[]) {
    super("Application configuration is invalid.");

    this.name = "ConfigurationError";
    this.issues = issues;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
