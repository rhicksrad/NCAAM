import { NCAAM, type Conference } from "./ncaam.js";

export type ConferenceMap = Map<number, Conference>;

let conferencesPromise: Promise<ConferenceMap> | null = null;

export async function getConferenceMap(): Promise<ConferenceMap> {
  if (!conferencesPromise) {
    conferencesPromise = NCAAM.conferences()
      .then(({ data }) => {
        const map: ConferenceMap = new Map();
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

export async function getConferenceName(
  id: number | null | undefined,
  opts: { short?: boolean } = {}
): Promise<string | undefined> {
  if (id == null) return undefined;
  const map = await getConferenceMap();
  const conference = map.get(id);
  if (!conference) return undefined;
  return opts.short ? conference.short_name ?? conference.name : conference.name;
}

export function clearConferenceCache(): void {
  conferencesPromise = null;
}
