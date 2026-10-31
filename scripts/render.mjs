#!/usr/bin/env node
// Render automation with no dependencies (Node 22+ fetch). The same code path runs locally and in GitHub Actions.
//
//   node scripts/render.mjs create            create the web service from the git remote (one time)
//   node scripts/render.mjs deploy            trigger a deploy, wait until it is live, then smoke-test the public URL
//   node scripts/render.mjs autodeploy on|off switch Render's own push-to-deploy (turn it OFF once GitHub Actions deploys)
//
// Environment (shell or .env; the API key is never printed):
//   RENDER_API_KEY      required. Render > Account Settings > API Keys. Use a key you can revoke.
//   RENDER_SERVICE_ID   deploy/autodeploy: `srv-...` (printed by `create`)
//   DATABASE_URL        create: the Neon connection string stored as a Render env var
//   RENDER_OWNER_ID     create: only needed when the key can see several workspaces
//   RENDER_REGION       create: default oregon (pick the one nearest the Neon project)
//   RENDER_PLAN         create: default free
//   BRANCH              create: default main
//   COMMIT_ID           deploy: deploy this exact commit instead of the branch head (roll back / pin)
//   SKIP_SMOKE=1        deploy: skip the post-deploy checks
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const API = 'https://api.render.com/v1';
const key = process.env.RENDER_API_KEY;
const [command, arg] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (msg) => console.log(msg);

function fail(msg) {
  console.error(`render.mjs: ${msg}`);
  process.exit(1);
}

async function render(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) fail(`${method} ${path} -> ${res.status} ${data?.message ?? text.slice(0, 200)}`);
  return data;
}

// ---------- create ----------
async function create() {
  if (!process.env.DATABASE_URL) fail('DATABASE_URL is required to create the service');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  // https URL of the git remote; Render clones over https (the repo must be public or connected to Render's GitHub app).
  let remote;
  try {
    remote = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
  } catch {
    fail('no git remote "origin": push the repo to GitHub first');
  }
  const repo = remote.replace(/^git@([^:]+):/, 'https://$1/').replace(/\.git$/, '');

  const owners = await render('GET', '/owners?limit=20');
  const ownerId = process.env.RENDER_OWNER_ID ?? (owners.length === 1 ? owners[0].owner.id : null);
  if (!ownerId) fail(`several workspaces visible, set RENDER_OWNER_ID to one of: ${owners.map((o) => o.owner.id).join(', ')}`);

  const existing = await render('GET', '/services?limit=100');
  if (existing.some((s) => s.service.name === pkg.name)) fail(`a service named "${pkg.name}" already exists; use its id as RENDER_SERVICE_ID`);

  const created = await render('POST', '/services', {
    type: 'web_service',
    name: pkg.name,
    ownerId,
    repo,
    branch: process.env.BRANCH ?? 'main',
    autoDeploy: 'no', // GitHub Actions deploys after CI passes; see .github/workflows/ci-cd.yml
    envVars: [
      { key: 'DATABASE_URL', value: process.env.DATABASE_URL },
      { key: 'BETTER_AUTH_SECRET', value: crypto.randomBytes(32).toString('base64url') },
    ],
    serviceDetails: {
      runtime: 'docker',
      plan: process.env.RENDER_PLAN ?? 'free',
      region: process.env.RENDER_REGION ?? 'oregon',
      healthCheckPath: '/api/health',
      envSpecificDetails: { dockerfilePath: './Dockerfile', dockerContext: '.' },
    },
  });
  const service = created.service ?? created;
  log(`Created ${service.name}`);
  log(`  RENDER_SERVICE_ID=${service.id}`);
  log(`  URL: ${service.serviceDetails?.url}`);
  log(`  Dashboard: ${service.dashboardUrl}`);
  log('The first build is already running. Add RENDER_API_KEY and RENDER_SERVICE_ID as GitHub repository secrets to automate later deploys.');
}

// ---------- deploy ----------
const FAILED = new Set(['build_failed', 'update_failed', 'canceled', 'pre_deploy_failed', 'deactivated']);

