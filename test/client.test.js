// -----------------------------------------------------------------------------
// The HTTP side of a TV, against the fake apps: a notification accepted, an
// app gone, an app answering an error, the reachability check (a bare TCP
// connection: no request reaches the app).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '../src/client.js';
import { request, tcpProbe } from '../src/http.js';
import { normalizeNotification } from '../src/notification.js';
import { createFakeTv } from './helpers/fakeTv.js';

const client = createClient();
const tvOf = (fake) => ({
  id: 't1',
  name: 'TV',
  address: '127.0.0.1',
  app: fake.app,
  port: fake.port,
});
const hello = normalizeNotification({ title: 'Gladys', message: 'Hello' });

for (const app of ['nfandroidtv', 'pipup', 'tvoverlay']) {
  test(`${app}: a notification is accepted by the app`, async (t) => {
    const fake = await createFakeTv(app);
    t.after(() => fake.stop());
    await client.send(tvOf(fake), hello);
    assert.equal(fake.notifications.length, 1);
    assert.equal(await client.reachable(tvOf(fake)), true);
  });
}

test('an app that is gone: unreachable, and the check says it', async (t) => {
  const fake = await createFakeTv('pipup');
  await fake.stop();
  await assert.rejects(client.send(tvOf(fake), hello), { code: 'unreachable' });
  assert.equal(await client.reachable(tvOf(fake)), false);
  t.diagnostic('the closed port refused the connection at once');
});

test('an app answering an error: refused, with the status', async (t) => {
  const fake = await createFakeTv('tvoverlay');
  t.after(() => fake.stop());
  fake.forceStatus = 503;
  await assert.rejects(client.send(tvOf(fake), hello), { code: 'refused', status: 503 });
});

test('the wrong app on a port: the app refuses the request', async (t) => {
  // TvOverlay answers 404 to the form of Notifications for Android TV.
  const fake = await createFakeTv('tvoverlay');
  t.after(() => fake.stop());
  await assert.rejects(client.send({ ...tvOf(fake), app: 'nfandroidtv' }, hello), {
    code: 'refused',
    status: 404,
  });
});

test('the reachability check opens a connection and sends nothing', async (t) => {
  const fake = await createFakeTv('nfandroidtv');
  t.after(() => fake.stop());
  assert.equal(await tcpProbe('127.0.0.1', fake.port), true);
  assert.deepEqual(fake.requests, []);
});

test('a request past its deadline fails with TIMEOUT', async (t) => {
  const http = await import('node:http');
  const server = http.createServer(() => {});
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  await assert.rejects(request(`http://127.0.0.1:${server.address().port}/`, { timeoutMs: 50 }), {
    code: 'TIMEOUT',
  });
});
