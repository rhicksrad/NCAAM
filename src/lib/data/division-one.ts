import { buildProgramLabelKeys } from "./program-keys.js";
import { requireOk } from "../health.js";

type DivisionOneProgramIndex = {
  programs: readonly string[];
  keys: Set<string>;
};

const DIVISION_ONE_PROGRAMS_URL = new URL(
  "../../../data/division-one-programs.json",
  import.meta.url,
).toString();

let divisionOnePromise: Promise<DivisionOneProgramIndex> | null = null;

async function fetchDivisionOnePrograms(): Promise<string[]> {
  const response = await requireOk(DIVISION_ONE_PROGRAMS_URL, "Division I directory", {
    headers: { Accept: "application/json" },
  });
  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error("Division I directory is malformed");
  }
  return payload.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function buildDivisionOneIndex(programs: readonly string[]): DivisionOneProgramIndex {
  const keys = new Set<string>();
  for (const label of programs) {
    for (const key of buildProgramLabelKeys(label)) {
      keys.add(key);
    }
  }
  return { programs, keys };
}

export async function getDivisionOneProgramIndex(): Promise<DivisionOneProgramIndex> {
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

export function isDivisionOneProgram(
  label: string | null | undefined,
  index: DivisionOneProgramIndex,
): boolean {
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

export function filterDivisionOneRecords<T>(
  records: readonly T[],
  getLabel: (record: T) => string | null | undefined,
  index: DivisionOneProgramIndex,
): T[] {
  return records.filter(record => isDivisionOneProgram(getLabel(record), index));
}

export type { DivisionOneProgramIndex };
