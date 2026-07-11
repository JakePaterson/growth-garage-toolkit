import { resolve } from 'path';

/**
 * Root directory of the knowledge base vault. Defaults to the current
 * working directory so `kb` works out of the box when run from inside a
 * vault; override with the KB_ROOT env var to point at a vault elsewhere.
 */
export const KB_ROOT = process.env.KB_ROOT ? resolve(process.env.KB_ROOT) : process.cwd();

/** Default reverify windows in days, keyed by category directory name. */
export const FRESHNESS_DEFAULTS: Record<string, number> = {
  apis: 30,
  services: 30,
  domain: 45,
  frameworks: 90,
  architecture: 90,
  _business: 90,
  patterns: 180,
  decisions: 365,
};

/** Fallback reverify window when category is unknown. */
export const FRESHNESS_DEFAULT_FALLBACK = 45;

/**
 * Parses a `reverify_after` value ("30d" -> 30, "never" -> null meaning "skip
 * freshness entirely"). Returns undefined when unset, so callers can fall back
 * to a category default.
 */
export function parseReverifyAfter(value: string | undefined): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === 'never') return null;
  const days = parseInt(value, 10);
  return Number.isNaN(days) ? undefined : days;
}
