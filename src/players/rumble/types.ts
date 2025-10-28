import type { EraStyle } from "./era";

export type Archetype =
  | "Creator"
  | "Secondary"
  | "Off-ball Shooter"
  | "Rim Runner"
  | "Stretch Big"
  | "Switch Big"
  | "POA Stopper"
  | "Rim Protector"
  | "Connector";

export interface Player {
  id: string;
  name: string;
  era: string | null;
  pos: string | null;
  franchise?: string | null;
  threeP: number;
  threePA_rate: number;
  astPct: number;
  usg: number;
  stl: number;
  blk: number;
  paceZ: number;
  impact: number;
  archetypes: Archetype[];
}

export interface ChemistryEdge {
  source: string;
  target: string;
  weight: number;
  reasons: string[];
}

export interface Team {
  id: "A" | "B";
  name: string;
  slots: Array<Player | null>;
}

export interface TeamChemistry {
  score: number;
  edges: ChemistryEdge[];
  reasons: string[];
}

export interface MatchupAdjustment {
  advantageA: number;
  advantageB: number;
  reasonsA: string[];
  reasonsB: string[];
}

export interface SimResult {
  teamAWins: number;
  teamBWins: number;
  avgScoreA: number;
  avgScoreB: number;
  margins: number[];
}

export interface MatchupState {
  a: string[];
  b: string[];
  style: EraStyle;
  /**
   * Legacy flag preserved for backwards compatibility with older URLs.
   * When present, `true` indicates that era normalization was enabled.
   */
  eraNorm?: boolean;
}

export interface PlayerPoolFilters {
  era?: string;
  franchise?: string;
  archetype?: Archetype | "";
  query?: string;
}

export interface LaunchOptions {
  root: HTMLElement;
  getPlayerPool(): Promise<Player[]>;
  presets?: Record<string, string[]>;
  mode?: "overlay" | "inline";
}
