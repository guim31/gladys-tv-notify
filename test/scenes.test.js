// -----------------------------------------------------------------------------
// The scene action `show_notification`, end to end: the core relays the
// resolved fields, the container downloads the camera snapshot and shows the
// notification on each kind of app (fake TVs on the loopback interface).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ICONS } from '../src/icons.js';
import { SNAPSHOT, createFakeCamera, createFakeTv } from './helpers/fakeTv.js';
import { addAndCreate, createWorld, reachableId } from './helpers/world.js';

async function setup(t, app, { config } = {}) {
  const tv = await createFakeTv(app);
  t.after(() => tv.stop());
  const world = await createWorld({ config });
  t.after(() => world.app.stop());
  const device = await addAndCreate(world, tv.fields());
  return { world, tv, device };
}

// The fields as the core sends them: rendered variables, defaults applied.
const doorbell = (device, imageUrl) => ({
  device: device.external_id,
  title: 'Sonnette',
  message: "Quelqu'un sonne à la porte (18:42)",
  duration: 30,
  position: 'top_right',
  color: 'indigo',
  transparency: '0',
  icon: 'doorbell',
  ...(imageUrl ? { image_url: imageUrl } : {}),
});

test('doorbell → the visitor on the TV: Notifications for Android TV', async (t) => {
  const { world, tv, device } = await setup(t, 'nfandroidtv');
  const cam = await createFakeCamera({ auth: 'digest' });
  t.after(() => cam.stop());
  const ack = await world.fake.sceneAction(
    'show_notification',
    doorbell(device, cam.url('/snapshot.jpg', 'viewer:s3cret-pass')),
  );
  assert.deepEqual(ack, { success: true, data: { outputs: { sent: 1 } } });
  const [shown] = tv.notifications;
  assert.equal(shown.fields.title, 'Sonnette');
  assert.equal(shown.fields.msg, "Quelqu'un sonne à la porte (18:42)");
  assert.equal(shown.fields.duration, '30');
  assert.equal(shown.fields.position, '2');
  assert.equal(shown.fields.bkgcolor, '#303F9F');
  assert.ok(shown.files.filename.data.equals(Buffer.from(ICONS.doorbell.png, 'base64')));
  assert.ok(shown.files.filename2.data.equals(SNAPSHOT));
});

test('doorbell → the visitor on the TV: PiPup', async (t) => {
  const { world, tv, device } = await setup(t, 'pipup');
  const cam = await createFakeCamera();
  t.after(() => cam.stop());
  const ack = await world.fake.sceneAction('show_notification', doorbell(device, cam.url()));
  assert.equal(ack.data.outputs.sent, 1);
  const [shown] = tv.notifications;
  assert.equal(shown.path, '/notify');
  assert.equal(shown.fields.title, 'Sonnette');
  assert.equal(shown.fields.position, '0');
  assert.ok(shown.files.image.data.equals(SNAPSHOT));
});

test('doorbell → the visitor on the TV: TvOverlay', async (t) => {
  const { world, tv, device } = await setup(t, 'tvoverlay');
  const cam = await createFakeCamera({ auth: 'basic' });
  t.after(() => cam.stop());
  const ack = await world.fake.sceneAction(
    'show_notification',
    doorbell(device, cam.url('/snapshot.jpg', 'viewer:s3cret-pass')),
  );
  assert.equal(ack.data.outputs.sent, 1);
  const [shown] = tv.notifications;
  assert.equal(shown.json.corner, 'top_end');
  assert.equal(shown.json.largeIcon, 'mdi:doorbell');
  assert.ok(Buffer.from(shown.json.image, 'base64').equals(SNAPSHOT));
});

test('a picture that cannot be downloaded: the notification is shown without it', async (t) => {
  const { world, tv, device } = await setup(t, 'nfandroidtv');
  const cam = await createFakeCamera({ auth: 'basic' });
  t.after(() => cam.stop());
  const ack = await world.fake.sceneAction(
    'show_notification',
    doorbell(device, cam.url('/snapshot.jpg', 'viewer:wrong')),
  );
  assert.equal(ack.data.outputs.sent, 1);
  assert.equal(tv.notifications.length, 1);
  assert.equal(tv.notifications[0].files.filename2, undefined);
});

test('a TV that is off: sent = 0, the scene goes on, the state follows', async (t) => {
  const { world, tv, device } = await setup(t, 'tvoverlay', { config: { offline_after: '0' } });
  await tv.stop();
  const ack = await world.fake.sceneAction('show_notification', {
    device: device.external_id,
    message: 'Dinner is ready',
  });
  assert.deepEqual(ack, { success: true, data: { outputs: { sent: 0 } } });
  assert.equal(world.fake.lastState(reachableId(device)), 0);
  await tv.start();
  const back = await world.fake.sceneAction('show_notification', {
    device: device.external_id,
    message: 'Dinner is ready',
  });
  assert.equal(back.data.outputs.sent, 1);
  assert.equal(world.fake.lastState(reachableId(device)), 1);
});

test('an app answering an error: sent = 0', async (t) => {
  const { world, tv, device } = await setup(t, 'pipup');
  tv.forceStatus = 400;
  const ack = await world.fake.sceneAction('show_notification', {
    device: device.external_id,
    message: 'x',
  });
  assert.equal(ack.data.outputs.sent, 0);
});

test('a device of another integration or an empty notification fail the action', async (t) => {
  const { world, device } = await setup(t, 'pipup', { config: { language: 'en' } });
  const foreign = await world.fake.sceneAction('show_notification', {
    device: 'ext:other:tv:abc',
    message: 'x',
  });
  assert.equal(foreign.success, false);
  assert.match(foreign.error, /not a TV of the Notifications Android\/Fire TV integration/);
  const empty = await world.fake.sceneAction('show_notification', {
    device: device.external_id,
    message: '   ',
  });
  assert.equal(empty.success, false);
  assert.match(empty.error, /neither a title nor a message/);
});

test('the error of a failed action follows the language of the configuration', async (t) => {
  const { world } = await setup(t, 'pipup', { config: { language: 'es' } });
  const ack = await world.fake.sceneAction('show_notification', {
    device: 'ext:other:tv:abc',
    message: 'x',
  });
  assert.match(ack.error, /no es un televisor/);
});
