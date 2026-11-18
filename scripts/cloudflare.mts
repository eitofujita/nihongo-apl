import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import nextEnv from '@next/env';

const {loadEnvConfig} = nextEnv;
// This ignored file keeps the deployment origin separate from next dev.
if (existsSync('.env.cloudflare.local')) process.loadEnvFile('.env.cloudflare.local');
loadEnvConfig(process.cwd(), false);
process.env.NIHONGO_HOSTING = 'cloudflare';
process.env.WRANGLER_SEND_METRICS = 'false';
const command = process.argv[2];
if (!['build', 'preview', 'deploy', 'dry-run'].includes(command ?? '')) {
  throw new Error('Use build, preview, dry-run or deploy.');
}

function run(binary: string, args: string[]) {
  const result = spawnSync(binary, args, {stdio: 'inherit', env: process.env});
  if (result.error) throw new Error('Cloudflare command could not start. Check Node.js and npm dependencies.');
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (command === 'deploy') {
  let origin: URL;
  try {origin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? '');}
  catch {throw new Error('Set NEXT_PUBLIC_APP_URL in .env.cloudflare.local to your actual HTTPS origin.');}
  if (origin.protocol !== 'https:' || origin.username || origin.password ||
      origin.pathname !== '/' || origin.search || origin.hash ||
      ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) || origin.hostname.endsWith('.test')) {
    throw new Error('Deployment requires an actual HTTPS origin, without a path or query.');
  }
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!projectUrl?.startsWith('https://') || !publishableKey?.startsWith('sb_publishable_')) {
    throw new Error('Set the existing Supabase HTTPS URL and publishable key before deployment. Never use a secret key.');
  }
  // Rebuild with the same public origin that cookies/CSRF/auth redirects use.
  run('opennextjs-cloudflare', ['build']);
  run('opennextjs-cloudflare', ['deploy', '--', '--keep-vars', '--var', `NEXT_PUBLIC_APP_URL:${origin.origin}`]);
} else if (command === 'dry-run') {
  run('wrangler', ['deploy', '--dry-run', '--outdir', '.cloudflare/dry-run']);
} else {
  run('opennextjs-cloudflare', [command!]);
}
