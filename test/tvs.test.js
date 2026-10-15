// -----------------------------------------------------------------------------
// What the user types in "Add or update a TV": addresses, apps, ports, names.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findTv, normalizeAddress, parseTvFields, restoreTv } from '../src/tvs.js';

test('addresses: IPv4, host names, pasted URLs; mistakes refused', () => {
  assert.equal(normalizeAddress(' 192.0.2.30 '), '192.0.2.30');
  assert.equal(normalizeAddress('http://192.0.2.30:7676/'), '192.0.2.30');
  assert.equal(normalizeAddress('Shield.Example.org'), 'shield.example.org');
  assert.equal(normalizeAddress('192.0.2'), null);
  assert.equal(normalizeAddress('192.0.2.300'), null);
  assert.equal(normalizeAddress('my tv'), null);
  assert.equal(normalizeAddress(42), null);
});

test('each app gets its own port unless one is given', () => {
  const base = { name: 'TV', address: '192.0.2.30' };
  assert.equal(parseTvFields({ ...base, app: 'nfandroidtv' }).tv.port, 7676);
  assert.equal(parseTvFields({ ...base, app: 'pipup' }).tv.port, 7979);
  assert.equal(parseTvFields({ ...base, app: 'tvoverlay' }).tv.port, 5001);
  assert.equal(parseTvFields({ ...base, app: 'tvoverlay', port: '5002' }).tv.port, 5002);
  // The action applies no default: no app means the most common one.
  assert.equal(parseTvFields(base).tv.app, 'nfandroidtv');
  assert.equal(parseTvFields({ ...base, port: '' }).tv.port, 7676);
});

test('mistakes are named', () => {
  assert.deepEqual(parseTvFields({ name: ' ', address: '192.0.2.30' }), { error: 'name' });
  assert.deepEqual(parseTvFields({ name: 'x'.repeat(61), address: '192.0.2.30' }), {
    error: 'nameLength',
  });
  assert.deepEqual(parseTvFields({ name: 'TV', address: 'nope!' }), {
    error: 'address',
    param: 'nope!',
  });
  assert.deepEqual(parseTvFields({ name: 'TV', address: 'tv.local' }), {
    error: 'mdns',
    param: 'tv.local',
  });
  assert.deepEqual(parseTvFields({ name: 'TV', address: '192.0.2.30', port: 0 }), {
    error: 'port',
    param: '0',
  });
  assert.equal(
    parseTvFields({ name: '  Living   room ', address: '192.0.2.30' }).tv.name,
    'Living room',
  );
});

test('a TV read back from /data keeps its id; a broken entry is dropped', () => {
  assert.deepEqual(
    restoreTv({ id: 'tabc', name: 'TV', address: '192.0.2.30', app: 'pipup', port: 7979 }),
    { id: 'tabc', name: 'TV', address: '192.0.2.30', app: 'pipup', port: 7979 },
  );
  assert.equal(restoreTv({ id: '', name: 'TV', address: '192.0.2.30' }), null);
  assert.equal(restoreTv({ id: 'tabc', name: 'TV', address: 'bad address' }), null);
  assert.equal(restoreTv(null), null);
});

test('a TV is found by its name (any case) or its address', () => {
  const tvs = [
    { id: 'a', name: 'Salon', address: '192.0.2.30' },
    { id: 'b', name: 'Chambre', address: '192.0.2.31' },
  ];
  assert.equal(findTv(tvs, 'salon').id, 'a');
  assert.equal(findTv(tvs, '192.0.2.31').id, 'b');
  assert.equal(findTv(tvs, 'Kitchen'), undefined);
  assert.equal(findTv(tvs, ''), undefined);
});
