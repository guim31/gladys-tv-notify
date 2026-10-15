// -----------------------------------------------------------------------------
// What the integration writes to `docker logs`: at info, only the lifecycle (a
// TV added, lost or back, a test from the Configuration screen), never one
// line per check cycle or per notification; a failure that repeats is logged
// once, plus one line when it is over; never a camera password.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeCamera, createFakeTv } from './helpers/fakeTv.js';
import { addAndCreate, captureLogs, createWorld } from './helpers/world.js';

const strip = (line) => line.text.replace(/^\[[^\]]+\] /, '');

async function worldWithTv(t, config = { offline_after: '0' }) {
  const tv = await createFakeTv('nfandroidtv');
  t.after(() => tv.stop());
  const world = await createWorld({ config });
  t.after(() => world.app.stop());
  const device = await addAndCreate(world, tv.fields());
  return { ...world, tv, device };
}

async function cycles(world, count) {
  for (let i = 0; i < count; i += 1) {
    world.clock.advance(30_000);
    await world.monitor.runCycle();
  }
}

const notify = (world, fields) =>
  world.fake.sceneAction('show_notification', { device: world.device.external_id, ...fields });

test('normal check cycles and notifications write nothing at info', async (t) => {
  const world = await worldWithTv(t);
  const lines = captureLogs(t, 'info');
  await cycles(world, 5);
  await notify(world, { message: 'Dinner is ready' });
  await notify(world, { message: 'Bedtime' });
  assert.deepEqual(lines, []);
});

test('LOG_LEVEL=debug shows the check cycles and the notifications', async (t) => {
  const world = await worldWithTv(t);
  const lines = captureLogs(t, 'debug');
  await cycles(world, 2);
  await notify(world, { message: 'Dinner is ready' });
  assert.equal(lines.filter((line) => /Check cycle: 1 TV/.test(line.text)).length, 2);
  assert.equal(
    lines.filter((line) => /Notification shown on Living room TV/.test(line.text)).length,
    1,
  );
});

test('a TV lost and back is one info line each', async (t) => {
  const world = await worldWithTv(t);
  const lines = captureLogs(t, 'info');
  await world.tv.stop();
  await cycles(world, 4);
  await world.tv.start();
  await cycles(world, 3);
  assert.deepEqual(lines.map(strip), [
    '[INFO] [tv-notify] Living room TV is unreachable',
    '[INFO] [tv-notify] Living room TV is reachable again',
  ]);
});

test('a notification to a TV known to be off is not a warning', async (t) => {
  const world = await worldWithTv(t);
  await world.tv.stop();
  await cycles(world, 1);
  const lines = captureLogs(t, 'info');
  await notify(world, { message: 'x' });
  await notify(world, { message: 'x' });
  assert.deepEqual(lines, []);
});

test('a TV believed on that refuses notifications: one warning, one line at recovery', async (t) => {
  const world = await worldWithTv(t);
  const lines = captureLogs(t, 'info');
  world.tv.forceStatus = 500;
  await notify(world, { message: 'x' });
  await notify(world, { message: 'x' });
  await notify(world, { message: 'x' });
  world.tv.forceStatus = null;
  await notify(world, { message: 'x' });
  assert.deepEqual(
    lines.map((line) => [line.level, strip(line).replace(/^\[\w+\] /, '')]),
    [
      ['warn', '[tv-notify] Notification not shown, Living room TV: HTTP 500'],
      ['info', '[tv-notify] Notifications reach Living room TV again'],
    ],
  );
});

test('a camera refusing its snapshot: one warning, never its password', async (t) => {
  const world = await worldWithTv(t);
  const camera = await createFakeCamera({ auth: 'digest', password: 'CamP4ss!' });
  t.after(() => camera.stop());
  const lines = captureLogs(t, 'debug');
  const wrong = camera.url('/snapshot.jpg?user=viewer&password=CamP4ss!', 'viewer:Wr0ngP4ss');
  await notify(world, { message: 'Doorbell', image_url: wrong });
  await notify(world, { message: 'Doorbell', image_url: wrong });
  const good = camera.url('/snapshot.jpg', 'viewer:CamP4ss!');
  await notify(world, { message: 'Doorbell', image_url: good });
  const text = lines.map((line) => line.text).join('\n');
  assert.doesNotMatch(text, /CamP4ss|Wr0ngP4ss|viewer/);
  const warnings = lines.filter((line) => line.level === 'warn');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].text, /Image not downloaded \(auth\), notification shown without it/);
  assert.match(warnings[0].text, /http:\/\/\*\*\*@127\.0\.0\.1:\d+\/snapshot\.jpg\?…/);
});

test('states refused at every cycle: one warning, then one line at recovery', async (t) => {
  const world = await worldWithTv(t);
  const lines = captureLogs(t, 'info');
  const publish = t.mock.method(world.gladys, 'publishChangedStates', async () => {
    throw new Error('Gladys unreachable');
  });
  world.gladys.forgetPublishedStates();
  await cycles(world, 4);
  assert.ok(publish.mock.callCount() >= 4);
  assert.deepEqual(
    lines.map((line) => [line.level, strip(line).replace(/^\[\w+\] /, '')]),
    [['warn', '[tv-notify] Publishing the states failed: Gladys unreachable']],
  );
  publish.mock.restore();
  await cycles(world, 2);
  assert.equal(lines.length, 2);
  assert.match(lines[1].text, /\[INFO\].*Publishing the states works again/);
});

test('a check cycle failing again and again is logged once', async (t) => {
  const world = await worldWithTv(t);
  const lines = captureLogs(t, 'info');
  const reachable = world.monitor.client.reachable;
  world.monitor.client.reachable = async () => {
    throw new Error('socket exhausted');
  };
  await cycles(world, 3);
  assert.equal(lines.length, 1);
  assert.match(lines[0].text, /\[ERROR\].*Check cycle failed socket exhausted/);
  world.monitor.client.reachable = reachable;
  await cycles(world, 1);
  assert.equal(lines.length, 2);
  assert.match(lines[1].text, /Check cycles work again/);
});

test('user actions are one info line each', async (t) => {
  const world = await worldWithTv(t);
  const lines = captureLogs(t, 'info');
  await world.fake.action('test_notification', { device: world.device.external_id });
  await world.fake.action('remove_tv', { tv: 'Living room TV' });
  assert.deepEqual(lines.map(strip), [
    '[INFO] [tv-notify] Test notification shown on Living room TV',
    '[INFO] [tv-notify] TV removed: Living room TV',
  ]);
});
