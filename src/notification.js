// -----------------------------------------------------------------------------
// A notification, from the fields of a scene action, a widget or a test, to
// the HTTP request each receiving app expects.
//
// The option values (positions, colors, transparencies, icons) are the values
// of the manifest selects: frozen once published, mapped here to each app.
//
// What each app does with them:
//   field          Notifications for Android TV   PiPup              TvOverlay
//   title/message  yes                            yes                yes
//   duration       yes                            yes                yes
//   position       5 positions                    5 positions        4 corners (no center)
//   color          9 colors                       9 colors           no (the app's layout)
//   transparency   yes                            yes                no
//   icon           yes (PNG sent)                 no                 yes (mdi:<name>)
//   image          yes (file)                     yes (file)         yes (base64)
//
// Protocols: Notifications for Android TV — multipart form on `/`, the fields
// of Home Assistant's nfandroidtv integration and of its library
// notifications-android-tv; PiPup — `POST /notify`, JSON or multipart with an
// `image` file (its README); TvOverlay — `POST /notify`, JSON (its README).
// -----------------------------------------------------------------------------

import { randomBytes } from 'node:crypto';
import { ICONS } from './icons.js';

export const POSITIONS = ['bottom_right', 'bottom_left', 'top_right', 'top_left', 'center'];
// The palette of Notifications for Android TV, written as Home Assistant sends it.
export const COLORS = {
  grey: '#607d8b',
  black: '#000000',
  indigo: '#303F9F',
  green: '#4CAF50',
  red: '#F44336',
  cyan: '#00BCD4',
  teal: '#009688',
  amber: '#FFC107',
  pink: '#E91E63',
};
export const TRANSPARENCIES = ['0', '25', '50', '75', '100'];
export const ICON_KEYS = ['none', ...Object.keys(ICONS)];

export const DURATION = { min: 1, max: 300, default: 10 };
export const DEFAULTS = {
  duration: DURATION.default,
  position: 'bottom_right',
  color: 'grey',
  transparency: '0',
  icon: 'none',
};
export const MAX_TITLE_LENGTH = 200;
export const MAX_MESSAGE_LENGTH = 2000;
// Shown when a notification has no title: the apps that need one display it.
export const DEFAULT_TITLE = 'Gladys';

// "Notifications for Android TV" requires an icon file: a transparent 1 x 1
// PNG when none is chosen (the default icon of notifications-android-tv).
const EMPTY_ICON = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGP6zwAAAgcBApocMXEAAAAASUVORK5CYII=',
  'base64',
);

export class NotificationError extends Error {
  /** @param {string} code a key of NOTIFY_ERRORS (src/messages.js) */
  constructor(code) {
    super(code);
    this.code = code;
  }
}

/** Text from a field: control characters dropped (line breaks kept), trimmed, capped. */
function cleanText(value, max) {
  if (value === undefined || value === null) {
    return '';
  }
  return (
    String(value)
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ')
      .trim()
      .slice(0, max)
  );
}

const pickOption = (value, allowed, fallback) =>
  allowed.includes(String(value)) ? String(value) : fallback;

/**
 * Normalizes the fields of the scene action (or of a widget, of a test). Every
 * field is optional but the message (or the title); an unknown option falls
 * back to its default, never an error: an old scene keeps working.
 * @returns {object} { title, message, duration, position, color, transparency, icon, imageUrl }
 * @throws {NotificationError} `empty` when there is nothing to show
 */
export function normalizeNotification(fields = {}) {
  const title = cleanText(fields.title, MAX_TITLE_LENGTH);
  const message = cleanText(fields.message, MAX_MESSAGE_LENGTH);
  if (!title && !message) {
    throw new NotificationError('empty');
  }
  const duration = Math.round(Number(fields.duration));
  const imageUrl = typeof fields.image_url === 'string' ? fields.image_url.trim() : '';
  return {
    title,
    message,
    duration: Number.isFinite(duration)
      ? Math.min(DURATION.max, Math.max(DURATION.min, duration))
      : DEFAULTS.duration,
    position: pickOption(fields.position, POSITIONS, DEFAULTS.position),
    color: pickOption(fields.color, Object.keys(COLORS), DEFAULTS.color),
    transparency: pickOption(fields.transparency, TRANSPARENCIES, DEFAULTS.transparency),
    icon: pickOption(fields.icon, ICON_KEYS, DEFAULTS.icon),
    imageUrl,
  };
}

/**
 * A multipart/form-data body.
 * @param {Array<{ name: string, value?: string, filename?: string, type?: string, data?: Buffer }>} parts
 * @returns {{ contentType: string, body: Buffer }}
 */
