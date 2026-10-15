// -----------------------------------------------------------------------------
// The monitor through the full SDK wiring (src/app.js) on the SDK's fake
// Gladys, with fake TVs on the loopback interface: adding TVs, devices,
// reachability states refreshed by the integration's own timer (never by
// onPoll), offline delay, heartbeat, persistence, removal, test notification.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFakeTv } from './helpers/fakeTv.js';
import { addAndCreate, addTv, createWorld, discovered, reachableId } from './helpers/world.js';

async function worldWithTv(t, { app = 'nfandroidtv', config, timings } = {}) {
  const tv = await createFakeTv(app);
  t.after(() => tv.stop());
  const world = await createWorld({ config, timings });
  t.after(() => world.app.stop());
  const device = await addAndCreate(world, tv.fields());
  return { ...world, tv, device };
}

async function cycles(world, count, stepMs = 30_000) {
  for (let i = 0; i < count; i += 1) {
    world.clock.advance(stepMs);
    await world.monitor.runCycle();
  }
}

test('adding a TV checks its app and proposes it in the Discover tab', async (t) => {
  const tv = await createFakeTv('nfandroidtv');
  t.after(() => tv.stop());
  const world = await createWorld({ config: { language: 'en' } });
  t.after(() => world.app.stop());
  const ack = await addTv(world, tv.fields());
  assert.equal(ack.success, true);
  assert.deepEqual(ack.data.message, {
    en: `TV "Living room TV" added. Notifications for Android TV / Fire TV answers on port ${tv.port}. Open the Discover tab to create its device.`,
    fr: `TV « Living room TV » ajoutée. Notifications for Android TV / Fire TV répond sur le port ${tv.port}. Ouvrez l'onglet Découverte pour créer son appareil.`,
    de: `Fernseher „Living room TV“ hinzugefügt. Notifications for Android TV / Fire TV antwortet auf Port ${tv.port}. Öffne den Tab „Entdecken“, um sein Gerät anzulegen.`,
    es: `Televisor «Living room TV» añadido. Notifications for Android TV / Fire TV responde en el puerto ${tv.port}. Abra la pestaña Descubrir para crear su dispositivo.`,
  });
  const device = discovered(world, 'Living room TV');
  assert.equal(device.model, 'Notifications for Android TV / Fire TV');
  assert.equal(device.should_poll, false);
  assert.equal(device.poll_frequency, undefined);
  assert.deepEqual(device.params, [
    { name: 'ADDRESS', value: '127.0.0.1' },
    { name: 'APP', value: 'nfandroidtv' },
    { name: 'PORT', value: String(tv.port) },
  ]);
  assert.deepEqual(
    device.features.map((feature) => `${feature.category}/${feature.type}`),
    ['presence-sensor/binary'],
  );
  // The check is a bare TCP connection: nothing reached the app, nothing shown.
  assert.deepEqual(tv.requests, []);
  // Not created yet: nothing published.
  assert.deepEqual(world.fake.states, []);
});

test('a TV that does not answer yet is added anyway, with advice', async (t) => {
  const world = await createWorld({ config: { language: 'fr' } });
  t.after(() => world.app.stop());
  const ack = await addTv(world, {
    name: 'Chambre',
    address: '192.0.2.31',
    app: 'pipup',
  });
  assert.equal(
    ack.data.message.fr,
    "TV « Chambre » ajoutée. PiPup ne répond pas encore sur le port 7979 : allumez la TV et ouvrez l'appli une fois. Ouvrez l'onglet Découverte pour créer son appareil.",
  );
  assert.equal(discovered(world, 'Chambre').params[2].value, '7979');
});

