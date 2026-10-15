// -----------------------------------------------------------------------------
// The two network primitives of the integration, on Node's own modules (no
// dependency): an HTTP request with a hard deadline and a size cap, and a TCP
// connection test.
//
// node:http rather than fetch: a camera answering over HTTPS with its own
// self-signed certificate (most of them) must still give its snapshot, and the
// Digest challenge of src/image.js needs the raw 401 answer.
// -----------------------------------------------------------------------------

import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

export class HttpError extends Error {
  /**
   * @param {string} code TIMEOUT | TOO_LARGE | or the Node code (ECONNREFUSED…)
   */
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * @param {string|URL} url
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {object} [options.headers]
 * @param {Buffer|string} [options.body]
 * @param {number} [options.timeoutMs] deadline of the whole exchange
 * @param {number} [options.maxBytes] larger answers are cut and refused
 * @returns {Promise<{ status: number, headers: object, rawHeaders: string[], body: Buffer }>}
 */
export function request(
  url,
  { method = 'GET', headers = {}, body, timeoutMs = 5000, maxBytes = 1024 * 1024 } = {},
) {
  const target = url instanceof URL ? url : new URL(url);
  const transport = target.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        fn(value);
      }
    };
    const outgoing = { ...headers };
    if (body !== undefined) {
      outgoing['Content-Length'] = Buffer.byteLength(body);
    }
    const req = transport.request(
      target,
      {
        method,
        headers: outgoing,
        // LAN cameras serve HTTPS with a self-signed certificate.
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks = [];
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > maxBytes) {
            req.destroy();
            finish(reject, new HttpError('TOO_LARGE', `answer larger than ${maxBytes} bytes`));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () =>
          finish(resolve, {
            status: res.statusCode,
            headers: res.headers,
            // Several WWW-Authenticate challenges are joined in `headers`.
            rawHeaders: res.rawHeaders,
            body: Buffer.concat(chunks),
          }),
        );
        res.on('error', (err) => finish(reject, new HttpError(err.code ?? 'EIO', err.message)));
      },
    );
    const timer = setTimeout(() => {
      req.destroy();
      finish(reject, new HttpError('TIMEOUT', `no answer within ${timeoutMs} ms`));
    }, timeoutMs);
    req.on('error', (err) => finish(reject, new HttpError(err.code ?? 'EIO', err.message)));
    req.end(body);
  });
}

/**
 * Resolves true when a TCP connection to address:port opens within the
 * deadline, false otherwise (refused, timed out, unreachable). Sends nothing:
 * nothing shows on the TV.
 */
export function tcpProbe(address, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: address, port });
    const done = (reachable) => {
      socket.destroy();
      resolve(reachable);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

/**
 * A URL safe to write to the logs: scheme, host and path only — never the
 * user name, the password or the query string (cameras often take their
 * credentials there, e.g. `?user=…&password=…`).
 */
export function redactUrl(url) {
  try {
    const parsed = new URL(url);
    const auth = parsed.username || parsed.password ? '***@' : '';
    return `${parsed.protocol}//${auth}${parsed.host}${parsed.pathname}${parsed.search ? '?…' : ''}`;
  } catch {
    return '(invalid URL)';
  }
}
