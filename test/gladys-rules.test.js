// -----------------------------------------------------------------------------
// Conformity with the Gladys core, on every device discovered from realistic
// inputs: TVs of the three apps, with and without a custom port, addresses and
// host names, in every feature-name language.
//
// The table (test/fixtures/gladys-feature-table.json) is extracted from the
// core code: a category/type couple missing there shows as "undefined" or
// without icon in Gladys, a poll frequency outside its list is a 400 on
// discovery, a feature without min/max is a 422 on "Add to Gladys".
// Do not loosen this test to make it pass: fix the integration.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LANGUAGES } from '../src/config.js';
import { addTv, createWorld } from './helpers/world.js';

const table = JSON.parse(
  await readFile(new URL('./fixtures/gladys-feature-table.json', import.meta.url), 'utf8'),
);

const TVS = [
  { name: 'Living room TV', address: '192.0.2.30', app: 'nfandroidtv' },
  { name: 'Fire TV Stick', address: '192.0.2.31', app: 'nfandroidtv', port: 7676 },
  { name: 'Shield', address: 'shield.example.org', app: 'pipup' },
  { name: 'Bedroom', address: '192.0.2.33', app: 'tvoverlay', port: 5002 },
];

for (const language of LANGUAGES) {
  test(`every discovered device follows the Gladys rules (${language} names)`, async (t) => {
    const world = await createWorld({ config: { language } });
    t.after(() => world.app.stop());
    for (const fields of TVS) {
      await addTv(world, fields);
    }
    const devices = world.fake.discoveredDevices;
    assert.equal(devices.length, TVS.length);

    const deviceIds = new Set();
    for (const device of devices) {
      const where = device.name;
      assert.ok(!deviceIds.has(device.external_id), `${where}: duplicate device external_id`);
      deviceIds.add(device.external_id);

      // should_poll: true if and only if poll_frequency is provided, in ms.
      if (device.poll_frequency === undefined) {
        assert.notEqual(device.should_poll, true, `${where}: should_poll without poll_frequency`);
      } else {
        assert.equal(device.should_poll, true, `${where}: poll_frequency without should_poll`);
        assert.ok(
          table.poll_frequencies_ms.includes(device.poll_frequency),
          `${where}: poll_frequency ${device.poll_frequency} is not one of ${table.poll_frequencies_ms}`,
        );
      }

      assert.ok(device.features.length > 0, `${where}: no feature`);
      const externalIds = new Set();
      const names = new Set();
      for (const feature of device.features) {
        const at = `${where} / ${feature.name}`;
        const pair = table.pairs[`${feature.category}/${feature.type}`];
        assert.ok(pair, `${at}: ${feature.category}/${feature.type} is not a couple Gladys knows`);
        assert.ok(
          pair.label_en && pair.label_fr && pair.icon,
          `${at}: couple without label or icon`,
        );

        assert.equal(typeof feature.min, 'number', `${at}: min must be a number`);
        assert.equal(typeof feature.max, 'number', `${at}: max must be a number`);
        assert.ok(
          Number.isFinite(feature.min) && Number.isFinite(feature.max),
          `${at}: finite min/max`,
        );
        assert.ok(feature.min <= feature.max, `${at}: min > max`);
        assert.equal(typeof feature.read_only, 'boolean', `${at}: read_only must be a boolean`);
        assert.equal(
          typeof feature.has_feedback,
          'boolean',
          `${at}: has_feedback must be a boolean`,
        );
        if (feature.unit !== undefined) {
          assert.ok(table.units.includes(feature.unit), `${at}: unknown unit ${feature.unit}`);
        }

        assert.ok(!externalIds.has(feature.external_id), `${at}: duplicate external_id`);
        assert.ok(!deviceIds.has(feature.external_id), `${at}: external_id of a device`);
        externalIds.add(feature.external_id);
        assert.ok(!names.has(feature.name), `${at}: duplicate feature name on the device`);
        names.add(feature.name);
      }
    }
  });
}

test('external ids are built from the stable TV id, never from a label', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await addTv(world, TVS[0]);
  const [before] = world.fake.discoveredDevices;
  assert.match(before.external_id, /^ext:test-integration:tv:t[0-9a-f]{10}$/);
  // Renaming, readdressing or changing the app keeps the device.
  await addTv(world, { ...TVS[0], name: 'Salon', app: 'tvoverlay' });
  await addTv(world, { name: 'Salon', address: '192.0.2.99', app: 'tvoverlay' });
  assert.equal(world.fake.discoveredDevices.length, 1);
  assert.equal(world.fake.discoveredDevices[0].external_id, before.external_id);
  assert.equal(
    world.fake.discoveredDevices[0].features[0].external_id,
    `${before.external_id}:reachable`,
  );
});
