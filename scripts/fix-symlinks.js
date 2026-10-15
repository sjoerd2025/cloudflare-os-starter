import fs from 'node:fs';
import path from 'node:path';

const rootDir = '/Volumes/ExternalSSD/projects/Github/cloudflare-os-starter-2';

// 1. In cloudflare-os/node_modules/@cloudflare/workers-types
const cfOsAtCloudflare = path.join(rootDir, 'cloudflare-os/node_modules/@cloudflare');
if (!fs.existsSync(cfOsAtCloudflare)) {
  fs.mkdirSync(cfOsAtCloudflare, { recursive: true });
}
const cfOsTarget = path.join(rootDir, 'cloudflare-os/node_modules/.pnpm/@cloudflare+workers-types@5.20260903.1/node_modules/@cloudflare/workers-types');
const cfOsLink = path.join(cfOsAtCloudflare, 'workers-types');
if (!fs.existsSync(cfOsLink)) {
  try {
    fs.symlinkSync(cfOsTarget, cfOsLink, 'junction');
    console.log('Linked cf-os workers-types');
  } catch (e) {
    console.error('Failed to link cf-os workers-types:', e);
  }
}

// 2. In root node_modules/@cloudflare/workers-types
const rootAtCloudflare = path.join(rootDir, 'node_modules/@cloudflare');
if (!fs.existsSync(rootAtCloudflare)) {
  fs.mkdirSync(rootAtCloudflare, { recursive: true });
}
const rootTarget = path.join(rootDir, 'node_modules/.pnpm/@cloudflare+workers-types@5.20261012.1/node_modules/@cloudflare/workers-types');
const rootLink = path.join(rootAtCloudflare, 'workers-types');
if (!fs.existsSync(rootLink)) {
  try {
    fs.symlinkSync(rootTarget, rootLink, 'junction');
    console.log('Linked root workers-types');
  } catch (e) {
    console.error('Failed to link root workers-types:', e);
  }
}

// 3. In cloudflare-os/node_modules/yjs
const yjsTarget = path.join(rootDir, 'cloudflare-os/node_modules/.pnpm/yjs@13.6.32/node_modules/yjs');
const yjsLink = path.join(rootDir, 'cloudflare-os/node_modules/yjs');
if (!fs.existsSync(yjsLink)) {
  try {
    fs.symlinkSync(yjsTarget, yjsLink, 'junction');
    console.log('Linked yjs');
  } catch (e) {
    console.error('Failed to link yjs:', e);
  }
}

// 4. In cloudflare-os/node_modules/lib0
const lib0Target = path.join(rootDir, 'cloudflare-os/node_modules/.pnpm/lib0@0.2.117/node_modules/lib0');
const lib0Link = path.join(rootDir, 'cloudflare-os/node_modules/lib0');
if (!fs.existsSync(lib0Link)) {
  try {
    fs.symlinkSync(lib0Target, lib0Link, 'junction');
    console.log('Linked lib0');
  } catch (e) {
    console.error('Failed to link lib0:', e);
  }
}

// 5. In cloudflare-os/node_modules/@gadgets/bundled-blueprints
const bundledBlueprintsTarget = path.join(rootDir, 'cloudflare-os/packages/bundled-blueprints');
const bundledBlueprintsLink = path.join(rootDir, 'cloudflare-os/node_modules/@gadgets/bundled-blueprints');
if (!fs.existsSync(bundledBlueprintsLink)) {
  try {
    fs.symlinkSync(bundledBlueprintsTarget, bundledBlueprintsLink, 'junction');
    console.log('Linked @gadgets/bundled-blueprints');
  } catch (e) {
    console.error('Failed to link @gadgets/bundled-blueprints:', e);
  }
}

// 6. In cloudflare-os/node_modules/@gadgets/observability
const obsTarget = path.join(rootDir, 'cloudflare-os/packages/observability');
const obsLink = path.join(rootDir, 'cloudflare-os/node_modules/@gadgets/observability');
if (!fs.existsSync(obsLink)) {
  try {
    fs.symlinkSync(obsTarget, obsLink, 'junction');
    console.log('Linked @gadgets/observability');
  } catch (e) {
    console.error('Failed to link @gadgets/observability:', e);
  }
}
