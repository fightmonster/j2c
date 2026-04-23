// Jira API Types

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  name?: string;
}

export interface JiraStatus {
  name: string;
  id: string;
  statusCategory?: {
    name: string;
    key: string;
  };
}

export interface JiraTransition {
  id: string;
  name: string;
  to: JiraStatus;
}

export interface JiraAttachment {
  filename: string;
  size: number;
  content: string;
  mimeType?: string;
  author?: JiraUser;
  created?: string;
}

export interface JiraComment {
  id: string;
  author: JiraUser;
  body: string | JiraADFDocument;
  created: string;
  updated?: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    description?: string | JiraADFDocument;
    status: JiraStatus;
    issuetype: {
      name: string;
      iconUrl?: string;
    };
    priority?: {
      name: string;
      iconUrl?: string;
    };
    assignee?: JiraUser;
    reporter?: JiraUser;
    created: string;
    updated: string;
    comment?: {
      comments: JiraComment[];
    };
    attachment?: JiraAttachment[];
    [key: string]: any;
  };
}

export interface JiraSearchResult {
  total: number;
  startAt: number;
  maxResults: number;
  issues: JiraIssue[];
}

export interface JiraADFDocument {
  type: 'doc';
  version: 1;
  content: JiraADFNode[];
}

export type JiraADFNode = JiraADFParagraph | JiraADFHeading | JiraADFText | JiraADFList | JiraADFCodeBlock | JiraADFTable;

export interface JiraADFParagraph {
  type: 'paragraph';
  content?: JiraADFNode[];
}

export interface JiraADFHeading {
  type: 'heading';
  attrs?: { level?: number };
  content?: JiraADFNode[];
}

export interface JiraADFText {
  type: 'text';
  text?: string;
  marks?: Array<{ type: 'strong' | 'em' | 'underline' | 'code' | 'link'; attrs?: Record<string, string> }>;
}

export interface JiraADFList {
  type: 'bulletList' | 'orderedList';
  content?: JiraADFNode[];
}

export interface JiraADFCodeBlock {
  type: 'codeBlock';
  attrs?: { language?: string };
  content?: JiraADFNode[];
}

export interface JiraADFTable {
  type: 'table';
  content?: JiraADFNode[];
}
