#!/usr/bin/env node
import { bdl } from '../../public/assets/js/bdl.js';

async function main() {
  const params = new URLSearchParams();
  params.append('dates[]', '2025-10-02');
  params.set('per_page', '100');
  params.set('postseason', 'false');

  const payload = await bdl(`/v1/games?${params.toString()}`, { cache: 'no-store' });
  const games = Array.isArray(payload?.data) ? payload.data : [];
  console.log(`Fetched ${games.length} games for 2025-10-02`);

  const matchupFound = games.some((game) => {
    const home = game?.home_team?.full_name?.toLowerCase() ?? '';
    const visitor = game?.visitor_team?.full_name?.toLowerCase() ?? '';
    const hasKnicks = home.includes('knicks') || visitor.includes('knicks');
    const hasSixers = home.includes('76ers') || visitor.includes('76ers');
    return hasKnicks && hasSixers;
  });

  if (!matchupFound) {
    console.error('Expected Knicks vs 76ers preseason game was not found.');
    process.exitCode = 1;
    return;
  }

  console.log('Knicks vs 76ers preseason game detected.');
}

main().catch((error) => {
  console.error('Smoke test failed', error);
  process.exitCode = 1;
});
