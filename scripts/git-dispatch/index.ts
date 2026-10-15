import { parseArgs } from 'node:util';
import { GitDispatchHandler } from './handler.ts';

const options = {
  prompt: { type: 'string' as const, short: 'p' },
  branch: { type: 'string' as const, short: 'b', default: 'main' },
  repo: { type: 'string' as const, short: 'r', default: 'sjoerd2025/cloudflare-os-starter' },
  'dry-run': { type: 'boolean' as const, default: false },
  json: { type: 'boolean' as const, default: false },
  help: { type: 'boolean' as const, short: 'h', default: false },
};

const { values, positionals } = parseArgs({
  options,
  allowPositionals: true,
  strict: false,
});

if (values.help) {
  console.log(`
Usage: node scripts/git-dispatch/index.ts [options] [prompt]

Options:
  -p, --prompt <string>   Task prompt for Jules
  -b, --branch <string>   Base branch (default: main)
  -r, --repo <string>     GitHub repo (default: sjoerd2025/cloudflare-os-starter)
  --dry-run               Simulate dispatch without API calls
  --json                  Output result in JSON format
  -h, --help              Show help
`);
  process.exit(0);
}

const promptStr = typeof values.prompt === 'string' ? values.prompt : positionals.join(' ');
const repoStr = typeof values.repo === 'string' ? values.repo : undefined;
const branchStr = typeof values.branch === 'string' ? values.branch : undefined;
const dryRunBool = Boolean(values['dry-run']);

const handler = new GitDispatchHandler();

const result = await handler.execute({
  prompt: promptStr,
  repo: repoStr,
  baseBranch: branchStr,
  dryRun: dryRunBool,
});

if (values.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  if (result.success) {
    console.log('\n✅ Git Dispatch Succeeded:');
    console.log(`   Session: ${result.data.sessionId}`);
    console.log(`   State:   ${result.data.state}`);
    if (result.data.prUrl) console.log(`   PR:      ${result.data.prUrl}`);
  } else {
    console.error(`\n❌ Git Dispatch Failed: ${result.error.message}`);
    if (result.error.suggestion) {
      console.error(`   Suggestion: ${result.error.suggestion}`);
    }
  }
}

process.exit(result.success ? 0 : 1);
