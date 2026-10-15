const cp = require('child_process');
const fs = require('fs');
try {
  console.log('GIT SUBMODULE STATUS:');
  console.log(cp.execSync('git submodule status', { cwd: '/Volumes/ExternalSSD/projects/Github/cloudflare-os-starter-2' }).toString());
} catch (e) {
  console.error(e.message);
}
if (fs.existsSync(__filename)) fs.unlinkSync(__filename);
