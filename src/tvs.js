// -----------------------------------------------------------------------------
// The TVs: validation of what the user types in the "Add a TV" action, and the
// identity of each TV.
//
// A TV is { id, name, address, app, port }. `id` is the platform id of its
// Gladys device (external id `tv:<id>`): random, given once, never changed
// whatever the user edits later (name, address, app). The notification apps
// expose no serial number or MAC over their HTTP API, so nothing better exists.
// -----------------------------------------------------------------------------

import { randomBytes } from 'node:crypto';
import { isIPv4 } from 'node:net';

export const MAX_TVS = 16;
export const MAX_NAME_LENGTH = 60;

// The receiving apps, with the port each one listens on by default. The keys
// are the option values of the "App" field: frozen once published.
export const APPS = {
  // "Notifications for Android TV" / "Notifications for Fire TV" (dream apps):
  // multipart form POST on /, the protocol of Home Assistant's nfandroidtv.
  nfandroidtv: { port: 7676, label: 'Notifications for Android TV / Fire TV' },
  // PiPup (rogro82): POST /notify, JSON or multipart form.
  pipup: { port: 7979, label: 'PiPup' },
  // TvOverlay (gugutab): POST /notify, JSON.
  tvoverlay: { port: 5001, label: 'TvOverlay' },
};
export const APP_KEYS = Object.keys(APPS);

// A DNS name: labels of letters, digits and hyphens.
const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;

/**
 * An IPv4 address or a host name typed by the user (a pasted URL is reduced
 * to its host), lower-cased; null when it is neither.
 */
export function normalizeAddress(raw) {
  if (typeof raw !== 'string') {
    return null;
  }
  const address = raw
    .trim()
    .replace(/^[a-z]+:\/\//i, '')
    .replace(/[/:].*$/, '')
    .toLowerCase();
  if (isIPv4(address)) {
    return address;
  }
  // Digits and dots only: a mistyped IP address, not a name.
  if (/^[\d.]+$/.test(address) || !HOSTNAME_PATTERN.test(address)) {
    return null;
  }
  return address;
}

// mDNS names (.local) do not resolve inside the container (bridge network).
export const isMdnsName = (address) => /\.local$/i.test(address);

/** Random platform id of a TV. */
export const newTvId = () => `t${randomBytes(5).toString('hex')}`;

const blank = (value) => value === undefined || value === null || String(value).trim() === '';

/**
 * Validate the fields of the "Add or update a TV" action. Every optional field
 * may be absent: an action applies no default (GladysAssistant/Gladys#3155).
 * @returns {{ tv?: object, error?: string, param?: string }} `error` is a key
 *   of ERRORS (src/messages.js), `param` the offending value.
 */
export function parseTvFields(fields = {}) {
  const name = typeof fields.name === 'string' ? fields.name.trim().replace(/\s+/g, ' ') : '';
  if (!name) {
    return { error: 'name' };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return { error: 'nameLength' };
  }
  const address = normalizeAddress(fields.address);
  if (!address) {
    return { error: 'address', param: String(fields.address ?? '') };
  }
  if (isMdnsName(address)) {
    return { error: 'mdns', param: address };
  }
  const app = APP_KEYS.includes(fields.app) ? fields.app : 'nfandroidtv';
  let port = APPS[app].port;
  if (!blank(fields.port)) {
    port = Number(fields.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return { error: 'port', param: String(fields.port) };
    }
  }
  return { tv: { name, address, app, port } };
}

/**
 * A TV read back from /data (or rebuilt from its Gladys device): same checks
 * as the action, the id kept. Null for an entry that cannot be used.
 */
export function restoreTv(entry) {
  if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !entry.id) {
    return null;
  }
  const { tv } = parseTvFields({
    name: entry.name,
    address: entry.address,
    app: entry.app,
    port: entry.port ?? undefined,
  });
  return tv ? { id: entry.id, ...tv } : null;
}

/** The TV matching a name or an address typed by the user, if any. */
export function findTv(tvs, query) {
  if (typeof query !== 'string' || !query.trim()) {
    return undefined;
  }
  const wanted = query.trim().toLowerCase();
  const address = normalizeAddress(query);
  return (
    tvs.find((tv) => tv.name.toLowerCase() === wanted) ??
    tvs.find((tv) => address && tv.address === address)
  );
}
