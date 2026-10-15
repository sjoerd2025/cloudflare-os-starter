import { execSync } from 'node:child_process';

const cfOsDir = '/Volumes/ExternalSSD/projects/Github/cloudflare-os-starter-2/cloudflare-os';

function run(cmd) {
  try {
    console.log(`=== ${cmd} ===`);
    const out = execSync(cmd, { cwd: cfOsDir, encoding: 'utf8' });
    console.log(out);
  } catch (e) {
    console.log('Error:', e.message);
    if (e.stdout) console.log('stdout:', e.stdout);
    if (e.stderr) console.log('stderr:', e.stderr);
  }
}

run('git log -n 5 --oneline -- packages/bundled-blueprints');
run('git status --ignored packages/bundled-blueprints');
run('git ls-files packages/bundled-blueprints');
run('git ls-tree HEAD packages/bundled-blueprints');
