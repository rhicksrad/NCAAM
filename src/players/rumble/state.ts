import type { MatchupState } from "./types";
import { isEraStyle, type EraStyle } from "./era";

function toBase64(value: string): string {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return window.btoa(value);
  }
  return Buffer.from(value, "utf8").toString("base64");
}

function fromBase64(value: string): string {
  if (typeof window !== "undefined" && typeof window.atob === "function") {
    return window.atob(value);
  }
  return Buffer.from(value, "base64").toString("utf8");
}

function sanitizeIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) {
    return [];
  }
  return ids
    .map((id) => (typeof id === "string" || typeof id === "number" ? String(id) : null))
    .filter((id): id is string => Boolean(id && id.trim().length));
}

export function encodeMatchup(state: MatchupState): string {
  const style = resolveStyle(state.style, state.eraNorm);
  const payload: Record<string, unknown> = {
    a: sanitizeIds(state.a),
    b: sanitizeIds(state.b),
  };
  const includeStyle =
    Object.prototype.propertyIsEnumerable.call(state, "style") || (style !== "current" && style !== "nineties");
  if (includeStyle) {
    payload.style = style;
  }
  const eraNorm = typeof state.eraNorm === "boolean" ? state.eraNorm : style !== "current" ? true : undefined;
  if (typeof eraNorm === "boolean") {
    payload.eraNorm = eraNorm;
  }
  return toBase64(JSON.stringify(payload));
}

export function decodeMatchup(value: string | null | undefined): (MatchupState & { eraNorm?: boolean }) | null {
  if (!value) {
    return null;
  }
  try {
    const raw = JSON.parse(fromBase64(value));
    const legacyEraNorm = typeof raw?.eraNorm === "boolean" ? raw.eraNorm : undefined;
    const style = resolveStyle(raw?.style, legacyEraNorm);
    const eraNorm = typeof legacyEraNorm === "boolean" ? legacyEraNorm : style !== "current" ? true : undefined;
    const state: MatchupState = {
      a: sanitizeIds(raw?.a),
      b: sanitizeIds(raw?.b),
      style,
    };
    if (typeof eraNorm === "boolean") {
      state.eraNorm = eraNorm;
    }
    Object.defineProperty(state, "style", {
      value: style,
      enumerable: false,
      writable: true,
      configurable: true,
    });
    return state;
  } catch (error) {
    console.warn("Unable to decode rumble hash", error);
    return null;
  }
}

export function readHash(): MatchupState | null {
  const hash = window.location.hash.slice(1);
  if (!hash.startsWith("rumble=")) {
    return null;
  }
  const encoded = hash.slice("rumble=".length);
  return decodeMatchup(encoded);
}

export function writeHash(state: MatchupState): void {
  const encoded = encodeMatchup(state);
  const next = `#rumble=${encoded}`;
  if (window.location.hash === next) {
    return;
  }
  window.history.replaceState(
    {},
    "Roster Rumble",
    `${window.location.pathname}${window.location.search}${next}`
  );
}

function resolveStyle(style: unknown, legacyEraNorm: unknown): EraStyle {
  if (isEraStyle(style)) {
    return style;
  }
  if (typeof legacyEraNorm === "boolean" && legacyEraNorm) {
    return "nineties";
  }
  return "current";
}
