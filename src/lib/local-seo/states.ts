import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/lib/content/paths";

export interface StateInfo {
  code: string;
  name: string;
  ibgeCode: string;
}

export interface LocalityInfo {
  id: string;
  name: string;
  localityType:
    | "country"
    | "state"
    | "municipality"
    | "district"
    | "neighborhood"
    | "region";
  stateCode: string;
  citySlug?: string;
  districtSlug?: string;
  municipalitiesInvolved?: string[];
  ibgeCode?: string;
}

let statesCache: StateInfo[] | null = null;
let localitiesCache: LocalityInfo[] | null = null;

export function getStates(): StateInfo[] {
  if (statesCache) return statesCache;
  statesCache = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "states.json"), "utf8"),
  ) as StateInfo[];
  return statesCache;
}

export function getStateByCode(code: string): StateInfo | undefined {
  return getStates().find((s) => s.code === code.toLowerCase());
}

export function isStateCode(value: string): boolean {
  return getStateByCode(value) !== undefined;
}

export function getLocalities(): LocalityInfo[] {
  if (localitiesCache) return localitiesCache;
  const data = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "localities.json"), "utf8"),
  ) as { localities: LocalityInfo[] };
  localitiesCache = data.localities;
  return localitiesCache;
}
