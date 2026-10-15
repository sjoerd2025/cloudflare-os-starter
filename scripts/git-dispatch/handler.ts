// Typed Service Contract: Git Dispatch Handler
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DispatchInput, DispatchResult, DispatchSpec } from './spec.ts';

function checkAndIncrementQuota(limit = 50, maxBudgetEur = 10.0): { allowed: boolean; current: number; limit: number; spentEur: number; maxBudgetEur: number } {
  const quotaPath = path.resolve(process.cwd(), '.fleet/quota.json');
  const today = new Date().toISOString().slice(0, 10);
  let ledger = {
    date: today,
    dailyLimit: limit,
    maxDailyBudgetEur: maxBudgetEur,
    estimatedCostPerSessionEur: 0.20,
    accumulatedCostEur: 0.0,
    dispatchedCount: 0,
  };

  try {
    if (fs.existsSync(quotaPath)) {
      const data = JSON.parse(fs.readFileSync(quotaPath, 'utf-8'));
      if (data.date === today) {
        ledger = { ...ledger, ...data };
      }
    }
  } catch {
    // Reset on parse error
  }

  const projectedCost = Number((ledger.accumulatedCostEur + 0.20).toFixed(2));
  if (ledger.dispatchedCount >= ledger.dailyLimit || projectedCost > ledger.maxDailyBudgetEur) {
    return {
      allowed: false,
      current: ledger.dispatchedCount,
      limit: ledger.dailyLimit,
      spentEur: ledger.accumulatedCostEur,
      maxBudgetEur: ledger.maxDailyBudgetEur,
    };
  }

  ledger.dispatchedCount += 1;
  ledger.accumulatedCostEur = projectedCost;
  try {
    const dir = path.dirname(quotaPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(quotaPath, JSON.stringify(ledger, null, 2) + '\n', 'utf-8');
  } catch {
    // Ignore write failure
  }

  return {
    allowed: true,
    current: ledger.dispatchedCount,
    limit: ledger.dailyLimit,
    spentEur: ledger.accumulatedCostEur,
    maxBudgetEur: ledger.maxDailyBudgetEur,
  };
}

export class GitDispatchHandler implements DispatchSpec {
  async execute(input: DispatchInput): Promise<DispatchResult> {
    try {
      const prompt = input.prompt?.trim();
      if (!prompt) {
        return {
          success: false,
          error: {
            code: 'MISSING_PROMPT',
            message: 'Task prompt cannot be empty.',
            suggestion: 'Provide a descriptive prompt for the task to execute.',
            recoverable: true,
          },
        };
      }

      const repo = input.repo || 'sjoerd2025/cloudflare-os-starter';
      const baseBranch = input.baseBranch || 'main';

      if (input.dryRun) {
        return {
          success: true,
          data: {
            sessionId: 'dry-run-session-001',
            repo,
            baseBranch,
            prUrl: `https://github.com/${repo}/pull/preview`,
            state: 'SIMULATED',
            summary: `[Dry Run] Simulated dispatch of prompt: "${prompt.slice(0, 80)}"`,
          },
        };
      }

      if (!process.env.JULES_API_KEY) {
        return {
          success: false,
          error: {
            code: 'MISSING_API_KEY',
            message: 'JULES_API_KEY environment variable is not set.',
            suggestion: 'Export JULES_API_KEY in your environment or set it in .env.',
            recoverable: false,
          },
        };
      }

      // Check daily spending quota (Capped at 50 sessions for Day 1)
      const quota = checkAndIncrementQuota(50);
      if (!quota.allowed) {
        return {
          success: false,
          error: {
            code: 'DAILY_QUOTA_EXCEEDED',
            message: `Daily spending quota reached: ${quota.current}/${quota.limit} sessions dispatched today.`,
            suggestion: 'Wait for daily quota reset or switch to dry-run mode (--dry-run).',
            recoverable: false,
          },
        };
      }

      // Dynamic import to support environments where SDK is globally or locally linked
      // @ts-expect-error Optional peer dependency
      const { jules } = await import('@google/jules-sdk');

      console.error(`[Git Dispatch] Creating session for ${repo} on branch ${baseBranch} (Daily quota: ${quota.current}/${quota.limit})...`);
      const session = await jules.session({
        prompt,
        source: {
          github: repo,
          baseBranch,
        },
        requireApproval: false,
        autoPr: input.autoPr !== false,
      });

      console.error(`[Git Dispatch] Session created with ID: ${session.id}`);

      // Stream activities
      for await (const activity of session.stream()) {
        if (activity.type === 'agentMessaged') {
          console.error(`  [Agent] ${activity.message.slice(0, 100)}...`);
        } else if (activity.type === 'progressUpdated') {
          console.error(`  [Progress] ${activity.title}`);
        }
      }

      const outcome = await session.result();

      return {
        success: true,
        data: {
          sessionId: session.id,
          repo,
          baseBranch,
          prUrl: outcome.pullRequest?.url,
          state: outcome.state,
          summary: `Session ${session.id} finished with state ${outcome.state}.`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : String(error),
          suggestion: 'Check network connectivity and Jules API configuration.',
          recoverable: false,
        },
      };
    }
  }
}
