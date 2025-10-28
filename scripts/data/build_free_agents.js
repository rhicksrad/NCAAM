import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { ProxyAgent, setGlobalDispatcher } from 'undici';

import { getActiveFreeAgents } from '../../public/scripts/free_agents.js';

const proxyUrl = process.env.HTTPS_PROXY ?? process.env.https_proxy ?? null;
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}

async function buildBoard() {
  const board = await getActiveFreeAgents();
  const output = {
    ...board,
    generated_at: new Date().toISOString(),
  };

  const filePath = resolve('public/data/free_agents_live.json');
  await writeFile(filePath, JSON.stringify(output, null, 2));
  console.log(`Saved free agent board with ${board.entries.length} entries to ${filePath}`);
}

buildBoard().catch((error) => {
  console.error('Failed to build free agent board', error);
  process.exitCode = 1;
});
