import { NCAAM } from "../sdk/ncaam.js";
const ACTIVE_ROSTER_SEASON = "2025-2026";
const ACTIVE_PLAYER_PAGE_SIZE = 200;
const MAX_ACTIVE_PLAYER_PAGES = 250;
function parseSeasonEndYear(label) {
    const match = label.match(/^(\d{4})-(\d{2}|\d{4})$/);
    if (!match) {
        return null;
    }
    const startYear = Number.parseInt(match[1] ?? "", 10);
    if (!Number.isFinite(startYear)) {
        return null;
    }
    const endFragment = match[2] ?? "";
    if (endFragment.length === 2) {
        const suffix = Number.parseInt(endFragment, 10);
        if (!Number.isFinite(suffix)) {
            return null;
        }
        const baseCentury = Math.floor(startYear / 100) * 100;
        let endYear = baseCentury + suffix;
        if (endYear <= startYear) {
            endYear += 100;
        }
        return endYear;
    }
    const endYear = Number.parseInt(endFragment, 10);
    return Number.isFinite(endYear) ? endYear : null;
}
function parseSeasonStartYear(label) {
    const match = label.match(/^(\d{4})/);
    if (!match) {
        return null;
    }
    const startYear = Number.parseInt(match[1] ?? "", 10);
    return Number.isFinite(startYear) ? startYear : null;
}
function buildConferenceNameLookup(conferences) {
    const map = new Map();
    for (const conference of conferences) {
        if (!conference || typeof conference.id !== "number")
            continue;
        const label = conference.short_name?.trim() || conference.name?.trim();
        if (label && label.length) {
            map.set(conference.id, label);
        }
    }
    return map;
}
function resolveConferenceName(conferenceId, conferenceMap) {
    if (conferenceId == null) {
        return "Independents";
    }
    return conferenceMap.get(conferenceId) ?? `Conference ${conferenceId}`;
}
function ensureTeamMap(teams) {
    const map = new Map();
    for (const team of teams) {
        if (!team || typeof team.id !== "number")
            continue;
        map.set(team.id, team);
    }
    return map;
}
function createEmptyStats() {
    return {
        gp: null,
        mp_g: null,
        pts_g: null,
        trb_g: null,
        ast_g: null,
        stl_g: null,
        blk_g: null,
        fg_pct: null,
        fg3_pct: null,
        ft_pct: null,
    };
}
function normaliseName(value) {
    const trimmed = value?.trim();
    return trimmed && trimmed.length ? trimmed : "Unknown";
}
function buildRosterPlayer(teamName, player) {
    const first = player.first_name?.trim() ?? "";
    const last = player.last_name?.trim() ?? "";
    const name = `${first} ${last}`.trim() || first || last || "Unknown";
    return {
        id: `bdl-${player.id}`,
        name,
        team: teamName,
        position: player.position?.trim() ?? null,
        jersey: player.jersey_number?.trim() ?? null,
        height: player.height?.trim() ?? null,
        weight: player.weight?.trim() ?? null,
        stats: createEmptyStats(),
    };
}
async function fetchActivePlayers(seasonLabel) {
    const players = [];
    const seasonEndYear = parseSeasonEndYear(seasonLabel);
    const seasonStartYear = parseSeasonStartYear(seasonLabel);
    const seasonParam = seasonEndYear ?? seasonStartYear ?? undefined;
    let cursor;
    let iterations = 0;
    while (iterations < MAX_ACTIVE_PLAYER_PAGES) {
        iterations += 1;
        const response = await NCAAM.activePlayers(ACTIVE_PLAYER_PAGE_SIZE, cursor, seasonParam);
        const data = Array.isArray(response.data) ? response.data : [];
        if (data.length === 0) {
            break;
        }
        players.push(...data);
        const nextCursor = response.meta?.next_cursor ?? null;
        if (!nextCursor || nextCursor === cursor) {
            break;
        }
        cursor = nextCursor;
    }
    return players;
}
export async function loadRosterDirectory() {
    const [{ data: teams = [] }, { data: conferences = [] }] = await Promise.all([
        NCAAM.teams(1, 400),
        NCAAM.conferences(),
    ]);
    const conferenceMap = buildConferenceNameLookup(conferences ?? []);
    const teamMap = ensureTeamMap(teams ?? []);
    const players = await fetchActivePlayers(ACTIVE_ROSTER_SEASON);
    const playersByTeam = new Map();
    for (const player of players) {
        const teamId = player.team?.id;
        if (typeof teamId !== "number")
            continue;
        if (!playersByTeam.has(teamId)) {
            playersByTeam.set(teamId, []);
        }
        playersByTeam.get(teamId).push(player);
    }
    const groups = new Map();
    for (const [teamId, rosterPlayers] of playersByTeam.entries()) {
        const teamRecord = teamMap.get(teamId) ?? rosterPlayers[0]?.team;
        if (!teamRecord) {
            continue;
        }
        const conferenceId = teamRecord.conference_id ?? rosterPlayers[0]?.team?.conference_id ?? null;
        const conferenceName = resolveConferenceName(conferenceId, conferenceMap);
        const groupKey = `${conferenceId ?? "independent"}`;
        if (!groups.has(groupKey)) {
            groups.set(groupKey, {
                id: conferenceId,
                name: conferenceName,
                teams: [],
                totalPlayers: 0,
            });
        }
        const fullName = normaliseName(teamRecord.full_name ?? rosterPlayers[0]?.team?.full_name);
        const shortName = normaliseName(teamRecord.name ?? rosterPlayers[0]?.team?.name ?? fullName);
        const abbreviation = teamRecord.abbreviation?.trim() ?? rosterPlayers[0]?.team?.abbreviation?.trim() ?? null;
        const formattedPlayers = rosterPlayers
            .map((player) => buildRosterPlayer(fullName, player))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
        const teamRoster = {
            id: teamId,
            name: shortName,
            fullName,
            abbreviation,
            conferenceId,
            conferenceName,
            players: formattedPlayers,
        };
        const group = groups.get(groupKey);
        group.teams.push(teamRoster);
        group.totalPlayers += formattedPlayers.length;
    }
    const orderedGroups = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    orderedGroups.forEach((group) => {
        group.teams.sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" }));
    });
    const totalPlayers = orderedGroups.reduce((sum, group) => sum + group.totalPlayers, 0);
    const totalTeams = orderedGroups.reduce((sum, group) => sum + group.teams.length, 0);
    return {
        season: ACTIVE_ROSTER_SEASON,
        conferences: orderedGroups.map((group) => ({
            id: group.id,
            name: group.name,
            totalPlayers: group.totalPlayers,
            teams: group.teams.map((team) => ({
                id: team.id,
                name: team.name,
                fullName: team.fullName,
                abbreviation: team.abbreviation,
                conferenceId: team.conferenceId,
                conferenceName: team.conferenceName,
                players: team.players.map((player) => ({ ...player })),
            })),
        })),
        totals: {
            players: totalPlayers,
            teams: totalTeams,
        },
    };
}
