import { NCAAM } from "./ncaam.js";
let conferencesPromise = null;
export async function getConferenceMap() {
    if (!conferencesPromise) {
        conferencesPromise = NCAAM.conferences()
            .then(({ data }) => {
            const map = new Map();
            for (const conference of data) {
                map.set(conference.id, conference);
            }
            return map;
        })
            .catch(error => {
            conferencesPromise = null;
            throw error;
        });
    }
    return conferencesPromise;
}
export async function getConferenceName(id, opts = {}) {
    if (id == null)
        return undefined;
    const map = await getConferenceMap();
    const conference = map.get(id);
    if (!conference)
        return undefined;
    return opts.short ? conference.short_name ?? conference.name : conference.name;
}
export function clearConferenceCache() {
    conferencesPromise = null;
}
