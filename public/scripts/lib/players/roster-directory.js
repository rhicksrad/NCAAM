import { NCAAM } from "../sdk/ncaam.js";
import { loadPlayerIndexDocument, loadPlayerStatsDocument, pickSeasonStats, } from "./data.js";
const DEFAULT_ACTIVE_ROSTER_SEASON = "2024-25";
let activeRosterSeasonPromise = null;
const teamRosterCache = new Map();
let playerIndexLookupPromise = null;
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
function normaliseName(value) {
    const trimmed = value?.trim();
    return trimmed && trimmed.length ? trimmed : "Unknown";
}
function normaliseKey(value) {
    const text = value?.normalize("NFD");
    if (!text) {
        return null;
    }
    const replaced = text.replace(/&/gu, " and ");
    const stripped = replaced.replace(/[\p{M}]+/gu, "");
    const collapsed = stripped.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (!collapsed) {
        return null;
    }
    return collapsed.toLowerCase();
}
function buildKeyVariants(value) {
    const key = normaliseKey(value);
    if (!key) {
        return [];
    }
    const variants = new Set([key]);
    const compact = key.replace(/\s+/g, "");
    if (compact.length) {
        variants.add(compact);
    }
    return [...variants];
}
function buildPlayerIndexLookup(document) {
    const byName = new Map();
    const byNameTeam = new Map();
    const entries = document.players ?? [];
    for (const entry of entries) {
        const nameKeys = new Set([
            ...buildKeyVariants(entry.name_key ?? null),
            ...buildKeyVariants(entry.name ?? null),
        ]);
        const teamKeys = new Set([
            ...buildKeyVariants(entry.team_key ?? null),
            ...buildKeyVariants(entry.team ?? null),
        ]);
        for (const nameKey of nameKeys) {
            if (!byName.has(nameKey)) {
                byName.set(nameKey, []);
            }
            byName.get(nameKey).push(entry);
        }
        for (const nameKey of nameKeys) {
            for (const teamKey of teamKeys) {
                const combinedKey = `${nameKey}::${teamKey}`;
                if (!byNameTeam.has(combinedKey)) {
                    byNameTeam.set(combinedKey, []);
                }
                byNameTeam.get(combinedKey).push(entry);
            }
        }
    }
    return { byName, byNameTeam };
}
async function getActiveRosterSeason() {
    if (!activeRosterSeasonPromise) {
        activeRosterSeasonPromise = (async () => {
            try {
                const document = await loadPlayerIndexDocument();
                const seasons = document.seasons ?? [];
                if (seasons.length > 0) {
                    const latest = seasons[0] ?? seasons[seasons.length - 1];
                    if (latest) {
                        return latest;
                    }
                }
            }
            catch (error) {
                console.error("Unable to determine active roster season", error);
            }
            return DEFAULT_ACTIVE_ROSTER_SEASON;
        })();
    }
    return await activeRosterSeasonPromise;
}
async function getPlayerIndexLookup() {
    if (!playerIndexLookupPromise) {
        playerIndexLookupPromise = loadPlayerIndexDocument()
            .then((document) => buildPlayerIndexLookup(document))
            .catch((error) => {
            playerIndexLookupPromise = null;
            throw error;
        });
    }
    return await playerIndexLookupPromise;
}
function buildTeamKeyCandidates(team, playerTeam) {
    const keys = new Set();
    const candidates = [
        team.fullName,
        team.name,
        team.abbreviation,
        team.college,
        playerTeam?.full_name,
        playerTeam?.name,
        playerTeam?.abbreviation,
        playerTeam?.college,
    ];
    for (const candidate of candidates) {
        for (const key of buildKeyVariants(candidate)) {
            keys.add(key);
        }
    }
    return [...keys];
}
function extractSeasonYear(entry) {
    if (typeof entry.season_year === "number" && Number.isFinite(entry.season_year)) {
        return entry.season_year;
    }
    return parseSeasonEndYear(entry.season ?? "");
}
function pickPlayerIndexEntry(lookup, nameKeys, teamKeys, seasonEndYear) {
    const candidates = [];
    const seen = new Set();
    for (const nameKey of nameKeys) {
        for (const teamKey of teamKeys) {
            const teamEntries = lookup.byNameTeam.get(`${nameKey}::${teamKey}`) ?? [];
            for (const entry of teamEntries) {
                if (seen.has(entry))
                    continue;
                seen.add(entry);
                candidates.push(entry);
            }
        }
    }
    for (const nameKey of nameKeys) {
        const nameEntries = lookup.byName.get(nameKey) ?? [];
        for (const entry of nameEntries) {
            if (seen.has(entry))
                continue;
            seen.add(entry);
            candidates.push(entry);
        }
    }
    if (!candidates.length) {
        return null;
    }
    let filtered = candidates;
    if (seasonEndYear !== null) {
        const seasonMatches = candidates.filter((entry) => extractSeasonYear(entry) === seasonEndYear);
        if (seasonMatches.length) {
            filtered = seasonMatches;
        }
    }
    if (teamKeys.length) {
        const teamMatches = filtered.filter((entry) => {
            const entryTeamKeys = buildKeyVariants(entry.team_key ?? entry.team);
            return entryTeamKeys.some((entryKey) => teamKeys.includes(entryKey));
        });
        if (teamMatches.length) {
            filtered = teamMatches;
        }
    }
    filtered.sort((a, b) => (extractSeasonYear(b) ?? 0) - (extractSeasonYear(a) ?? 0));
    return filtered[0] ?? null;
}
function toPlayerStatsSnapshot(season) {
    if (!season) {
        return null;
    }
    return {
        gp: season.gp ?? null,
        mp_g: season.mp_g ?? null,
        pts_g: season.pts_g ?? null,
        trb_g: season.trb_g ?? null,
        ast_g: season.ast_g ?? null,
        stl_g: season.stl_g ?? null,
        blk_g: season.blk_g ?? null,
        fg_pct: season.fg_pct ?? null,
        fg3_pct: season.fg3_pct ?? null,
        ft_pct: season.ft_pct ?? null,
    };
}
async function resolvePlayerStats(player, team, seasonLabel, seasonEndYear) {
    const nameKeys = buildKeyVariants(`${player.first_name ?? ""} ${player.last_name ?? ""}`);
    if (!nameKeys.length) {
        return null;
    }
    try {
        const lookup = await getPlayerIndexLookup();
        const teamKeys = buildTeamKeyCandidates(team, player.team);
        const entry = pickPlayerIndexEntry(lookup, nameKeys, teamKeys, seasonEndYear);
        if (!entry) {
            return null;
        }
        const document = await loadPlayerStatsDocument(entry.slug);
        const seasonStats = pickSeasonStats(document, seasonLabel);
        return toPlayerStatsSnapshot(seasonStats);
    }
    catch (error) {
        console.error(`Unable to load stats for ${player.first_name} ${player.last_name}`, error);
        return null;
    }
}
function buildRosterPlayer(teamName, player, stats) {
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
        stats,
    };
}
async function fetchTeamRosterPlayers(team, seasonLabel) {
    const seasonStartYear = parseSeasonStartYear(seasonLabel);
    const seasonEndYear = parseSeasonEndYear(seasonLabel);
    const seasonParam = seasonStartYear ?? seasonEndYear ?? undefined;
    const response = await NCAAM.activePlayersByTeam(team.id, seasonParam);
    const players = Array.isArray(response.data) ? response.data : [];
    const roster = await Promise.all(players.map(async (player) => {
        const stats = await resolvePlayerStats(player, team, seasonLabel, seasonEndYear);
        return buildRosterPlayer(team.fullName, player, stats);
    }));
    roster.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return roster;
}
function getTeamRosterCacheKey(teamId, seasonLabel) {
    return `${teamId}:${seasonLabel}`;
}
export async function loadRosterDirectory() {
    const season = await getActiveRosterSeason();
    const [{ data: teams = [] }, { data: conferences = [] }] = await Promise.all([
        NCAAM.teams(1, 400),
        NCAAM.conferences(),
    ]);
    const conferenceMap = buildConferenceNameLookup(conferences ?? []);
    const teamMap = ensureTeamMap(teams ?? []);
    const groups = new Map();
    for (const teamRecord of teamMap.values()) {
        const conferenceId = teamRecord.conference_id ?? null;
        const conferenceName = resolveConferenceName(conferenceId, conferenceMap);
        const groupKey = `${conferenceId ?? "independent"}`;
        if (!groups.has(groupKey)) {
            groups.set(groupKey, {
                id: conferenceId,
                name: conferenceName,
                teams: [],
                totalPlayers: null,
            });
        }
        const fullName = normaliseName(teamRecord.full_name ?? teamRecord.name);
        const shortName = normaliseName(teamRecord.name ?? teamRecord.full_name ?? fullName);
        const abbreviation = teamRecord.abbreviation?.trim() ?? null;
        const teamRoster = {
            id: teamRecord.id,
            name: shortName,
            fullName,
            abbreviation,
            college: teamRecord.college?.trim() ?? null,
            conferenceId,
            conferenceName,
        };
        groups.get(groupKey).teams.push(teamRoster);
    }
    const orderedGroups = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    orderedGroups.forEach((group) => {
        group.teams.sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" }));
    });
    const totalTeams = orderedGroups.reduce((sum, group) => sum + group.teams.length, 0);
    return {
        season,
        conferences: orderedGroups.map((group) => ({
            id: group.id,
            name: group.name,
            totalPlayers: group.totalPlayers,
            teams: group.teams.map((team) => ({
                id: team.id,
                name: team.name,
                fullName: team.fullName,
                abbreviation: team.abbreviation,
                college: team.college,
                conferenceId: team.conferenceId,
                conferenceName: team.conferenceName,
            })),
        })),
        totals: {
            players: null,
            teams: totalTeams,
        },
    };
}
export async function loadTeamRosterPlayers(team, seasonLabel) {
    const season = seasonLabel ?? (await getActiveRosterSeason());
    const cacheKey = getTeamRosterCacheKey(team.id, season);
    if (!teamRosterCache.has(cacheKey)) {
        const load = fetchTeamRosterPlayers(team, season).catch((error) => {
            teamRosterCache.delete(cacheKey);
            throw error;
        });
        teamRosterCache.set(cacheKey, load);
    }
    return await teamRosterCache.get(cacheKey);
}
