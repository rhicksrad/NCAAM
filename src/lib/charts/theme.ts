/**
 * Chart theme tokens and helpers.
 * @module charts/theme
 */

import { format as d3Format } from "../vendor/d3-bundle.js";

/** Array of categorical color tokens. */
const DEFAULT_CATEGORICAL = [
  "#0d3b66",
  "#ef8354",
  "#2a9d8f",
  "#8ab17d",
  "#f4d35e",
  "#e36414",
  "#4f5d75",
  "#9a031e",
  "#577590",
  "#bc4749",
  "#3a86ff",
  "#8338ec"
] as const;

/** Sequential cool palette (light to dark). */
const DEFAULT_SEQUENTIAL_COOL = [
  "#d9ed92",
  "#99d98c",
  "#52b69a",
  "#168aad",
  "#1a759f",
  "#1e6091"
] as const;

/** Sequential warm palette (light to dark). */
const DEFAULT_SEQUENTIAL_WARM = [
  "#ffe5d9",
  "#ffc9b9",
  "#ffb4a2",
  "#e5989b",
  "#b5838d",
  "#6d597a"
] as const;

/** Theme token contract. */
export interface ChartTheme {
  fontFamily: string;
  fontSize: number;
  lineWidth: number;
  gridWidth: number;
  fg: string;
  fgMuted: string;
  bg: string;
  grid: string;
  accent: string;
  accentMuted: string;
  categorical: readonly string[];
  sequential: {
    cool: readonly string[];
    warm: readonly string[];
  };
}

/** Base theme tokens aligned with CSS variables. */
export const defaultTheme: ChartTheme = {
  fontFamily:
    "var(--chart-font-family, 'Inter', 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif)",
  fontSize: 13,
  lineWidth: 1.5,
  gridWidth: 1,
  fg: "var(--chart-fg, #102a43)",
  fgMuted: "var(--chart-fg-muted, #486581)",
  bg: "var(--chart-bg, #ffffff)",
  grid: "var(--chart-grid, #d9e2ec)",
  accent: "var(--chart-accent, #1b998b)",
  accentMuted: "var(--chart-accent-muted, #cde1de)",
  categorical: DEFAULT_CATEGORICAL,
  sequential: {
    cool: DEFAULT_SEQUENTIAL_COOL,
    warm: DEFAULT_SEQUENTIAL_WARM
  }
};

/** Dark mode tokens. */
export const darkTheme: ChartTheme = {
  fontFamily: defaultTheme.fontFamily,
  fontSize: 13,
  lineWidth: 1.5,
  gridWidth: 1,
  fg: "var(--chart-fg-dark, #f0f4f8)",
  fgMuted: "var(--chart-fg-muted-dark, #9fb3c8)",
  bg: "var(--chart-bg-dark, #0b1f2a)",
  grid: "var(--chart-grid-dark, #1f3a52)",
  accent: "var(--chart-accent-dark, #4ecdc4)",
  accentMuted: "var(--chart-accent-muted-dark, #1f3a52)",
  categorical: [
    "#4ecdc4",
    "#ff6b6b",
    "#ffe66d",
    "#1a535c",
    "#5f0f40",
    "#9a031e",
    "#fb8b24",
    "#4361ee",
    "#ffd60a",
    "#adb5bd",
    "#00b4d8",
    "#a2d2ff"
  ],
  sequential: {
    cool: [
      "#0b7285",
      "#0c8599",
      "#0ca678",
      "#099268",
      "#2b8a3e",
      "#37b24d"
    ],
    warm: [
      "#862e9c",
      "#b5179e",
      "#e5383b",
      "#ff6b6b",
      "#ff922b",
      "#ffd43b"
    ]
  }
};

/** Theme application options. */
export interface ApplyThemeOptions {
  theme?: ChartTheme;
}

const THEME_VARIABLES: Record<string, (theme: ChartTheme) => string> = {
  "--chart-font-family": (theme) => theme.fontFamily,
  "--chart-font-size": (theme) => String(theme.fontSize),
  "--chart-line-width": (theme) => String(theme.lineWidth),
  "--chart-grid-width": (theme) => String(theme.gridWidth),
  "--chart-fg": (theme) => theme.fg,
  "--chart-fg-muted": (theme) => theme.fgMuted,
  "--chart-bg": (theme) => theme.bg,
  "--chart-grid": (theme) => theme.grid,
  "--chart-accent": (theme) => theme.accent,
  "--chart-accent-muted": (theme) => theme.accentMuted
};

