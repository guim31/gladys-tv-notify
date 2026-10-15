// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
//
// Select values are strings in the manifest (stored by Gladys as typed); the
// normalized config holds numbers, in seconds.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Seconds between two reachability checks of every TV. The scheduler runs in
// the container (devices are published with should_poll: false): one TCP
// connection per TV and per check, nothing shown on the screen.
export const CHECK_INTERVALS = ['15', '30', '60', '120', '300'];

// Seconds without any answer before a TV is declared unreachable; 0 = at the
// first failed check. A TV on Wi-Fi sometimes misses one check.
export const OFFLINE_DELAYS = ['0', '30', '60', '120', '300'];

export const DEFAULT_CONFIG = {
  language: 'fr',
  check_interval: '30',
  offline_after: '60',
};

const pick = (value, allowed, fallback) =>
  allowed.includes(String(value)) ? Number(value) : Number(fallback);

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
    checkInterval: pick(source.check_interval, CHECK_INTERVALS, DEFAULT_CONFIG.check_interval),
    offlineAfter: pick(source.offline_after, OFFLINE_DELAYS, DEFAULT_CONFIG.offline_after),
  };
}
