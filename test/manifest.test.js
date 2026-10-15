// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers or which option values the code
// maps — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CHECK_INTERVALS, DEFAULT_CONFIG, LANGUAGES, OFFLINE_DELAYS } from '../src/config.js';
import { WIDGET_KEY } from '../src/monitor.js';
import {
  COLORS,
  DEFAULTS,
  DURATION,
  ICON_KEYS,
  POSITIONS,
  TRANSPARENCIES,
} from '../src/notification.js';
import { SCENE_ACTIONS } from '../src/scenes.js';
import { APP_KEYS } from '../src/tvs.js';
import { QUICK_KEYS, WIDGETS } from '../src/widgets.js';
import { createFakeTv } from './helpers/fakeTv.js';
import { addAndCreate, createWorld } from './helpers/world.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

// Every list of form fields the manifest can declare (same field grammar).
const allFields = [
  ...(manifest.config_schema ?? []),
  ...[
    ...(manifest.actions ?? []),
    ...(manifest.scene_triggers ?? []),
    ...(manifest.scene_actions ?? []),
  ].flatMap((item) => item.fields ?? []),
  ...(manifest.widgets ?? []).flatMap((widget) => widget.settings ?? []),
];

// The handlers the integration actually registers on the SDK.
const { gladys: registered, app } = await createWorld({ connect: false });
await app.stop();
const handlerKeys = (prefix) =>
  Object.keys(registered.handlers)
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length));

const keysOf = (list) => (list ?? []).map((entry) => entry.key);
const optionValues = (field) => field.options.map((option) => option.value);
const field = (list, key) => list.find((entry) => entry.key === key);

function minGladysVersion() {
  const match = manifest.gladys_version.match(/>=\s*(\d+)\.(\d+)\.(\d+)/);
  assert.ok(match, 'gladys_version must declare a minimum version');
  return match.slice(1).map(Number);
}

test('identity: name, image, cover, local transport, categories', () => {
  assert.equal(manifest.name, 'Notifications Android/Fire TV');
  assert.ok(manifest.name.length >= 3 && manifest.name.length <= 30);
  assert.equal(manifest.type, 'device');
  assert.match(manifest.docker_image, /^ghcr\.io\/guim31\/gladys-tv-notify:/);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/guim31/gladys-tv-notify/main/cover.png',
  );
  assert.deepEqual(manifest.transports, ['local']);
  assert.deepEqual(manifest.categories, ['notifications', 'multimedia']);
  // Nothing the code does not use: no mediated discovery, no Wake-on-LAN, no houses.
  for (const key of ['network_discovery', 'network_wake', 'location', 'scene_triggers']) {
    assert.equal(manifest[key], undefined, key);
  }
});

test('Gladys 5.2.0 at least: the form behind the widget button (#3168)', () => {
  const [major, minor] = minGladysVersion();
  assert.ok(major > 5 || (major === 5 && minor >= 2), manifest.gladys_version);
});

test('every manifest action has a handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.actions).sort(), handlerKeys('action:').sort());
});

test('every scene action has a handler, and its outputs are the declared ones', async (t) => {
  assert.deepEqual(keysOf(manifest.scene_actions), Object.keys(SCENE_ACTIONS));
  assert.deepEqual(handlerKeys('sceneAction:'), keysOf(manifest.scene_actions));
  const tv = await createFakeTv('pipup');
  t.after(() => tv.stop());
  const world = await createWorld();
  t.after(() => world.app.stop());
  const device = await addAndCreate(world, tv.fields());
  const [action] = manifest.scene_actions;
  const ack = await world.fake.sceneAction(action.key, {
    device: device.external_id,
    message: 'Hello',
  });
  assert.equal(ack.success, true);
  assert.deepEqual(Object.keys(ack.data.outputs), keysOf(action.outputs));
  // "Continue only if" compares with ===: numbers, never booleans.
  for (const output of action.outputs) {
    assert.notEqual(output.type, 'boolean', output.key);
  }
});

