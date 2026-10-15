// -----------------------------------------------------------------------------
// From the fields of a notification to the request of each app: the field
// names, the value maps and the content types the apps read
// (test/fixtures/apps/README.md says where each one comes from).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ICONS } from '../src/icons.js';
import { sniffImageType } from '../src/image.js';
import {
  COLORS,
  DEFAULTS,
  ICON_KEYS,
  POSITIONS,
  TRANSPARENCIES,
  argb,
  encodeNotification,
  multipart,
  normalizeNotification,
} from '../src/notification.js';
import { SNAPSHOT, parseMultipart } from './helpers/fakeTv.js';

// The payload of Home Assistant's former nfandroidtv platform (test/fixtures/apps).
const HA = JSON.parse(
  readFileSync(
    new URL('./fixtures/apps/nfandroidtv-home-assistant-2021.1.json', import.meta.url),
    'utf8',
  ),
);

const IMAGE = { data: SNAPSHOT, type: 'image/jpeg' };
const FULL = normalizeNotification({
  title: 'Sonnette',
  message: "Quelqu'un sonne à la porte",
  duration: 20,
  position: 'top_left',
  color: 'red',
  transparency: '25',
  icon: 'doorbell',
});

const decode = (request) =>
  request.headers['Content-Type'].startsWith('multipart/')
    ? parseMultipart(request.headers['Content-Type'], request.body)
    : { json: JSON.parse(request.body.toString('utf8')) };

test('normalization: defaults, bounds, unknown options and control characters', () => {
  assert.deepEqual(normalizeNotification({ message: 'Hello' }), {
    title: '',
    message: 'Hello',
    ...DEFAULTS,
    imageUrl: '',
  });
  const odd = normalizeNotification({
    title: '  Line\u0007one ',
    message: 'a\nb\tc',
    duration: '9999',
    position: 'middle',
    color: 'purple',
    transparency: 33,
    icon: 'unicorn',
    image_url: ' http://192.0.2.40/snap.jpg ',
  });
  assert.equal(odd.title, 'Line one');
  assert.equal(odd.message, 'a\nb c');
  assert.equal(odd.duration, 300);
  assert.equal(odd.position, DEFAULTS.position);
  assert.equal(odd.color, DEFAULTS.color);
  assert.equal(odd.transparency, DEFAULTS.transparency);
  assert.equal(odd.icon, DEFAULTS.icon);
  assert.equal(odd.imageUrl, 'http://192.0.2.40/snap.jpg');
  assert.equal(normalizeNotification({ message: 'x', duration: 0 }).duration, 1);
  assert.equal(normalizeNotification({ message: 'x', duration: 'abc' }).duration, 10);
  assert.equal(normalizeNotification({ title: 'Only a title' }).message, '');
  assert.throws(() => normalizeNotification({ title: ' ', message: '' }), { code: 'empty' });
});

test('Notifications for Android TV: the multipart form of notifications-android-tv', () => {
  const request = encodeNotification('nfandroidtv', FULL, IMAGE);
  assert.equal(request.method, 'POST');
  assert.equal(request.path, '/');
  assert.match(
    request.headers['Content-Type'],
    /^multipart\/form-data; boundary=.+; charset=UTF-8$/,
  );
  const { fields, files } = decode(request);
  assert.deepEqual(fields, {
    type: '0',
    title: 'Sonnette',
    msg: "Quelqu'un sonne à la porte",
    duration: '20',
    fontsize: '0',
    position: '3',
    bkgcolor: '#F44336',
    transparency: '2',
    offset: '0',
    app: 'Gladys',
    force: 'true',
    interrupt: '0',
  });
  assert.equal(files.filename.filename, 'icon.png');
  assert.ok(files.filename.data.equals(Buffer.from(ICONS.doorbell.png, 'base64')));
  assert.equal(files.filename2.filename, 'image.jpg');
  assert.ok(files.filename2.data.equals(SNAPSHOT));
});

test('Notifications for Android TV: positions, transparencies, default icon and title', () => {
  const positions = POSITIONS.map(
    (position) =>
      decode(encodeNotification('nfandroidtv', normalizeNotification({ message: 'x', position })))
        .fields.position,
  );
  // bottom-right 0, bottom-left 1, top-right 2, top-left 3, center 4 (the library's map).
  assert.deepEqual(positions, ['0', '1', '2', '3', '4']);
  const transparencies = TRANSPARENCIES.map(
    (transparency) =>
      decode(
        encodeNotification('nfandroidtv', normalizeNotification({ message: 'x', transparency })),
      ).fields.transparency,
  );
  assert.deepEqual(transparencies, ['1', '2', '3', '4', '5']);
  const plain = decode(encodeNotification('nfandroidtv', normalizeNotification({ message: 'x' })));
  assert.equal(plain.fields.title, 'Gladys');
  assert.equal(sniffImageType(plain.files.filename.data), 'image/png');
  assert.equal(plain.files.filename2, undefined);
});