test('a mistake in the form is answered in every language, nothing is added', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const ack = await addTv(world, { name: 'TV', address: 'tv.local', app: 'pipup' });
  assert.equal(ack.success, true);
  assert.match(ack.data.message.fr, /« tv\.local » est un nom mDNS/);
  assert.match(ack.data.message.de, /„tv\.local“ ist ein mDNS-Name/);
  const port = await addTv(world, { name: 'TV', address: '192.0.2.30', port: 70000 });
  assert.match(port.data.message.en, /"70000" is not a port/);
  assert.deepEqual(world.fake.discoveredDevices, []);
});

test('creating the device publishes its state at once, and refreshes the widget', async (t) => {
  const world = await worldWithTv(t);
  assert.equal(world.fake.lastState(reachableId(world.device)), 1);
  assert.ok(world.fake.widgetRefreshes.includes('tv_message'));
});

test('the states refresh on the integration timer alone, never through onPoll', async (t) => {
  const world = await worldWithTv(t, { config: { offline_after: '0' } });
  const id = reachableId(world.device);
  const polls = world.fake.wsMessages.length;
  await world.tv.stop();
  await cycles(world, 1);
  assert.equal(world.fake.lastState(id), 0);
  await world.tv.start();
  await cycles(world, 1);
  assert.equal(world.fake.lastState(id), 1);
  // No poll message ever came from Gladys: the timer did it all.
  assert.equal(
    world.fake.wsMessages.slice(polls).filter((message) => message.type?.includes('poll')).length,
    0,
  );
  assert.deepEqual(
    world.fake.states
      .filter((state) => state.device_feature_external_id === id)
      .map((s) => s.state),
    [1, 0, 1],
  );
});

test('the real timer runs the checks by itself', async (t) => {
  const tv = await createFakeTv('tvoverlay');
  t.after(() => tv.stop());
  const world = await createWorld({ timers: true, config: { check_interval: '15' } });
  t.after(() => world.app.stop());
  const device = await addAndCreate(world, tv.fields());
  t.mock.timers.enable({ apis: ['setInterval'] });
  // The interval was armed before the mock: arm it again under the mock.
  world.monitor.schedule();
  const cycle = t.mock.method(world.monitor, 'runCycle');
  t.mock.timers.tick(15_000);
  t.mock.timers.tick(15_000);
  assert.equal(cycle.mock.callCount(), 2);
  assert.equal(world.fake.lastState(reachableId(device)), 1);
});

test('a TV is unreachable only after the configured delay', async (t) => {
  const world = await worldWithTv(t, { config: { offline_after: '60' } });
  const id = reachableId(world.device);
  await world.tv.stop();
  await cycles(world, 1, 30_000);
  assert.equal(world.fake.lastState(id), 1, 'one missed check is not enough');
  await cycles(world, 1, 30_000);
  assert.equal(world.fake.lastState(id), 0);
});

test('a stable state is published again every 12 hours, not at every check', async (t) => {
  const world = await worldWithTv(t);
  const id = reachableId(world.device);
  const count = () => world.fake.states.filter((s) => s.device_feature_external_id === id).length;
  const before = count();
  await cycles(world, 10, 60_000);
  assert.equal(count(), before, 'nothing changed, nothing published');
  // The SDK heartbeat uses the real clock: move Date.now 12 hours ahead.
  const realNow = Date.now;
  t.mock.method(Date, 'now', () => realNow() + 12 * 60 * 60 * 1000 + 1000);
  await cycles(world, 1, 60_000);
  assert.equal(count(), before + 1);
});

test('onPoll still answers, for a Gladys that would poll anyway', async (t) => {
  const world = await worldWithTv(t, { config: { offline_after: '0' } });
  await world.tv.stop();
  const ack = await world.fake.poll(world.device);
  assert.equal(ack.success, true);
  assert.equal(world.fake.lastState(reachableId(world.device)), 0);
});

