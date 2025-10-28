/*
  Simple health check for the NCAAM Worker.
  Run: node scripts/health-ncaam.mjs
*/
const ROOT = 'https://ncaam.hicksrch.workers.dev/diag';

const res = await fetch(ROOT, { headers: { Accept: 'application/json' } });
if (!res.ok) {
  console.error('Diag failed', res.status);
  process.exit(1);
}
const body = await res.json();
console.log(JSON.stringify(body, null, 2));
if (!body || body.ok !== true) {
  console.error('Diag did not return ok:true');
  process.exit(2);
}
console.log('NCAAM Worker OK');
