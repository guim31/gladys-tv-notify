// -----------------------------------------------------------------------------
// Fake receivers, on the loopback interface (nothing leaves the machine):
//
// - a TV running one of the three notification apps, answering like the real
//   app does (paths, content types, the fields it reads — see
//   test/fixtures/apps/README.md) and recording every notification;
// - a camera serving a JPEG snapshot, optionally behind Basic or Digest
//   authentication.
//
// `stop()` makes the TV unreachable (the app closed, the TV off); `start()`
// brings it back on the same port.
// -----------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import http from 'node:http';

export const SNAPSHOT = readFileSync(new URL('../fixtures/snapshot.jpg', import.meta.url));

/** Parses a multipart/form-data body into text fields and files. */
export function parseMultipart(contentType, body) {
  const boundary = /boundary=([^;]+)/.exec(contentType)?.[1];
  if (!boundary) {
    throw new Error(`no boundary in ${contentType}`);
  }
  const fields = {};
  const files = {};
  const delimiter = Buffer.from(`--${boundary}`);
  let start = body.indexOf(delimiter);
  while (start !== -1) {
    const next = body.indexOf(delimiter, start + delimiter.length);
    if (next === -1) {
      break;
    }
    // Between "--boundary\r\n" and "\r\n--boundary".
    const part = body.subarray(start + delimiter.length + 2, next - 2);
    const headerEnd = part.indexOf('\r\n\r\n');
    const headers = part.subarray(0, headerEnd).toString('utf8');
    const content = part.subarray(headerEnd + 4);
    const name = /name="([^"]+)"/.exec(headers)[1];
    const filename = /filename="([^"]*)"/.exec(headers)?.[1];
    if (filename !== undefined) {
      files[name] = {
        filename,
        type: /Content-Type: (.+)/i.exec(headers)?.[1].trim(),
        data: Buffer.from(content),
      };
    } else {
      fields[name] = content.toString('utf8');
    }
    start = next;
  }
  return { fields, files };
}

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

// What each app does with a request, as read in its code or documentation.
const APPS = {
  // Notifications for Android TV: multipart on any path, `msg` and the icon
  // file `filename` expected (the library always sends both).
  nfandroidtv(req, type, body) {
    if (req.method !== 'POST' || !type.startsWith('multipart/form-data')) {
      return { status: 200, text: 'Notifications for Android TV' };
    }
    const { fields, files } = parseMultipart(type, body);
    if (fields.msg === undefined || !files.filename) {
      return { status: 400, text: 'missing msg or icon' };
    }
    return { status: 200, text: 'OK', notification: { fields, files } };
  },
  // PiPup: POST /notify, JSON or multipart (an `image` file); anything else is
  // an "invalid request" (400).
  pipup(req, type, body) {
    if (req.method !== 'POST') {
      return { status: 400, text: 'invalid method' };
    }
    if (req.url !== '/notify') {
      return { status: 400, text: `unknown uri: ${req.url}` };
    }
    if (type.startsWith('application/json')) {
      return { status: 200, text: 'OK', notification: { json: JSON.parse(body.toString('utf8')) } };
    }
    if (type.startsWith('multipart/form-data')) {
      return { status: 200, text: 'OK', notification: parseMultipart(type, body) };
    }
    return { status: 400, text: 'invalid content-type' };
  },
  // TvOverlay: POST /notify with a JSON object; GET /get reads the settings.
  tvoverlay(req, type, body) {
    if (req.method === 'GET' && req.url === '/get') {
      return { status: 200, json: { settings: { deviceName: 'Fake TV' } } };
    }
    if (req.method !== 'POST' || req.url !== '/notify' || !type.startsWith('application/json')) {
      return { status: 404, text: 'Not found' };
    }
    return { status: 200, text: 'OK', notification: { json: JSON.parse(body.toString('utf8')) } };
  },
};

/**
 * A TV running `app`, listening on 127.0.0.1.
 * @param {'nfandroidtv'|'pipup'|'tvoverlay'} app
 */