/**
 * Apply CSS custom properties for the provided theme to a DOM element.
 *
 * @param root - Root element receiving CSS custom properties.
 * @param theme - Theme tokens; defaults to {@link defaultTheme}.
 */
export function applyTheme(root: Element, theme: ChartTheme = defaultTheme): void {
  if (!(root instanceof HTMLElement)) {
    throw new TypeError("applyTheme expects an HTMLElement root");
  }
  const style = root.style;
  Object.entries(THEME_VARIABLES).forEach(([name, accessor]) => {
    style.setProperty(name, accessor(theme));
  });
  theme.categorical.forEach((value, index) => {
    style.setProperty(`--chart-categorical-${index}`, value);
  });
  theme.sequential.cool.forEach((value, index) => {
    style.setProperty(`--chart-sequential-cool-${index}`, value);
  });
  theme.sequential.warm.forEach((value, index) => {
    style.setProperty(`--chart-sequential-warm-${index}`, value);
  });
}

/** Options for resolveColor. */
export interface ResolveColorOptions {
  theme?: ChartTheme;
  palette?: "categorical" | "cool" | "warm";
}

/**
 * Resolve a color token from the theme palettes.
 *
 * @param index - Desired index in the palette.
 * @param options - Palette configuration.
 */
export function resolveColor(
  index: number,
  options: ResolveColorOptions = {}
): string {
  const theme = options.theme ?? defaultTheme;
  const palette = options.palette ?? "categorical";
  const values =
    palette === "categorical"
      ? theme.categorical
      : theme.sequential[palette];
  if (!values.length) {
    return theme.accent;
  }
  const normalized = ((index % values.length) + values.length) % values.length;
  return values[normalized];
}

/** Number formatting options. */
export interface FormatNumberOptions {
  style?: "default" | "percent";
  digits?: number;
}

/**
 * Format numbers for chart ticks and labels with compact notation.
 *
 * @param value - Numeric value to format.
 * @param options - Formatting configuration.
 */
export function formatNumber(
  value: number,
  options: FormatNumberOptions = {}
): string {
  if (!Number.isFinite(value)) return "";
  const { style = "default", digits = 1 } = options;
  if (style === "percent") {
    const formatter = d3Format(`.${digits}~%`);
    return formatter(value);
  }
  const abs = Math.abs(value);
  if (abs >= 1000) {
    const precision = Math.max(1, digits + 1);
    const formatter = d3Format(`.${precision}s`);
    return formatter(value).replace("G", "B");
  }
  const formatter = d3Format(`.${Math.max(0, digits)}f`);
  return formatter(value);
}

/** Date formatting options. */
export interface FormatDateOptions {
  locale?: string;
  month?: "numeric" | "short" | "long";
  day?: "numeric" | "2-digit";
  year?: "numeric" | "2-digit";
}

/**
 * Format dates for axes and tooltips. Falls back to ISO strings in Node.
 *
 * @param value - Date to format.
 * @param options - Formatting configuration.
 */
export function formatDate(
  value: Date,
  options: FormatDateOptions = {}
): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return "";
  }
  const { locale, month = "short", day = "numeric", year = "numeric" } = options;
  if (typeof Intl !== "undefined" && typeof Intl.DateTimeFormat === "function") {
    const formatter = new Intl.DateTimeFormat(locale ?? undefined, {
      month,
      day,
      year
    });
    return formatter.format(value);
  }
  return value.toISOString();
}

/**
 * Determine the ideal foreground color (black/white) given a background.
 *
 * @param bg - Background color in hex, rgb, or CSS variable format.
 */
export function chooseTextColor(bg: string): "black" | "white" {
  const rgb = parseColor(bg);
  if (!rgb) return "white";
  const luminance = getRelativeLuminance(rgb);
  return luminance > 0.5 ? "black" : "white";
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

function parseColor(input: string): RGB | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (trimmed.startsWith("var(")) {
    return null;
  }
  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return { r, g, b };
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return { r, g, b };
    }
    return null;
  }
  const match = trimmed.match(/rgb\(([^)]+)\)/i);
  if (match) {
    const parts = match[1]
      .split(",")
      .map((part) => Number.parseFloat(part.trim()))
      .filter((n) => !Number.isNaN(n));
    if (parts.length >= 3) {
      return { r: parts[0], g: parts[1], b: parts[2] };
    }
  }
  return null;
}

function getRelativeLuminance({ r, g, b }: RGB): number {
  const srgb = [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}