async function deploy() {
  const id = process.env.RENDER_SERVICE_ID;
  if (!id) fail('RENDER_SERVICE_ID is required');
  const body = { clearCache: 'do_not_clear' };
  if (process.env.COMMIT_ID) body.commitId = process.env.COMMIT_ID;

  const started = await render('POST', `/services/${id}/deploys`, body);
  const deployId = started.id ?? started.deploy?.id;
  if (!deployId) fail('Render did not return a deploy id');
  log(`Deploy ${deployId} started${started.commit?.id ? ` for commit ${started.commit.id.slice(0, 7)}` : ''}`);

  const deadline = Date.now() + 20 * 60_000;
  let last = '';
  for (;;) {
    const d = await render('GET', `/services/${id}/deploys/${deployId}`);
    if (d.status !== last) log(`  status: ${d.status}`);
    last = d.status;
    if (d.status === 'live') break;
    if (FAILED.has(d.status)) fail(`deploy ended as ${d.status}. Logs: https://dashboard.render.com/web/${id}/deploys/${deployId}`);
    if (Date.now() > deadline) fail('timed out after 20 minutes waiting for the deploy');
    await sleep(10_000);
  }

  const svc = await render('GET', `/services/${id}`);
  const url = svc.serviceDetails?.url;
  log(`Live: ${url}`);
  if (process.env.SKIP_SMOKE === '1' || !url) return;
  await smoke(url);
}

// ---------- smoke checks (read-only: no accounts or bookings are created in the production database) ----------
async function smoke(url) {
  const check = async (name, fn) => {
    try {
      await fn();
      log(`  ok   ${name}`);
    } catch (err) {
      fail(`smoke check "${name}" failed: ${err.message}`);
    }
  };
  const expect = (cond, msg) => {
    if (!cond) throw new Error(msg);
  };

  // A free instance may still be waking up for a moment after "live".
  await check('GET /api/health reports db up', async () => {
    let last;
    for (let i = 0; i < 12; i++) {
      try {
        const res = await fetch(`${url}/api/health`);
        const json = await res.json();
        if (res.ok && json.ok && json.db === 'up') return;
        last = `status ${res.status} ${JSON.stringify(json)}`;
      } catch (err) {
        last = err.message;
      }
      await sleep(5_000);
    }
    throw new Error(last);
  });
  await check('GET / serves the app', async () => {
    const res = await fetch(url, { headers: { Accept: 'text/html' } });
    expect(res.status === 200 && (await res.text()).includes('<div id="root">'), `status ${res.status}`);
  });
  await check('SPA deep link falls back to index.html', async () => {
    const res = await fetch(`${url}/bookings`, { headers: { Accept: 'text/html' } });
    expect(res.status === 200, `status ${res.status}`);
  });
  await check('GET /api/auth/ok (Better Auth mounted)', async () => {
    const res = await fetch(`${url}/api/auth/ok`);
    expect(res.status === 200, `status ${res.status}`);
  });
  await check('anonymous GET /api/bookings is 401', async () => {
    const res = await fetch(`${url}/api/bookings`);
    expect(res.status === 401, `status ${res.status}`);
  });
  await check('unknown /api path is a JSON 404', async () => {
    const res = await fetch(`${url}/api/does-not-exist`);
    expect(res.status === 404 && (res.headers.get('content-type') ?? '').includes('json'), `status ${res.status}`);
  });
  log('Smoke checks passed');
}

// ---------- autodeploy ----------
async function autodeploy() {
  const id = process.env.RENDER_SERVICE_ID;
  if (!id) fail('RENDER_SERVICE_ID is required');
  if (!['on', 'off'].includes(arg)) fail('usage: autodeploy on|off');
  await render('PATCH', `/services/${id}`, { autoDeploy: arg === 'on' ? 'yes' : 'no' });
  log(`Render auto-deploy on push is now ${arg.toUpperCase()}`);
}

if (!key) fail('RENDER_API_KEY is not set');
const commands = { create, deploy, autodeploy };
if (!commands[command]) fail('usage: node scripts/render.mjs create | deploy | autodeploy on|off');
await commands[command]();
