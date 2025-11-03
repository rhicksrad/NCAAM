import { buildProgramLabelKeys } from "./program-keys.js";
const DIVISION_ONE_PROGRAMS_URL = new URL("../../data/division-one-programs.json", import.meta.url).toString();
let divisionOnePromise = null;
async function fetchDivisionOnePrograms() {
    const response = await fetch(DIVISION_ONE_PROGRAMS_URL, {
        headers: { Accept: "application/json" },
    });
    if (!response.ok) {
        throw new Error(`Failed to load Division I directory (${response.status})`);
    }
    const payload = (await response.json());
    if (!Array.isArray(payload)) {
        throw new Error("Division I directory is malformed");
    }
    return payload.filter((value) => typeof value === "string" && value.trim().length > 0);
}
function buildDivisionOneIndex(programs) {
    const keys = new Set();
    for (const label of programs) {
        for (const key of buildProgramLabelKeys(label)) {
            keys.add(key);
        }
    }
    return { programs, keys };
}
export async function getDivisionOneProgramIndex() {
    if (!divisionOnePromise) {
        divisionOnePromise = fetchDivisionOnePrograms()
            .then(buildDivisionOneIndex)
            .catch(error => {
            divisionOnePromise = null;
            throw error;
        });
    }
    return divisionOnePromise;
}
export function isDivisionOneProgram(label, index) {
    if (!label) {
        return false;
    }
    const keys = buildProgramLabelKeys(label);
    for (const key of keys) {
        if (index.keys.has(key)) {
            return true;
        }
    }
    return false;
}
export function filterDivisionOneRecords(records, getLabel, index) {
    return records.filter(record => isDivisionOneProgram(getLabel(record), index));
}
