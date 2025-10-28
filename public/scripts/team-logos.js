const fallbackLogo = 'assets/logos/nba-logoman.svg';

const teamLogoLookup = new Map([
  ['atlanta hawks', 'assets/logos/teams/atlanta-hawks.svg'],
  ['boston celtics', 'assets/logos/teams/boston-celtics.svg'],
  ['brooklyn nets', 'assets/logos/teams/brooklyn-nets.svg'],
  ['charlotte hornets', 'assets/logos/teams/charlotte-hornets.svg'],
  ['charlotte bobcats', 'assets/logos/teams/charlotte-hornets.svg'],
  ['chicago bulls', 'assets/logos/teams/chicago-bulls.svg'],
  ['cleveland cavaliers', 'assets/logos/teams/cleveland-cavaliers.svg'],
  ['dallas mavericks', 'assets/logos/teams/dallas-mavericks.svg'],
  ['denver nuggets', 'assets/logos/teams/denver-nuggets.svg'],
  ['detroit pistons', 'assets/logos/teams/detroit-pistons.svg'],
  ['golden state warriors', 'assets/logos/teams/golden-state-warriors.svg'],
  ['houston rockets', 'assets/logos/teams/houston-rockets.svg'],
  ['indiana pacers', 'assets/logos/teams/indiana-pacers.svg'],
  ['los angeles clippers', 'assets/logos/teams/los-angeles-clippers.svg'],
  ['la clippers', 'assets/logos/teams/los-angeles-clippers.svg'],
  ['los angeles lakers', 'assets/logos/teams/los-angeles-lakers.svg'],
  ['la lakers', 'assets/logos/teams/los-angeles-lakers.svg'],
  ['memphis grizzlies', 'assets/logos/teams/memphis-grizzlies.svg'],
  ['miami heat', 'assets/logos/teams/miami-heat.svg'],
  ['milwaukee bucks', 'assets/logos/teams/milwaukee-bucks.svg'],
  ['minnesota timberwolves', 'assets/logos/teams/minnesota-timberwolves.svg'],
  ['new orleans pelicans', 'assets/logos/teams/new-orleans-pelicans.svg'],
  ['new orleans hornets', 'assets/logos/teams/new-orleans-pelicans.svg'],
  ['new york knicks', 'assets/logos/teams/new-york-knicks.svg'],
  ['oklahoma city thunder', 'assets/logos/teams/oklahoma-city-thunder.svg'],
  ['orlando magic', 'assets/logos/teams/orlando-magic.svg'],
  ['philadelphia 76ers', 'assets/logos/teams/philadelphia-76ers.svg'],
  ['phoenix suns', 'assets/logos/teams/phoenix-suns.svg'],
  ['portland trail blazers', 'assets/logos/teams/portland-trail-blazers.svg'],
  ['portland trailblazers', 'assets/logos/teams/portland-trail-blazers.svg'],
  ['sacramento kings', 'assets/logos/teams/sacramento-kings.svg'],
  ['san antonio spurs', 'assets/logos/teams/san-antonio-spurs.svg'],
  ['toronto raptors', 'assets/logos/teams/toronto-raptors.svg'],
  ['utah jazz', 'assets/logos/teams/utah-jazz.svg'],
  ['washington wizards', 'assets/logos/teams/washington-wizards.svg'],
]);

const abbreviationLookup = new Map([
  ['ATL', 'assets/logos/teams/atlanta-hawks.svg'],
  ['BOS', 'assets/logos/teams/boston-celtics.svg'],
  ['BKN', 'assets/logos/teams/brooklyn-nets.svg'],
  ['BRK', 'assets/logos/teams/brooklyn-nets.svg'],
  ['CHA', 'assets/logos/teams/charlotte-hornets.svg'],
  ['CHO', 'assets/logos/teams/charlotte-hornets.svg'],
  ['CHI', 'assets/logos/teams/chicago-bulls.svg'],
  ['CLE', 'assets/logos/teams/cleveland-cavaliers.svg'],
  ['DAL', 'assets/logos/teams/dallas-mavericks.svg'],
  ['DEN', 'assets/logos/teams/denver-nuggets.svg'],
  ['DET', 'assets/logos/teams/detroit-pistons.svg'],
  ['GSW', 'assets/logos/teams/golden-state-warriors.svg'],
  ['HOU', 'assets/logos/teams/houston-rockets.svg'],
  ['IND', 'assets/logos/teams/indiana-pacers.svg'],
  ['LAC', 'assets/logos/teams/los-angeles-clippers.svg'],
  ['LAL', 'assets/logos/teams/los-angeles-lakers.svg'],
  ['MEM', 'assets/logos/teams/memphis-grizzlies.svg'],
  ['MIA', 'assets/logos/teams/miami-heat.svg'],
  ['MIL', 'assets/logos/teams/milwaukee-bucks.svg'],
  ['MIN', 'assets/logos/teams/minnesota-timberwolves.svg'],
  ['NOP', 'assets/logos/teams/new-orleans-pelicans.svg'],
  ['NOH', 'assets/logos/teams/new-orleans-pelicans.svg'],
  ['NYK', 'assets/logos/teams/new-york-knicks.svg'],
  ['OKC', 'assets/logos/teams/oklahoma-city-thunder.svg'],
  ['ORL', 'assets/logos/teams/orlando-magic.svg'],
  ['PHI', 'assets/logos/teams/philadelphia-76ers.svg'],
  ['PHL', 'assets/logos/teams/philadelphia-76ers.svg'],
  ['PHX', 'assets/logos/teams/phoenix-suns.svg'],
  ['POR', 'assets/logos/teams/portland-trail-blazers.svg'],
  ['SAC', 'assets/logos/teams/sacramento-kings.svg'],
  ['SAS', 'assets/logos/teams/san-antonio-spurs.svg'],
  ['SA', 'assets/logos/teams/san-antonio-spurs.svg'],
  ['TOR', 'assets/logos/teams/toronto-raptors.svg'],
  ['UTA', 'assets/logos/teams/utah-jazz.svg'],
  ['WAS', 'assets/logos/teams/washington-wizards.svg'],
  ['WSH', 'assets/logos/teams/washington-wizards.svg'],
]);

function normalizeName(value) {
  return typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() : '';
}

export function getTeamLogo(identifier) {
  if (!identifier) {
    return fallbackLogo;
  }
  const normalized = normalizeName(identifier);
  if (normalized && teamLogoLookup.has(normalized)) {
    return teamLogoLookup.get(normalized);
  }
  const abbreviation = typeof identifier === 'string' ? identifier.toUpperCase().replace(/[^A-Z]/g, '') : '';
  if (abbreviation && abbreviationLookup.has(abbreviation)) {
    return abbreviationLookup.get(abbreviation);
  }
  return fallbackLogo;
}

export function createTeamLogo(identifier, className = 'team-logo') {
  const logo = document.createElement('img');
  logo.src = getTeamLogo(identifier);
  logo.alt = identifier ? `${identifier} logo` : 'NBA logo';
  logo.loading = 'lazy';
  logo.decoding = 'async';
  if (className) {
    logo.className = className;
  }
  return logo;
}
