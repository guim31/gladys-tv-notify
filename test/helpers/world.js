// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, the real HTTP client talking
// to fake TVs on the loopback interface, a manual clock, a temporary /data,
// and the integration wired on top through registerHandlers.
//
// Addresses other than 127.0.0.1 (the documentation range 192.0.2.x of the
// fixtures) never get a connection attempt: they are unreachable at once, so
// nothing leaves the machine.
// -----------------------------------------------------------------------------

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { createClient } from '../../src/client.js';
import { request, tcpProbe } from '../../src/http.js';
import { fetchImage } from '../../src/image.js';
import { Store } from '../../src/store.js';

process.env.LOG_LEVEL ??= 'silent';

const LOOPBACK = '127.0.0.1';

/** A request function that refuses anything but the loopback interface. */
export function localRequest(url, options) {
  const { hostname } = new URL(url);
  if (hostname !== LOOPBACK) {
    return Promise.reject(
      Object.assign(new Error(`connect EHOSTUNREACH ${hostname}`), { code: 'EHOSTUNREACH' }),
    );
  }
  return request(url, options);
}

/** The real client, kept on the loopback interface. */
export const localClient = () =>
  createClient({
    request: localRequest,
    probe: (address, port, timeoutMs) =>
      address === LOOPBACK ? tcpProbe(address, port, timeoutMs) : Promise.resolve(false),
  });

/** A manual clock. */
export function createClock(start = 1_700_000_000_000) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {object} [options.saved] content of /data/tvs.json before the start
 * @param {boolean} [options.connect]
 * @param {boolean} [options.timers] true: the monitor's own timers run
 * @param {object} [options.timings] overrides of the monitor timings
 */
export async function createWorld({
  config = {},
  devices = [],
  saved,
  connect = true,
  timers = false,
  timings,
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-tv-notify-')),
} = {}) {
  const gladys = createFakeGladys({ config, devices });
  const store = new Store(dataDir);
  if (saved) {
    await store.save(saved);
    await store.flush();
  }
  const clock = createClock();
  const app = registerHandlers(gladys, {
    store,
    client: localClient(),
    // The image download goes through the same loopback guard.
    fetchImage: (url) => fetchImage(url, { request: localRequest }),
    timers,
    now: clock.now,
    timings,
  });
  if (connect) {
    await gladys.connect();
    await app.ready;
    await app.monitor.running;
  }
  return { gladys, fake: gladys.fake, app, monitor: app.monitor, clock, store, dataDir };
}

/** Run the "Add or update a TV" action; resolves with the ack. */
export const addTv = (world, fields) => world.fake.action('add_tv', fields);

/** The device published for a TV name, from the last discovery list. */
export const discovered = (world, name) =>
  world.fake.discoveredDevices.find((device) => device.name === name);

/** Create the device of a TV in Gladys, as the user would. */
export async function create(world, name) {
  const device = discovered(world, name);
  if (!device) {
    throw new Error(`${name} is not in the discovered devices`);
  }
  await world.fake.deviceCreated(device);
  return device;
}

/** Add a TV and create its device. */
export async function addAndCreate(world, fields) {
  await addTv(world, fields);
  return create(world, fields.name);
}

/** External id of the reachable feature of a device. */
export const reachableId = (device) =>
  device.features.find((feature) => feature.external_id.endsWith(':reachable')).external_id;

/**
 * Capture the integration's log lines at `level` and above (LOG_LEVEL is read
 * at every call). Returns the lines as `{ level, text }`.
 */
export function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => {
    const text = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    const match = /^\[[^\]]+\] \[(\w+)\]/.exec(text);
    lines.push({ level: match ? match[1].toLowerCase() : 'raw', text });
  };
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}