test('the scene action options are the values the code maps', () => {
  const fields = manifest.scene_actions[0].fields;
  assert.deepEqual(keysOf(fields), [
    'device',
    'title',
    'message',
    'duration',
    'position',
    'color',
    'transparency',
    'icon',
    'image_url',
  ]);
  assert.ok(fields.length <= 10, 'the core accepts 10 fields at most');
  assert.deepEqual(optionValues(field(fields, 'position')), POSITIONS);
  assert.deepEqual(optionValues(field(fields, 'color')), Object.keys(COLORS));
  assert.deepEqual(optionValues(field(fields, 'transparency')), TRANSPARENCIES);
  assert.deepEqual(optionValues(field(fields, 'icon')), ICON_KEYS);
  for (const key of ['position', 'color', 'transparency', 'icon']) {
    assert.equal(field(fields, key).default, DEFAULTS[key], key);
  }
  const duration = field(fields, 'duration');
  assert.deepEqual(
    [duration.min, duration.max, duration.default],
    [DURATION.min, DURATION.max, DURATION.default],
  );
  // The texts accept scene variables: string fields.
  for (const key of ['title', 'message', 'image_url']) {
    assert.equal(field(fields, key).type, 'string', key);
  }
  // No secret anywhere in a scene (its JSON is readable by every user).
  assert.ok(fields.every((entry) => entry.type !== 'secret'));
});

test('every widget has its handlers, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.widgets), [WIDGET_KEY]);
  assert.deepEqual(Object.keys(WIDGETS), [WIDGET_KEY]);
  assert.deepEqual(handlerKeys('widget:'), [WIDGET_KEY]);
  assert.deepEqual(handlerKeys('widgetAction:'), [WIDGET_KEY]);
  assert.deepEqual(keysOf(manifest.widgets[0].settings), ['device', ...QUICK_KEYS]);
});

test('config_schema defaults and options are the ones of the code', () => {
  for (const entry of manifest.config_schema) {
    if (entry.default !== undefined) {
      assert.equal(DEFAULT_CONFIG[entry.key], entry.default, entry.key);
    }
  }
  assert.deepEqual(
    Object.keys(DEFAULT_CONFIG).sort(),
    manifest.config_schema
      .filter((entry) => entry.type !== 'section')
      .map((entry) => entry.key)
      .sort(),
  );
  assert.equal(DEFAULT_CONFIG.language, 'fr');
  assert.deepEqual(optionValues(field(manifest.config_schema, 'language')), LANGUAGES);
  assert.deepEqual(optionValues(field(manifest.config_schema, 'check_interval')), CHECK_INTERVALS);
  assert.deepEqual(optionValues(field(manifest.config_schema, 'offline_after')), OFFLINE_DELAYS);
  const addFields = field(manifest.actions, 'add_tv').fields;
  assert.deepEqual(optionValues(field(addFields, 'app')), APP_KEYS);
});

test('section fields are purely presentational, their links https', () => {
  for (const section of manifest.config_schema.filter((entry) => entry.type === 'section')) {
    assert.equal(section.required, undefined);
    assert.equal(section.default, undefined);
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//);
    }
  }
});

test('dynamic selects declare the devices source and no static options', () => {
  const dynamic = allFields.filter((entry) => entry.source !== undefined);
  assert.equal(dynamic.length, 3);
  for (const entry of dynamic) {
    assert.equal(entry.source, 'devices');
    assert.equal(entry.options, undefined, entry.key);
  }
});

test('number fields have integer bounds (the form has no step)', () => {
  for (const entry of allFields.filter((f) => f.type === 'number')) {
    for (const key of ['min', 'max', 'default']) {
      if (entry[key] !== undefined) {
        assert.ok(Number.isInteger(entry[key]), `${entry.key}.${key}`);
      }
    }
  }
});

test('actions: no secret field, no default (the core applies none to actions)', () => {
  // GladysAssistant/Gladys#3154 and #3155.
  for (const action of manifest.actions) {
    for (const entry of action.fields ?? []) {
      assert.notEqual(entry.type, 'secret', `${action.key}.${entry.key}`);
      assert.equal(entry.default, undefined, `${action.key}.${entry.key}`);
    }
  }
});

test('no secret in the configuration either: nothing to protect', () => {
  assert.ok(allFields.every((entry) => entry.type !== 'secret'));
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version);
  assert.ok(manifest.docker_image.endsWith(`:${manifest.version}`));
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${lang}: ${text.length}`);
  }
});