export async function createFakeTv(app = 'nfandroidtv') {
  const tv = {
    app,
    port: null,
    notifications: [],
    requests: [],
    // Forces an answer status (e.g. 500), null: the app's normal behavior.
    forceStatus: null,
    server: null,
    async start() {
      tv.server = http.createServer(async (req, res) => {
        const body = await readBody(req);
        const type = req.headers['content-type'] ?? '';
        tv.requests.push({ method: req.method, url: req.url, type, size: body.length });
        if (tv.forceStatus) {
          res.writeHead(tv.forceStatus).end('forced');
          return;
        }
        const answer = APPS[app](req, type, body);
        if (answer.notification) {
          tv.notifications.push({ path: req.url, type, ...answer.notification });
        }
        if (answer.json) {
          res.writeHead(answer.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(answer.json));
        } else {
          res.writeHead(answer.status, { 'Content-Type': 'text/plain' }).end(answer.text);
        }
      });
      await new Promise((resolve) => tv.server.listen(tv.port ?? 0, '127.0.0.1', resolve));
      tv.port = tv.server.address().port;
      return tv;
    },
    async stop() {
      if (tv.server) {
        tv.server.closeAllConnections?.();
        await new Promise((resolve) => tv.server.close(resolve));
        tv.server = null;
      }
    },
    /** The fields of the add_tv action for this TV. */
    fields(name = 'Living room TV') {
      return { name, address: '127.0.0.1', app, port: tv.port };
    },
  };
  return tv.start();
}

const md5 = (text) => createHash('md5').update(text).digest('hex');

/**
 * A camera serving SNAPSHOT on `/snapshot.jpg`.
 * @param {object} [options]
 * @param {'none'|'basic'|'digest'} [options.auth]
 * @param {string} [options.username]
 * @param {string} [options.password]
 * @param {Buffer} [options.body] what the snapshot URL serves
 * @param {string} [options.contentType]
 */
export async function createFakeCamera({
  auth = 'none',
  username = 'viewer',
  password = 's3cret-pass',
  body = SNAPSHOT,
  contentType = 'image/jpeg',
} = {}) {
  const realm = 'IP Camera';
  const nonce = 'dcd98b7102dd2f0e8b11d0f600bfb0c093';
  const camera = { requests: [], server: null, port: null };
  const authorized = (req) => {
    const header = req.headers.authorization ?? '';
    if (auth === 'none') {
      return true;
    }
    if (auth === 'basic') {
      return header === `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    }
    const params = Object.fromEntries(
      [...header.matchAll(/(\w+)=(?:"([^"]*)"|([^,\s]*))/g)].map(([, k, q, b]) => [k, q ?? b]),
    );
    if (!header.startsWith('Digest ') || params.username !== username) {
      return false;
    }
    const ha1 = md5(`${username}:${realm}:${password}`);
    const ha2 = md5(`${req.method}:${params.uri}`);
    const expected = md5(`${ha1}:${nonce}:${params.nc}:${params.cnonce}:auth:${ha2}`);
    return params.response === expected && params.uri === req.url;
  };
  camera.server = http.createServer((req, res) => {
    camera.requests.push({ url: req.url, authorization: req.headers.authorization ?? null });
    if (!req.url.startsWith('/snapshot.jpg')) {
      res.writeHead(404).end();
      return;
    }
    if (!authorized(req)) {
      // A Basic challenge next to the Digest one, as Hikvision cameras do.
      const challenges =
        auth === 'digest'
          ? [`Digest realm="${realm}", qop="auth", nonce="${nonce}"`, `Basic realm="${realm}"`]
          : [`Basic realm="${realm}"`];
      res.writeHead(
        401,
        challenges.flatMap((challenge) => ['WWW-Authenticate', challenge]),
      );
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType }).end(body);
  });
  await new Promise((resolve) => camera.server.listen(0, '127.0.0.1', resolve));
  camera.port = camera.server.address().port;
  camera.url = (path = '/snapshot.jpg', credentials = '') =>
    `http://${credentials ? `${credentials}@` : ''}127.0.0.1:${camera.port}${path}`;
  camera.stop = () =>
    new Promise((resolve) => {
      camera.server.closeAllConnections?.();
      camera.server.close(resolve);
    });
  return camera;
}
