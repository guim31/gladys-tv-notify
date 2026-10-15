// -----------------------------------------------------------------------------
// The `tv_message` dashboard widget: its content checked by the SDK's own
// validator (what the core would render, nothing dropped by the budget), the
// form button and the quick messages, the empty and degraded states.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeTv } from './helpers/fakeTv.js';
import { addAndCreate, addTv, createWorld } from './helpers/world.js';

const SETTINGS = {
  quick_1: 'À table !',
  quick_2: '',
  quick_3: 'Extinction des feux dans 10 minutes',
};

async function setup(t, { app = 'nfandroidtv', config } = {}) {
  const tv = await createFakeTv(app);
  t.after(() => tv.stop());
  const world = await createWorld({ config });
  t.after(() => world.app.stop());
  const device = await addAndCreate(world, tv.fields());
  return { world, tv, device };
}

const get = async (world, settings, language = 'fr') => {
  const ack = await world.fake.widgetGet('tv_message', { settings, language, units: 'metric' });
  assert.equal(ack.success, true, ack.error);
  assert.deepEqual(validateWidgetContent(ack.data.content), [], 'rendered exactly as sent');
  return ack.data.content;
};

test('status, the form button and the quick messages', async (t) => {
  const { world, device } = await setup(t);
  const content = await get(world, { ...SETTINGS, device: device.external_id });
  assert.equal(content.ttl_seconds, 60);
  const [status, write, ...quick] = content.components;
  assert.deepEqual(status, {
    type: 'status',
    items: [{ label: 'Living room TV', icon: 'tv', value: 'Allumée, joignable', color: 'success' }],
  });
  assert.equal(write.label, 'Écrire un message');
  assert.equal(write.style, 'secondary');
  assert.deepEqual(
    write.action.fields.map((field) => [field.key, field.type, field.required]),
    [
      ['message', 'string', true],
      ['duration', 'select', true],
    ],
  );
  assert.equal(write.action.fields[1].default, '10');
  assert.deepEqual(
    quick.map((button) => [button.label, button.action.key]),
    [
      ['À table !', 'quick_1'],
      ['Extinction des feux dan…', 'quick_3'],
    ],
  );
  // Never the primary style: invisible in dark mode (#3153).
  assert.ok(content.components.every((component) => component.style !== 'primary'));
});

test('typing a message in the form shows it on the TV', async (t) => {
  const { world, tv, device } = await setup(t, { app: 'tvoverlay' });
  const content = await get(world, { device: device.external_id }, 'en');
  const write = content.components.find((component) => component.action?.key === 'write');
  const ack = await world.fake.widgetAction('tv_message', 'write', write.action.params, {
    settings: { device: device.external_id },
    values: { message: 'Dinner is ready!', duration: '30' },
  });
  assert.deepEqual(ack.data.message.en, 'Message shown on Living room TV');
  assert.equal(tv.notifications[0].json.message, 'Dinner is ready!');
  assert.equal(tv.notifications[0].json.duration, 30);
  // An older core without the form relays the tap without values.
  const old = await world.fake.widgetAction('tv_message', 'write', write.action.params, {
    settings: {},
  });
  assert.equal(old.data.message.en, 'The notification has neither a title nor a message.');
  assert.equal(tv.notifications.length, 1);
});

test('a quick message is read from the settings sent with the tap', async (t) => {
  const { world, tv, device } = await setup(t, { app: 'pipup' });
  const settings = { ...SETTINGS, device: device.external_id };
  const content = await get(world, settings);
  const quick = content.components.find((component) => component.action?.key === 'quick_1');
  const ack = await world.fake.widgetAction('tv_message', 'quick_1', quick.action.params, {
    settings,
  });
  assert.equal(ack.data.message.fr, 'Message affiché sur Living room TV');
  assert.equal(tv.notifications[0].json.message, 'À table !');
  const empty = await world.fake.widgetAction('tv_message', 'quick_2', quick.action.params, {
    settings,
  });
  assert.match(empty.data.message.fr, /Ce message rapide est vide/);
});

test('a TV that is off: the toast says it', async (t) => {
  const { world, tv, device } = await setup(t, { config: { offline_after: '0' } });
  await tv.stop();
  const content = await get(world, { ...SETTINGS, device: device.external_id });
  const quick = content.components.find((component) => component.action?.key === 'quick_1');
  const ack = await world.fake.widgetAction('tv_message', 'quick_1', quick.action.params, {
    settings: SETTINGS,
  });
  assert.match(ack.data.message.de, /Living room TV antwortet nicht/);
  const after = await get(world, { device: device.external_id }, 'de');
  assert.deepEqual(after.components[0].items[0], {
    label: 'Living room TV',
    icon: 'tv',
    value: 'Aus oder nicht erreichbar',
    color: 'danger',
  });
});

test('no TV yet, a TV removed, no TV chosen', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const empty = await get(world, {}, 'es');
  assert.deepEqual(empty.components, [
    {
      type: 'text',
      variant: 'body',
      text: 'Aún no hay televisores: añada uno en la configuración de la integración Notifications Android/Fire TV.',
    },
  ]);
  const gone = await get(world, { device: 'ext:test-integration:tv:t0000000000' }, 'en');
  assert.equal(gone.components[0].text, 'This TV is no longer in the list of the integration.');
  const gonePress = await world.fake.widgetAction(
    'tv_message',
    'quick_1',
    { tv: 'nope' },
    {
      settings: SETTINGS,
    },
  );
  assert.equal(gonePress.data.message.en, 'This TV is no longer in the list of the integration.');

  // A TV added but not created yet is not shown; once created, it is the default one.
  await addTv(world, { name: 'Bedroom', address: '192.0.2.31', app: 'pipup' });
  assert.equal((await get(world, {})).components[0].type, 'text');
});

test('the default TV is the first created one, with its state unknown at first', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await addAndCreate(world, { name: 'Bedroom', address: '192.0.2.31', app: 'pipup' });
  world.monitor.status.clear();
  const content = await get(world, {}, 'en');
  assert.deepEqual(content.components[0].items[0], {
    label: 'Bedroom',
    icon: 'tv',
    value: 'Not checked yet',
    color: 'neutral',
  });
});
