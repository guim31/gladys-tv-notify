// -----------------------------------------------------------------------------
// Configuration normalization: the rest of the code never sees a string, a
// blank or an unknown value.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config.js';

test('defaults when nothing is set', () => {
  assert.deepEqual(normalizeConfig(), { language: 'fr', checkInterval: 30, offlineAfter: 60 });
  assert.deepEqual(normalizeConfig(null), normalizeConfig({}));
  assert.equal(DEFAULT_CONFIG.language, 'fr');
});

test('select values become numbers, unknown values fall back to the default', () => {
  assert.deepEqual(normalizeConfig({ language: 'de', check_interval: '300', offline_after: '0' }), {
    language: 'de',
    checkInterval: 300,
    offlineAfter: 0,
  });
  assert.deepEqual(normalizeConfig({ language: 'it', check_interval: '7', offline_after: 'x' }), {
    language: 'fr',
    checkInterval: 30,
    offlineAfter: 60,
  });
  // A number stored as a number is accepted too.
  assert.equal(normalizeConfig({ check_interval: 60 }).checkInterval, 60);
});
