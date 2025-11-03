const PROGRAM_LABEL_TRANSFORMS = [
    value => value.replace(/\u2013/g, "-"),
    value => value.replace(/&/g, " and "),
    value => value.replace(/\bA\s*&\s*M\b/gi, "A and M"),
    value => value.replace(/\bU\.?\b/gi, "University"),
    value => value.replace(/\bUniv\.?\b/gi, "University"),
    value => value.replace(/\bIntl\.?\b/gi, "International"),
    value => value.replace(/\bInt\.?\b/gi, "International"),
    value => value.replace(/\bMt\.?\b/gi, "Mount"),
    value => value.replace(/\bCal St\.?\b/gi, "California State"),
    value => value.replace(/\bApp St\b/gi, "Appalachian State"),
    value => value.replace(/\bGa\.?\b/gi, "Georgia"),
    value => value.replace(/\bN\.?\b/gi, "North"),
    value => value.replace(/\bS\.?\b/gi, "South"),
    value => value.replace(/\bE\.?\b/gi, "East"),
    value => value.replace(/\bW\.?\b/gi, "West"),
    value => value.replace(/\bSt\.?\b/gi, "State"),
    value => value.replace(/\bSt\.?\b/gi, "Saint"),
    value => value.replace(/\s+/g, " "),
];
function normalizeProgramLabel(value) {
    return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-z0-9]+/g, "");
}
export function buildProgramLabelKeys(label) {
    if (!label) {
        return [];
    }
    const queue = [label];
    const seen = new Set();
    for (let i = 0; i < queue.length; i += 1) {
        const value = queue[i];
        if (seen.has(value)) {
            continue;
        }
        seen.add(value);
        for (const transform of PROGRAM_LABEL_TRANSFORMS) {
            const next = transform(value);
            if (!seen.has(next)) {
                queue.push(next);
            }
        }
    }
    const keys = new Set();
    for (const value of seen) {
        const normalized = normalizeProgramLabel(value);
        if (normalized) {
            keys.add(normalized);
        }
    }
    return Array.from(keys);
}
function deriveSchoolName(team) {
    const { full_name, name } = team;
    if (!full_name) {
        return team.college ?? undefined;
    }
    if (name && full_name.toLowerCase().endsWith(name.toLowerCase())) {
        const base = full_name.slice(0, full_name.length - name.length).trim();
        if (base) {
            return base;
        }
    }
    return team.college ?? full_name;
}
const TEAM_VALUE_TRANSFORMS = [
    value => value,
    value => value.replace(/\u2013/g, "-"),
    value => value.replace(/\bState University\b/gi, "State"),
    value => value.replace(/\bUniversity of\s+/gi, ""),
    value => value.replace(/\bMen's\s+/gi, ""),
];
export function buildTeamKeys(team) {
    const baseLabels = new Set();
    if (team.college) {
        baseLabels.add(team.college);
    }
    const school = deriveSchoolName(team);
    if (school) {
        baseLabels.add(school);
    }
    if (team.full_name) {
        baseLabels.add(team.full_name);
        baseLabels.add(team.full_name.replace(/\bmen's\s+/i, ""));
    }
    if (team.name) {
        baseLabels.add(team.name);
    }
    const keys = new Set();
    for (const raw of baseLabels) {
        if (!raw) {
            continue;
        }
        const trimmed = raw.trim();
        if (!trimmed) {
            continue;
        }
        for (const transform of TEAM_VALUE_TRANSFORMS) {
            const variant = transform(trimmed);
            for (const key of buildProgramLabelKeys(variant)) {
                keys.add(key);
            }
        }
    }
    return Array.from(keys);
}
export { normalizeProgramLabel };
