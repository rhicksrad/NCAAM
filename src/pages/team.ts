import { BRAND, DEFAULT_SEASON } from '../lib/config/ncaam';
import { team as fetchTeam, teamRoster, standings, scoreboard } from '../lib/sdk/ncaam';
import type { Game, Player, StandingGroup } from '../lib/sdk/types';
import { el, mount, section } from '../lib/ui/dom';
import { nav, footer } from '../lib/ui/nav';
import { gamesList, teamLogo } from '../lib/ui/components';
import { emptyState, errorCard, skeletonRows } from '../lib/ui/feedback';
import '../../public/styles/site.css';

function getTeamIdFromHash(): string | null {
  const hash = window.location.hash.slice(1).trim();
  return hash || null;
}

function playerName(player: Player): string {
  return `${player.firstName ?? ''} ${player.lastName ?? ''}`.trim();
}

function rosterTable(players: Player[]): HTMLElement {
  const table = el('table', { class: 'data' });
  const thead = el('thead');
  const headerRow = el('tr');
  ['Player', 'Pos', 'Height', 'Weight', 'Class'].forEach(label => {
    headerRow.appendChild(el('th', {}, label));
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);
  const tbody = el('tbody');
  players.forEach(player => {
    const row = el('tr');
    row.appendChild(el('td', {}, playerName(player) || '—'));
    row.appendChild(el('td', {}, player.position ?? ''));
    row.appendChild(el('td', {}, player.height ?? ''));
    row.appendChild(el('td', {}, player.weight ?? ''));
    row.appendChild(el('td', {}, player.classYear ?? ''));
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  return table;
}

function findStanding(groups: StandingGroup[], teamId: string) {
  for (const group of groups) {
    const match = group.rows.find(row => row.team.id === teamId);
    if (match) return { group, row: match };
  }
  return null;
}

function formatRecord(wins?: number, losses?: number): string | null {
  if (wins == null || losses == null) return null;
  return `${wins}-${losses}`;
}

async function nextGame(teamId: string): Promise<Game | null> {
  const today = new Date();
  for (let offset = 0; offset < 14; offset += 1) {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    const iso = d.toISOString().slice(0, 10);
    try {
      const games = await scoreboard(iso);
      const match = games.find(game => game.home.team.id === teamId || game.away.team.id === teamId);
      if (match && match.stage !== 'final') return match;
    } catch {
      // ignore and continue
    }
  }
  return null;
}

async function render() {
  const root = document.getElementById('app');
  if (!root) return;

  const teamId = getTeamIdFromHash();
  if (!teamId) {
    mount(root, el('div', { class: 'container' },
      el('h1', { class: 'title' }, `${BRAND.siteTitle} — Team`),
      nav(),
      errorCard('Select a team from the Teams index.'),
      footer()
    ));
    return;
  }

  const rosterSection = section('Roster', skeletonRows(8));
  const statsSection = section('Season Snapshot', skeletonRows(1));
  const scheduleSection = section('Next Game', skeletonRows(1));

  const shell = el('div', { class: 'container' },
    el('h1', { class: 'title' }, `${BRAND.siteTitle} — Team`),
    nav(),
    el('p', {}, el('a', { href: 'teams.html' }, '← Back to Teams index')),
    rosterSection,
    statsSection,
    scheduleSection,
    footer()
  );
  mount(root, shell);

  try {
    const [teamInfo, roster, standingsData] = await Promise.all([
      fetchTeam(teamId),
      teamRoster(teamId),
      standings(DEFAULT_SEASON)
    ]);

    const headerLogo = teamLogo(teamInfo, 'medium');
    const headerTitle = el('h2', { class: 'section-title' }, teamInfo.displayName);
    const header = el('div', { class: 'section team-header' },
      headerLogo,
      el('div', { class: 'team-header-meta' },
        headerTitle,
        teamInfo.conference ? el('p', {}, `Conference: ${teamInfo.conference}`) : null,
        el('p', {}, `Team ID: ${teamInfo.id}`)
      )
    );
    shell.insertBefore(header, rosterSection);

    const standing = findStanding(standingsData, teamInfo.id);
    const overallRecord = standing?.row ? formatRecord(standing.row.wins, standing.row.losses) : null;
    const conferenceRecord = standing?.row && standing.row.conferenceWins != null && standing.row.conferenceLosses != null
      ? `${standing.row.conferenceWins}-${standing.row.conferenceLosses}`
      : teamInfo.record?.conference ?? null;

    statsSection.replaceChildren(el('h2', { class: 'section-title' }, 'Season Snapshot'),
      el('div', { class: 'rows' },
        el('div', { class: 'row row-standings' },
          el('span', { class: 'standings-team' }, 'Overall'),
          el('span', {}, overallRecord ?? '—')
        ),
        el('div', { class: 'row row-standings' },
          el('span', { class: 'standings-team' }, 'Conference'),
          el('span', {}, conferenceRecord ?? '—')
        )
      )
    );

    const sortedRoster = roster.slice().sort((a, b) => playerName(a).localeCompare(playerName(b)));
    rosterSection.replaceChildren(el('h2', { class: 'section-title' }, 'Roster'), rosterTable(sortedRoster));

    const upcoming = await nextGame(teamInfo.id);
    if (upcoming) {
      scheduleSection.replaceChildren(el('h2', { class: 'section-title' }, 'Next Game'), gamesList([upcoming]));
    } else {
      scheduleSection.replaceChildren(el('h2', { class: 'section-title' }, 'Next Game'), emptyState('No upcoming games found in the next two weeks.'));
    }
  } catch (err) {
    rosterSection.replaceChildren(el('h2', { class: 'section-title' }, 'Roster'), errorCard(`Unable to load team: ${err instanceof Error ? err.message : String(err)}`));
    statsSection.replaceChildren(el('h2', { class: 'section-title' }, 'Season Snapshot'), errorCard('Standings unavailable.'));
    scheduleSection.replaceChildren(el('h2', { class: 'section-title' }, 'Next Game'), errorCard('Unable to determine upcoming games.'));
  }
}

void render();
