// -----------------------------------------------------------------------------
// Talking to a TV: show a notification (one HTTP request to its app), check
// that its app answers (one TCP connection, nothing shown).
// -----------------------------------------------------------------------------

import { request, tcpProbe } from './http.js';
import { encodeNotification } from './notification.js';

// A notification with a picture of a few hundred kilobytes, over Wi-Fi, to a
// TV stick: a few seconds at worst.
export const SEND_TIMEOUT_MS = 8000;
export const PROBE_TIMEOUT_MS = 2000;

export class SendError extends Error {
  /** @param {string} code `unreachable` (no answer) or `refused` (HTTP error) */
  constructor(code, message, status = null) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** Base URL of a TV's app. */
export const baseUrl = (tv) => `http://${tv.address}:${tv.port}`;

/**
 * @param {object} [seams] test seams: `request` (src/http.js), `probe` (address, port) => boolean
 */
export function createClient({ request: send = request, probe = tcpProbe } = {}) {
  return {
    /**
     * Shows a notification on a TV.
     * @param {object} tv see src/tvs.js
     * @param {object} notification from normalizeNotification
     * @param {{ data: Buffer, type: string } | null} image
     * @throws {SendError}
     */
    async send(tv, notification, image = null) {
      const { method, path, headers, body } = encodeNotification(tv.app, notification, image);
      let response;
      try {
        response = await send(`${baseUrl(tv)}${path}`, {
          method,
          headers,
          body,
          timeoutMs: SEND_TIMEOUT_MS,
          maxBytes: 64 * 1024,
        });
      } catch (err) {
        throw new SendError('unreachable', err.message);
      }
      if (response.status < 200 || response.status >= 300) {
        throw new SendError('refused', `HTTP ${response.status}`, response.status);
      }
    },

    /** True when the app of the TV accepts a connection. */
    reachable(tv) {
      return probe(tv.address, tv.port, PROBE_TIMEOUT_MS);
    },
  };
}