test('PiPup: JSON without a picture, multipart with one', () => {
  const json = encodeNotification('pipup', FULL);
  assert.equal(json.path, '/notify');
  assert.match(json.headers['Content-Type'], /^application\/json/);
  assert.deepEqual(decode(json).json, {
    duration: 20,
    position: 1,
    backgroundColor: '#bff44336',
    title: 'Sonnette',
    message: "Quelqu'un sonne à la porte",
  });
  const form = decode(encodeNotification('pipup', FULL, IMAGE));
  assert.deepEqual(form.fields, {
    duration: '20',
    position: '1',
    backgroundColor: '#bff44336',
    title: 'Sonnette',
    message: "Quelqu'un sonne à la porte",
    imageWidth: '480',
  });
  assert.equal(form.files.image.type, 'image/jpeg');
  assert.ok(form.files.image.data.equals(SNAPSHOT));
  // PiPup's own order: TopRight 0, TopLeft 1, BottomRight 2, BottomLeft 3, Center 4.
  const positions = POSITIONS.map(
    (position) =>
      decode(encodeNotification('pipup', normalizeNotification({ message: 'x', position }))).json
        .position,
  );
  assert.deepEqual(positions, [2, 3, 0, 1, 4]);
  // No title: none sent.
  assert.equal(
    decode(encodeNotification('pipup', normalizeNotification({ message: 'x' }))).json.title,
    undefined,
  );
});

test('PiPup background: #AARRGGBB from the color and the transparency', () => {
  assert.equal(argb('black', '0'), '#ff000000');
  assert.equal(argb('grey', '50'), '#80607d8b');
  assert.equal(argb('pink', '100'), '#00e91e63');
});

test('TvOverlay: JSON with corner, MDI icon and base64 picture', () => {
  const request = encodeNotification('tvoverlay', FULL, IMAGE);
  assert.equal(request.path, '/notify');
  const { json } = decode(request);
  assert.deepEqual(
    { ...json, image: json.image.slice(0, 8) },
    {
      title: 'Sonnette',
      message: "Quelqu'un sonne à la porte",
      source: 'Gladys',
      duration: 20,
      corner: 'top_start',
      largeIcon: 'mdi:doorbell',
      image: SNAPSHOT.toString('base64').slice(0, 8),
    },
  );
  assert.ok(Buffer.from(json.image, 'base64').equals(SNAPSHOT));
  // The center is left to the app's hot corner; no icon, no picture: no key.
  const centered = decode(
    encodeNotification('tvoverlay', normalizeNotification({ message: 'x', position: 'center' })),
  ).json;
  assert.deepEqual(centered, { message: 'x', source: 'Gladys', duration: 10 });
});

test('every icon option is a 96 x 96 PNG with its MDI name', () => {
  assert.deepEqual(ICON_KEYS, ['none', ...Object.keys(ICONS)]);
  for (const [key, icon] of Object.entries(ICONS)) {
    const png = Buffer.from(icon.png, 'base64');
    assert.equal(sniffImageType(png), 'image/png', key);
    assert.equal(png.readUInt32BE(16), 96, `${key} width`);
    assert.equal(png.readUInt32BE(20), 96, `${key} height`);
    assert.match(icon.mdi, /^[a-z-]+$/, key);
  }
});

test('Notifications for Android TV: the payload of Home Assistant, field for field', () => {
  const { fields, files } = decode(encodeNotification('nfandroidtv', FULL, IMAGE));
  assert.deepEqual(
    [...Object.keys(files).filter((name) => name === 'filename'), ...Object.keys(fields)],
    HA.payload_keys,
  );
  for (const [key, value] of Object.entries(HA.constants)) {
    assert.equal(fields[key], value, key);
  }
  assert.equal(files.filename.filename, HA.icon_part.filename);
  assert.equal(files.filename.type, HA.icon_part.type);
  assert.equal(files.filename2.type, HA.image_part.type);
  assert.deepEqual(COLORS, HA.colors);
  const positions = Object.fromEntries(
    POSITIONS.map((position) => [
      position.replace('_', '-'),
      Number(
        decode(encodeNotification('nfandroidtv', normalizeNotification({ message: 'x', position })))
          .fields.position,
      ),
    ]),
  );
  assert.deepEqual(positions, HA.positions);
  const transparencies = Object.fromEntries(
    TRANSPARENCIES.map((transparency) => [
      `${transparency}%`,
      Number(
        decode(
          encodeNotification('nfandroidtv', normalizeNotification({ message: 'x', transparency })),
        ).fields.transparency,
      ),
    ]),
  );
  // HA's "default" (0) leaves the app's own setting: every option here is explicit.
  const { default: _default, ...explicit } = HA.transparencies;
  assert.deepEqual(transparencies, explicit);
  assert.equal(fields.fontsize, String(HA.fontsizes.medium));
});

test('multipart: text and files round-trip, UTF-8 kept', () => {
  const { contentType, body } = multipart(
    [
      { name: 'msg', value: 'Grüße, ¿qué tal? 😀' },
      { name: 'file', filename: 'a.bin', data: Buffer.from([0, 13, 10, 45, 45]) },
    ],
    'XyZ',
  );
  assert.equal(contentType, 'multipart/form-data; boundary=XyZ; charset=UTF-8');
  const { fields, files } = parseMultipart(contentType, body);
  assert.equal(fields.msg, 'Grüße, ¿qué tal? 😀');
  assert.deepEqual([...files.file.data], [0, 13, 10, 45, 45]);
});

test('an unknown app is a programming error', () => {
  assert.throws(() => encodeNotification('smart-fridge', FULL), /Unknown app/);
});
