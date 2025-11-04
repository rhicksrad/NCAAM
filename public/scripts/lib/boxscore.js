function createEmptyPlayer(identity, order) {
    return {
        ...identity,
        starter: false,
        order,
        seconds: 0,
        minutes: null,
        fgm: 0,
        fga: 0,
        tpm: 0,
        tpa: 0,
        ftm: 0,
        fta: 0,
        oreb: 0,
        dreb: 0,
        reb: 0,
        ast: 0,
        stl: 0,
        blk: 0,
        tov: 0,
        pf: 0,
        pts: 0,
    };
}
function createEmptyTotals() {
    return {
        seconds: 0,
        minutes: null,
        fgm: 0,
        fga: 0,
        tpm: 0,
        tpa: 0,
        ftm: 0,
        fta: 0,
        oreb: 0,
        dreb: 0,
        reb: 0,
        ast: 0,
        stl: 0,
        blk: 0,
        tov: 0,
        pf: 0,
        pts: 0,
    };
}
function normalizeLabel(value) {
    if (!value) {
        return "";
    }
    return value
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
        .toLowerCase();
}
function normalizeDescription(value) {
    if (!value) {
        return "";
    }
    return value.replace(/\s+/g, " ").trim();
}
function cleanupName(name) {
    if (!name) {
        return null;
    }
    const cleaned = name.replace(/\.+$/, "").replace(/\s+/g, " ").trim();
    return cleaned.length > 0 ? cleaned : null;
}
function deriveTeamFromPlayTeam(team, fallbackId) {
    if (!team) {
        return null;
    }
    const idCandidate = typeof team.id === "number" && Number.isFinite(team.id) ? team.id : null;
    const fallback = typeof fallbackId === "number" && Number.isFinite(fallbackId) ? fallbackId : null;
    const id = idCandidate ?? fallback ?? 0;
    const fullName = team.fullName ?? team.name ?? team.abbreviation ?? `Team ${id}`;
    const name = team.name ?? team.fullName ?? team.abbreviation ?? fullName;
    return {
        id,
        full_name: fullName,
        name,
        abbreviation: team.abbreviation ?? undefined,
    };
}
function createTeam(team, teamId) {
    return {
        teamId,
        team: team ?? null,
        players: new Map(),
        orderCounter: 0,
        nextPlayerId: 0,
        totals: createEmptyTotals(),
    };
}
function ensureTeam(state, teamId, fallbackTeam, playTeam) {
    const key = Number.isFinite(teamId) ? teamId : null;
    let entry = state.get(key);
    if (!entry) {
        const derived = fallbackTeam ?? deriveTeamFromPlayTeam(playTeam, key);
        entry = createTeam(derived, key);
        state.set(key, entry);
    }
    else if (!entry.team && (fallbackTeam || playTeam)) {
        entry.team = fallbackTeam ?? deriveTeamFromPlayTeam(playTeam, key);
    }
    return entry;
}
function isLikelyTeamLabel(name, team, playTeam) {
    if (!name) {
        return false;
    }
    const normalizedName = normalizeLabel(name);
    if (!normalizedName) {
        return false;
    }
    const candidates = [
        team?.full_name,
        team?.name,
        team?.abbreviation,
        team?.college,
        playTeam?.fullName,
        playTeam?.name,
        playTeam?.abbreviation,
    ];
    return candidates.some(candidate => normalizeLabel(candidate) === normalizedName);
}
function ensurePlayer(teamState, name, playTeam) {
    const cleaned = cleanupName(name);
    if (!cleaned) {
        return null;
    }
    if (isLikelyTeamLabel(cleaned, teamState.team, playTeam)) {
        return null;
    }
    const key = normalizeLabel(cleaned);
    if (!key) {
        return null;
    }
    let player = teamState.players.get(key);
    if (player) {
        return player;
    }
    const parts = cleaned.split(" ");
    const firstName = parts[0] ?? null;
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;
    const identity = {
        playerId: ++teamState.nextPlayerId,
        teamId: teamState.teamId,
        firstName,
        lastName,
        fullName: cleaned,
    };
    const order = ++teamState.orderCounter;
    player = createEmptyPlayer(identity, order);
    if (teamState.players.size < 5) {
        player.starter = true;
    }
    teamState.players.set(key, player);
    return player;
}
function applyStat(stat, value, player, team) {
    if (!Number.isFinite(value) || value === 0) {
        return;
    }
    if (player) {
        player[stat] += value;
    }
    team.totals[stat] += value;
}
function updateReboundTotals(player, team) {
    if (player) {
        player.reb = player.oreb + player.dreb;
    }
    team.totals.reb = team.totals.oreb + team.totals.dreb;
}
function extractShotShooter(description) {
    const match = description.match(/^(?<name>.+?)\s+(?:made|missed)\b/i);
    return cleanupName(match?.groups?.name);
}
function extractAssistName(description) {
    const match = description.match(/Assisted by ([^.]+)/i);
    return cleanupName(match?.[1]);
}
function extractRebounder(description) {
    const match = description.match(/^(?<name>.+?)\s+(?:Offensive|Defensive) Rebound/i);
    return cleanupName(match?.groups?.name);
}
function extractStealer(description) {
    const match = description.match(/^(?<name>.+?)\s+Steal/i);
    return cleanupName(match?.groups?.name);
}
function extractBlocker(description) {
    const match = description.match(/^(?<name>.+?)\s+Block/i);
    return cleanupName(match?.groups?.name);
}
function extractFouler(description) {
    const match = description.match(/Foul on ([^.]+)/i);
    return cleanupName(match?.[1]);
}
function extractTurnover(description) {
    const match = description.match(/^(?<name>.+?)\s+Turnover/i);
    return cleanupName(match?.groups?.name);
}
function resolveShotValue(event, fallback) {
    if (typeof event.scoreValue === "number" && Number.isFinite(event.scoreValue)) {
        return event.scoreValue;
    }
    return fallback;
}
function recordFieldGoal(event, team) {
    const description = normalizeDescription(event.description);
    const shooter = ensurePlayer(team, extractShotShooter(description), event.team ?? null);
    applyStat("fga", 1, shooter, team);
    const isThreePoint = (event.scoreValue === 3) || /three point/i.test(description);
    if (isThreePoint) {
        applyStat("tpa", 1, shooter, team);
    }
    if (event.isScoringPlay) {
        applyStat("fgm", 1, shooter, team);
        if (isThreePoint) {
            applyStat("tpm", 1, shooter, team);
        }
        const points = resolveShotValue(event, isThreePoint ? 3 : 2);
        applyStat("pts", points, shooter, team);
    }
    const assistName = extractAssistName(description);
    if (assistName) {
        const assister = ensurePlayer(team, assistName, event.team ?? null);
        if (assister && assister !== shooter) {
            applyStat("ast", 1, assister, team);
        }
    }
}
function recordFreeThrow(event, team) {
    const description = normalizeDescription(event.description);
    const shooter = ensurePlayer(team, extractShotShooter(description), event.team ?? null);
    applyStat("fta", 1, shooter, team);
    if (event.isScoringPlay) {
        const points = resolveShotValue(event, 1);
        applyStat("ftm", 1, shooter, team);
        applyStat("pts", points, shooter, team);
    }
}
function recordRebound(event, team, offensive) {
    const description = normalizeDescription(event.description);
    const rebounder = ensurePlayer(team, extractRebounder(description), event.team ?? null);
    if (offensive) {
        applyStat("oreb", 1, rebounder, team);
    }
    else {
        applyStat("dreb", 1, rebounder, team);
    }
    updateReboundTotals(rebounder, team);
}
function recordTurnover(event, team) {
    const description = normalizeDescription(event.description);
    const culprit = ensurePlayer(team, extractTurnover(description), event.team ?? null);
    applyStat("tov", 1, culprit, team);
}
function recordSteal(event, team) {
    const description = normalizeDescription(event.description);
    const thief = ensurePlayer(team, extractStealer(description), event.team ?? null);
    if (thief) {
        applyStat("stl", 1, thief, team);
    }
}
function recordBlock(event, team) {
    const description = normalizeDescription(event.description);
    const blocker = ensurePlayer(team, extractBlocker(description), event.team ?? null);
    if (blocker) {
        applyStat("blk", 1, blocker, team);
    }
}
function recordFoul(event, team) {
    const description = normalizeDescription(event.description);
    const fouler = ensurePlayer(team, extractFouler(description), event.team ?? null);
    applyStat("pf", 1, fouler, team);
}
function finalizeTeam(team) {
    const players = Array.from(team.players.values());
    for (const player of players) {
        player.minutes = player.seconds > 0 ? player.seconds / 60 : null;
        player.reb = player.oreb + player.dreb;
    }
    team.totals.reb = team.totals.oreb + team.totals.dreb;
    team.totals.minutes = null;
    const sorted = players.sort((a, b) => {
        if (a.starter !== b.starter) {
            return a.starter ? -1 : 1;
        }
        if (b.pts !== a.pts) {
            return b.pts - a.pts;
        }
        return a.order - b.order;
    });
    const starters = sorted.filter(player => player.starter);
    const bench = sorted.filter(player => !player.starter);
    return {
        teamId: team.teamId,
        team: team.team ?? null,
        players: sorted,
        starters,
        bench,
        totals: team.totals,
    };
}
export function buildBoxScoreFromPlayByPlay({ game, events }) {
    const homeTeam = game.home_team ?? null;
    const awayTeam = game.visitor_team ?? null;
    const homeId = typeof homeTeam?.id === "number" && Number.isFinite(homeTeam.id) ? homeTeam.id : null;
    const awayId = typeof awayTeam?.id === "number" && Number.isFinite(awayTeam.id) ? awayTeam.id : null;
    const teamState = new Map();
    teamState.set(homeId, createTeam(homeTeam, homeId));
    teamState.set(awayId, createTeam(awayTeam, awayId));
    let processed = 0;
    for (const event of events) {
        processed += 1;
        const typeKey = (event.rawType ?? "").replace(/\s+/g, "").toLowerCase();
        const teamId = typeof event.teamId === "number" && Number.isFinite(event.teamId) ? event.teamId : null;
        const fallbackTeam = teamId === homeId ? homeTeam : teamId === awayId ? awayTeam : null;
        const playTeam = event.team ?? null;
        const withTeam = (handler) => {
            if (teamId === null && !fallbackTeam && !playTeam) {
                return;
            }
            const team = ensureTeam(teamState, teamId, fallbackTeam, playTeam);
            handler(team);
        };
        if (typeKey === "jumpshot" || typeKey === "layupshot" || typeKey === "dunkshot") {
            withTeam(team => recordFieldGoal(event, team));
            continue;
        }
        if (typeKey === "madefreethrow" || typeKey.endsWith("freethrow")) {
            withTeam(team => recordFreeThrow(event, team));
            continue;
        }
        if (typeKey === "defensiverebound") {
            withTeam(team => recordRebound(event, team, false));
            continue;
        }
        if (typeKey === "offensiverebound") {
            withTeam(team => recordRebound(event, team, true));
            continue;
        }
        if (typeKey === "lostballturnover" || typeKey.includes("turnover")) {
            withTeam(team => recordTurnover(event, team));
            continue;
        }
        if (typeKey === "steal" || typeKey.includes("steal")) {
            withTeam(team => recordSteal(event, team));
            continue;
        }
        if (typeKey === "blockshot" || typeKey.includes("block")) {
            withTeam(team => recordBlock(event, team));
            continue;
        }
        if (typeKey === "personalfoul" || typeKey.includes("foul")) {
            withTeam(team => recordFoul(event, team));
            continue;
        }
        if (typeKey.includes("rebound")) {
            const offensive = typeKey.includes("offensive");
            withTeam(team => recordRebound(event, team, offensive));
            continue;
        }
        if (typeKey.includes("shot")) {
            withTeam(team => recordFieldGoal(event, team));
        }
    }
    const homeBox = finalizeTeam(ensureTeam(teamState, homeId, homeTeam, null));
    const awayBox = finalizeTeam(ensureTeam(teamState, awayId, awayTeam, null));
    return {
        gameId: game.id,
        eventsProcessed: processed,
        home: homeBox,
        away: awayBox,
    };
}
