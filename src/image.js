// -----------------------------------------------------------------------------
// The picture of a notification: downloaded by the container from a URL the
// scene author gives (a camera's snapshot URL, a Frigate `latest.jpg`…), then
// sent to the TV with the notification.
//
// The integration cannot read a Gladys camera device: the host API only serves
// the integration's own devices. A camera that Gladys shows usually has an
// HTTP snapshot URL of its own, which is what this downloads.
//
// Credentials may be written in the URL (`http://user:password@camera/…`):
// they are taken out of it and answered to the camera's challenge (Basic or
// Digest). They are never logged (see redactUrl).
// -----------------------------------------------------------------------------

import { authorization, parseChallenge } from './digest.js';
import { HttpError, request } from './http.js';

export const IMAGE_TIMEOUT_MS = 6000;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export class ImageError extends Error {
  /** @param {string} code a key of IMAGE_ERRORS (src/messages.js) */
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** The image type of a buffer, from its first bytes, or null. */
export function sniffImageType(data) {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'image/jpeg';
  }
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    return 'image/png';
  }
  if (data.length >= 6 && /^GIF8[79]a$/.test(data.subarray(0, 6).toString('latin1'))) {
    return 'image/gif';
  }
  if (
    data.length >= 12 &&
    data.subarray(0, 4).toString('latin1') === 'RIFF' &&
    data.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

/** The challenges of a 401 answer, one per WWW-Authenticate header. */
function challenges(response) {
  const raw = response.rawHeaders ?? [];
  const found = [];
  for (let index = 0; index < raw.length; index += 2) {
    if (raw[index].toLowerCase() === 'www-authenticate') {
      found.push(raw[index + 1]);
    }
  }
  return found;
}

/**
 * Splits the credentials out of a URL typed by the user.
 * @returns {{ url: URL, username: string, password: string } | null}
 */
export function parseImageUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return null;
  }
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    return null;
  }
  const username = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  url.username = '';
  url.password = '';
  return { url, username, password };
}

/**
 * Downloads an image.
 * @param {string} rawUrl
 * @param {object} [options]
 * @param {Function} [options.request] see src/http.js
 * @returns {Promise<{ data: Buffer, type: string }>}
 * @throws {ImageError}
 */
export async function fetchImage(rawUrl, { request: send = request } = {}) {
  const parsed = parseImageUrl(rawUrl);
  if (!parsed) {
    throw new ImageError('url', 'not an http(s) URL');
  }
  const { url, username, password } = parsed;
  const get = (headers = {}) =>
    send(url, {
      headers: { Accept: 'image/*', ...headers },
      timeoutMs: IMAGE_TIMEOUT_MS,
      maxBytes: MAX_IMAGE_BYTES,
    });

  let response;
  try {
    response = await get();
    if (response.status === 401 && (username || password)) {
      const offered = challenges(response);
      const digest = offered.map(parseChallenge).find(Boolean);
      const header = digest
        ? authorization({
            challenge: digest,
            username,
            password,
            method: 'GET',
            uri: `${url.pathname}${url.search}`,
            nc: 1,
          })
        : `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
      response = await get({ Authorization: header });
    }
  } catch (err) {
    if (err instanceof HttpError && err.code === 'TOO_LARGE') {
      throw new ImageError('tooLarge', err.message);
    }
    throw new ImageError('unreachable', err.message);
  }
  if (response.status === 401 || response.status === 403) {
    throw new ImageError('auth', `HTTP ${response.status}`);
  }
  if (response.status < 200 || response.status >= 300) {
    throw new ImageError('status', `HTTP ${response.status}`);
  }
  // The bytes decide: cameras label their JPEG as text/plain or octet-stream.
  const type = sniffImageType(response.body);
  if (!type) {
    throw new ImageError('type', `not an image (${response.headers['content-type'] ?? '?'})`);
  }
  return { data: response.body, type };
}
