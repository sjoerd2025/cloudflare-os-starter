// Typed Service Contract: Git Dispatch Spec
// Follows erasableSyntaxOnly (no runtime enums)

export interface DispatchInput {
  prompt: string;
  repo?: string;
  baseBranch?: string;
  autoPr?: boolean;
  dryRun?: boolean;
}

export type DispatchErrorCode =
  | 'MISSING_PROMPT'
  | 'MISSING_API_KEY'
  | 'DAILY_QUOTA_EXCEEDED'
  | 'SESSION_CREATION_FAILED'
  | 'UNKNOWN_ERROR';

export interface DispatchSuccess {
  success: true;
  data: {
    sessionId: string;
    repo: string;
    baseBranch: string;
    prUrl?: string;
    state: string;
    summary: string;
  };
}

export interface DispatchFailure {
  success: false;
  error: {
    code: DispatchErrorCode;
    message: string;
    suggestion?: string;
    recoverable: boolean;
  };
}

export type DispatchResult = DispatchSuccess | DispatchFailure;

export interface DispatchSpec {
  execute(input: DispatchInput): Promise<DispatchResult>;
}