export function multipart(parts, boundary = `----gladys${randomBytes(12).toString('hex')}`) {
  const chunks = [];
  for (const part of parts) {
    if (part.data) {
      chunks.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n` +
            `Content-Type: ${part.type ?? 'application/octet-stream'}\r\n\r\n`,
        ),
        part.data,
        Buffer.from('\r\n'),
      );
    } else {
      chunks.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"\r\n\r\n${part.value}\r\n`,
        ),
      );
    }
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  // The charset tells NanoHTTPD (PiPup) to read the text parts as UTF-8, not
  // ASCII: "Quelqu'un sonne à la porte" keeps its accent.
  return {
    contentType: `multipart/form-data; boundary=${boundary}; charset=UTF-8`,
    body: Buffer.concat(chunks),
  };
}

const JSON_TYPE = 'application/json; charset=utf-8';

const extension = (type) =>
  ({ 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' })[type] ?? 'jpg';

// Notifications for Android TV: position and transparency are indexes.
const NFA_POSITIONS = { bottom_right: 0, bottom_left: 1, top_right: 2, top_left: 3, center: 4 };
const NFA_TRANSPARENCIES = { 0: 1, 25: 2, 50: 3, 75: 4, 100: 5 };

// PiPup: its own order of the same five positions.
const PIPUP_POSITIONS = { top_right: 0, top_left: 1, bottom_right: 2, bottom_left: 3, center: 4 };

// TvOverlay: four corners; the center is left to the app's "hot corner".
const TVOVERLAY_CORNERS = {
  top_left: 'top_start',
  top_right: 'top_end',
  bottom_left: 'bottom_start',
  bottom_right: 'bottom_end',
};

/** `#AARRGGBB` from a color and a transparency in percent (PiPup). */
export function argb(color, transparency) {
  const alpha = Math.round(255 * (1 - Number(transparency) / 100));
  return `#${alpha.toString(16).padStart(2, '0')}${COLORS[color].slice(1).toLowerCase()}`;
}

/**
 * The HTTP request showing a notification on one app.
 * @param {string} app a key of APPS (src/tvs.js)
 * @param {object} notification from normalizeNotification
 * @param {{ data: Buffer, type: string } | null} image from fetchImage
 * @returns {{ method: string, path: string, headers: object, body: Buffer }}
 */
export function encodeNotification(app, notification, image = null) {
  const n = notification;
  if (app === 'nfandroidtv') {
    const parts = [
      { name: 'type', value: '0' },
      { name: 'title', value: n.title || DEFAULT_TITLE },
      { name: 'msg', value: n.message },
      { name: 'duration', value: String(n.duration) },
      { name: 'fontsize', value: '0' },
      { name: 'position', value: String(NFA_POSITIONS[n.position]) },
      { name: 'bkgcolor', value: COLORS[n.color] },
      { name: 'transparency', value: String(NFA_TRANSPARENCIES[n.transparency]) },
      { name: 'offset', value: '0' },
      { name: 'app', value: DEFAULT_TITLE },
      { name: 'force', value: 'true' },
      { name: 'interrupt', value: '0' },
      {
        name: 'filename',
        filename: 'icon.png',
        data: n.icon === 'none' ? EMPTY_ICON : Buffer.from(ICONS[n.icon].png, 'base64'),
      },
    ];
    if (image) {
      parts.push({
        name: 'filename2',
        filename: `image.${extension(image.type)}`,
        data: image.data,
      });
    }
    const { contentType, body } = multipart(parts);
    return { method: 'POST', path: '/', headers: { 'Content-Type': contentType }, body };
  }

  if (app === 'pipup') {
    const fields = {
      duration: n.duration,
      position: PIPUP_POSITIONS[n.position],
      backgroundColor: argb(n.color, n.transparency),
      ...(n.title ? { title: n.title } : {}),
      ...(n.message ? { message: n.message } : {}),
    };
    if (!image) {
      return {
        method: 'POST',
        path: '/notify',
        headers: { 'Content-Type': JSON_TYPE },
        body: Buffer.from(JSON.stringify(fields)),
      };
    }
    const { contentType, body } = multipart([
      ...Object.entries(fields).map(([name, value]) => ({ name, value: String(value) })),
      { name: 'imageWidth', value: '480' },
      {
        name: 'image',
        filename: `image.${extension(image.type)}`,
        type: image.type,
        data: image.data,
      },
    ]);
    return { method: 'POST', path: '/notify', headers: { 'Content-Type': contentType }, body };
  }

  if (app === 'tvoverlay') {
    const payload = {
      ...(n.title ? { title: n.title } : {}),
      ...(n.message ? { message: n.message } : {}),
      source: DEFAULT_TITLE,
      duration: n.duration,
      ...(TVOVERLAY_CORNERS[n.position] ? { corner: TVOVERLAY_CORNERS[n.position] } : {}),
      ...(n.icon === 'none' ? {} : { largeIcon: `mdi:${ICONS[n.icon].mdi}` }),
      ...(image ? { image: image.data.toString('base64') } : {}),
    };
    return {
      method: 'POST',
      path: '/notify',
      headers: { 'Content-Type': JSON_TYPE },
      body: Buffer.from(JSON.stringify(payload)),
    };
  }

  throw new Error(`Unknown app ${app}`);
}
