import { el } from './dom';
import { basePath } from './base';
import type { Game, Poll, StandingGroup } from '../sdk/types';

export function teamLink(teamId: string, label: string, attrs: Record<string, string> = {}): HTMLAnchorElement {
  const base = basePath();
  const anchor = el('a', { href: `${base}team.html#${encodeURIComponent(teamId)}`, ...attrs });
  anchor.textContent = label;
  return anchor;
}

export function gameRow(game: Game): HTMLElement {
  const row = el('div', { class: `row row-stage-${game.stage}` });
  const time = el('div', { class: 'row-time', title: game.tipLabel }, game.tipLocal);
  const matchup = el('div', { class: 'row-matchup' });
  const awayLabel = game.away.team.abbreviation || game.away.team.shortName || game.away.team.displayName;
  const homeLabel = game.home.team.abbreviation || game.home.team.shortName || game.home.team.displayName;
  const away = teamLink(game.away.team.id, awayLabel, { class: 'team-away' });
  const home = teamLink(game.home.team.id, homeLabel, { class: 'team-home' });
  matchup.appendChild(away);
  matchup.appendChild(el('span', { class: 'at' }, '@'));
  matchup.appendChild(home);

  const score = el('div', { class: 'row-score' });
  const awayScore = game.away.score ?? '—';
  const homeScore = game.home.score ?? '—';
  score.appendChild(el('span', { class: 'score-away' }, String(awayScore)));
  score.appendChild(el('span', { class: 'score-sep' }, '–'));
  score.appendChild(el('span', { class: 'score-home' }, String(homeScore)));

  const status = el('div', { class: 'row-status' }, game.status);

  row.appendChild(time);
  row.appendChild(matchup);
  row.appendChild(score);
  row.appendChild(status);
  return row;
}

export function gamesList(games: Game[]): HTMLElement {
  const wrapper = el('div', { class: 'rows' });
  games.forEach(game => wrapper.appendChild(gameRow(game)));
  return wrapper;
}

export function pollBlock(poll: Poll): HTMLElement {
  const section = el('section', { class: 'section poll' });
  const headingText = poll.week ? `${poll.displayName} — Week ${poll.week}` : poll.displayName;
  section.appendChild(el('h2', { class: 'section-title' }, headingText));
  if (!poll.entries.length) {
    section.appendChild(el('p', { class: 'empty-state' }, 'No rankings available.'));
    return section;
  }
  const list = el('ol', { class: 'poll-list' });
  poll.entries.forEach(entry => {
    const li = el('li', { class: 'poll-entry' });
    li.appendChild(teamLink(entry.team.id, entry.team.displayName));
    if (entry.record) li.appendChild(el('span', { class: 'poll-record' }, ` (${entry.record})`));
    list.appendChild(li);
  });
  section.appendChild(list);
  return section;
}

export function standingsGroups(groups: StandingGroup[]): HTMLElement {
  const wrapper = el('div', { class: 'standings-groups' });
  groups.forEach(group => {
    const block = el('section', { class: 'standings-group' });
    block.appendChild(el('h2', { class: 'section-title' }, group.conferenceName));
    const list = el('div', { class: 'rows standings-rows' });
    group.rows.forEach(row => {
      const item = el('div', { class: 'row row-standings' });
      item.appendChild(teamLink(row.team.id, row.team.displayName, { class: 'standings-team' }));
      item.appendChild(el('span', { class: 'standings-record' }, `${row.wins}-${row.losses}`));
      if (row.conferenceWins !== undefined && row.conferenceLosses !== undefined) {
        item.appendChild(el('span', { class: 'standings-conf' }, `${row.conferenceWins}-${row.conferenceLosses}`));
      }
      list.appendChild(item);
    });
    block.appendChild(list);
    wrapper.appendChild(block);
  });
  return wrapper;
}
