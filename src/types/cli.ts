// CLI Types

export interface CliConfig {
  host: string;
  tokenPath?: string;
  cookiePath?: string;
}

export interface BatchOptions {
  concurrency?: number;
  yes?: boolean;
  dryRun?: boolean;
}

export interface ExportOptions {
  jql: string;
  format: 'md' | 'json';
  output?: string;
  concurrency?: number;
}

export interface CommentOptions {
  issueIdOrKey: string;
  body?: string;
  isMarkdown?: boolean;
  adf?: string;
  attach?: string;
}