test('the TV list survives a restart, and a lost /data is rebuilt from the devices', async (t) => {
  const world = await worldWithTv(t);
  await world.app.stop();
  const saved = JSON.parse(await readFile(join(world.dataDir, 'tvs.json'), 'utf8'));
  assert.equal(saved.tvs.length, 1);
  assert.deepEqual(Object.keys(saved.tvs[0]).sort(), ['address', 'app', 'id', 'name', 'port']);

  // Same /data: same TV, same device.
  const again = await createWorld({ dataDir: world.dataDir, devices: [world.device] });
  t.after(() => again.app.stop());
  assert.equal(again.fake.discoveredDevices[0].external_id, world.device.external_id);

  // /data lost: rebuilt from the device parameters.
  const rebuilt = await createWorld({ devices: [world.device] });
  t.after(() => rebuilt.app.stop());
  const [tv] = rebuilt.monitor.tvs.values();
  assert.equal(tv.address, '127.0.0.1');
  assert.equal(tv.app, 'nfandroidtv');
  assert.equal(tv.port, world.tv.port);
  assert.equal(rebuilt.fake.discoveredDevices[0].external_id, world.device.external_id);
});

test('updating a TV keeps its device; removing it stops the checks', async (t) => {
  const world = await worldWithTv(t);
  const ack = await addTv(world, { ...world.tv.fields(), app: 'nfandroidtv' });
  assert.match(ack.data.message.en, /TV "Living room TV" updated/);
  assert.equal(world.fake.discoveredDevices.length, 1);
  assert.equal(world.fake.discoveredDevices[0].external_id, world.device.external_id);

  const missing = await world.fake.action('remove_tv', { tv: 'Kitchen' });
  assert.match(missing.data.message.en, /No TV is named "Kitchen"/);
  const removed = await world.fake.action('remove_tv', { tv: '127.0.0.1' });
  assert.equal(removed.data.message.fr, 'TV « Living room TV » retirée. TV restantes : 0.');
  assert.deepEqual(world.fake.discoveredDevices, []);
});

test('the test action shows a notification and reports it', async (t) => {
  const world = await worldWithTv(t, { config: { language: 'de' } });
  const ack = await world.fake.action('test_notification', { device: world.device.external_id });
  assert.equal(ack.data.message.de, 'Testbenachrichtigung auf Living room TV angezeigt.');
  const [notification] = world.tv.notifications;
  assert.equal(notification.fields.title, 'Gladys');
  assert.equal(
    notification.fields.msg,
    'Testbenachrichtigung: Gladys kann Nachrichten auf diesem Fernseher anzeigen.',
  );
});

test('the test action says when the TV does not answer', async (t) => {
  const world = await worldWithTv(t);
  await world.tv.stop();
  const ack = await world.fake.action('test_notification', { device: world.device.external_id });
  assert.equal(ack.success, true);
  assert.match(ack.data.message.en, /Living room TV does not answer: is the TV on/);
  world.tv.forceStatus = 500;
  await world.tv.start();
  const refused = await world.fake.action('test_notification', {
    device: world.device.external_id,
  });
  assert.match(refused.data.message.fr, /a refusé la notification \(HTTP 500\)/);
});

test('the feature name follows the language of the configuration', async (t) => {
  const world = await createWorld({ config: { language: 'es' } });
  t.after(() => world.app.stop());
  await addTv(world, { name: 'Salón', address: '192.0.2.30', app: 'tvoverlay' });
  assert.equal(discovered(world, 'Salón').features[0].name, 'Accesible');
  await world.fake.configUpdated({ language: 'en' });
  assert.equal(discovered(world, 'Salón').features[0].name, 'Reachable');
});

test('a reconnection publishes the devices and the states again', async (t) => {
  const world = await worldWithTv(t);
  const id = reachableId(world.device);
  const before = world.fake.states.filter((s) => s.device_feature_external_id === id).length;
  await world.gladys.disconnect();
  await world.gladys.connect();
  assert.equal(world.fake.discoveredDevices.length, 1);
  assert.equal(
    world.fake.states.filter((s) => s.device_feature_external_id === id).length,
    before + 1,
  );
});
