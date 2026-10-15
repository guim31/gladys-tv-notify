#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Probes a real TV from a machine of its network, read-only by default:
//
//   node scripts/probe.mjs <tv address> [--notify]
//
// For each app (Notifications for Android TV 7676, PiPup 7979, TvOverlay
// 5001): is the port open, and what a harmless GET answers (status, type,
// size — never a body that could hold a setting; TvOverlay's /get may hold its
// MQTT password, only its key names are printed). Nothing appears on the TV.
//
// `--notify` also shows one test notification on every app found, with the
// integration's own client: the only thing this script ever changes.
// -----------------------------------------------------------------------------

import { createClient } from '../src/client.js';
import { request, tcpProbe } from '../src/http.js';
import { normalizeNotification } from '../src/notification.js';
import { APPS, normalizeAddress } from '../src/tvs.js';

const [, , rawAddress, ...flags] = process.argv;
const address = normalizeAddress(rawAddress ?? '');
if (!address) {
  console.error('Usage: node scripts/probe.mjs <tv address> [--notify]');
  process.exit(2);
}
const notify = flags.includes('--notify');

// The read-only request of each app, and what is safe to print of its answer.
const PROBES = {
  nfandroidtv: { path: '/', show: (body) => `${body.length} bytes` },
  // PiPup answers 400 "invalid method" to a GET: its signature.
  pipup: { path: '/notify', show: (body) => JSON.stringify(body.toString('utf8').slice(0, 40)) },
  tvoverlay: {
    path: '/get',
    show: (body) => {
      try {
        return `keys: ${Object.keys(JSON.parse(body.toString('utf8'))).join(', ')}`;
      } catch {
        return `${body.length} bytes, not JSON`;
      }
    },
  },
};

const client = createClient();
let found = 0;
for (const [app, { port, label }] of Object.entries(APPS)) {
  const open = await tcpProbe(address, port, 3000);
  console.log(`${label} (port ${port}): ${open ? 'open' : 'closed'}`);
  if (!open) {
    continue;
  }
  found += 1;
  const probe = PROBES[app];
  try {
    const response = await request(`http://${address}:${port}${probe.path}`, {
      timeoutMs: 5000,
      maxBytes: 256 * 1024,
    });
    console.log(
      `  GET ${probe.path} -> HTTP ${response.status}, ${response.headers['content-type'] ?? 'no type'}, ${probe.show(response.body)}`,
    );
  } catch (err) {
    console.log(`  GET ${probe.path} -> ${err.code}: ${err.message}`);
  }
  if (notify) {
    try {
      await client.send(
        { id: 'probe', name: 'probe', address, app, port },
        normalizeNotification({ title: 'Gladys', message: `Probe: ${label}`, icon: 'info' }),
      );
      console.log('  test notification: accepted');
    } catch (err) {
      console.log(`  test notification: ${err.code} (${err.message})`);
    }
  }
}
console.log(found ? `${found} app(s) answering.` : 'No notification app answers on this address.');
