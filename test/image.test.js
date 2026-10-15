// -----------------------------------------------------------------------------
// The picture download, against a fake camera on the loopback interface:
// no authentication, Basic, Digest (with the Basic challenge next to it, as
// Hikvision cameras send), wrong credentials, not an image, too large, gone.
// And the URLs written to the logs never carry the credentials.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactUrl } from '../src/http.js';
import { MAX_IMAGE_BYTES, fetchImage, parseImageUrl, sniffImageType } from '../src/image.js';
import { SNAPSHOT, createFakeCamera } from './helpers/fakeTv.js';

async function camera(t, options) {
  const fake = await createFakeCamera(options);
  t.after(() => fake.stop());
  return fake;
}

test('a snapshot without authentication', async (t) => {
  const cam = await camera(t);
  const image = await fetchImage(cam.url());
  assert.equal(image.type, 'image/jpeg');
  assert.ok(image.data.equals(SNAPSHOT));
  assert.equal(cam.requests.length, 1);
});

test('Basic authentication from the credentials of the URL', async (t) => {
  const cam = await camera(t, { auth: 'basic' });
  const image = await fetchImage(cam.url('/snapshot.jpg', 'viewer:s3cret-pass'));
  assert.ok(image.data.equals(SNAPSHOT));
  // First without, then with the answer to the challenge.
  assert.deepEqual(
    cam.requests.map((r) => r.authorization?.split(' ')[0] ?? null),
    [null, 'Basic'],
  );
});

test('Digest authentication, preferred to the Basic challenge sent next to it', async (t) => {
  const cam = await camera(t, { auth: 'digest' });
  const image = await fetchImage(cam.url('/snapshot.jpg?channel=1', 'viewer:s3cret-pass'));
  assert.ok(image.data.equals(SNAPSHOT));
  const [, answer] = cam.requests;
  assert.match(answer.authorization, /^Digest username="viewer", realm="IP Camera"/);
  assert.match(answer.authorization, /uri="\/snapshot.jpg\?channel=1"/);
  assert.doesNotMatch(answer.authorization, /s3cret/);
});

test('encoded characters of a password are decoded', async (t) => {
  const cam = await camera(t, { auth: 'basic', password: 'p@ss:w/rd' });
  const image = await fetchImage(
    cam.url('/snapshot.jpg', `viewer:${encodeURIComponent('p@ss:w/rd')}`),
  );
  assert.ok(image.data.equals(SNAPSHOT));
});

test('wrong or missing credentials, a 404, a page that is not an image', async (t) => {
  const cam = await camera(t, { auth: 'digest' });
  await assert.rejects(fetchImage(cam.url('/snapshot.jpg', 'viewer:wrong')), { code: 'auth' });
  await assert.rejects(fetchImage(cam.url()), { code: 'auth' });
  await assert.rejects(fetchImage(cam.url('/other.jpg', 'viewer:s3cret-pass')), {
    code: 'status',
  });
  const page = await camera(t, {
    body: Buffer.from('<html>login</html>'),
    contentType: 'text/html',
  });
  await assert.rejects(fetchImage(page.url()), { code: 'type' });
});

test('the bytes decide, not the announced type', async (t) => {
  const cam = await camera(t, { contentType: 'text/plain' });
  assert.equal((await fetchImage(cam.url())).type, 'image/jpeg');
});

test('a picture too large is refused', async (t) => {
  const huge = Buffer.concat([SNAPSHOT, Buffer.alloc(MAX_IMAGE_BYTES)]);
  const cam = await camera(t, { body: huge });
  await assert.rejects(fetchImage(cam.url()), { code: 'tooLarge' });
});

test('a camera that does not answer, an invalid URL', async (t) => {
  const cam = await camera(t);
  const url = cam.url();
  await cam.stop();
  await assert.rejects(fetchImage(url), { code: 'unreachable' });
  await assert.rejects(fetchImage('ftp://192.0.2.40/snap.jpg'), { code: 'url' });
  await assert.rejects(fetchImage('not a url'), { code: 'url' });
  await assert.rejects(fetchImage(''), { code: 'url' });
});

test('the credentials are taken out of the URL', () => {
  const parsed = parseImageUrl('http://admin:pa%24s@192.0.2.40:8080/cgi-bin/snap.cgi?x=1');
  assert.equal(parsed.username, 'admin');
  assert.equal(parsed.password, 'pa$s');
  assert.equal(parsed.url.href, 'http://192.0.2.40:8080/cgi-bin/snap.cgi?x=1');
});

test('a URL written to the logs has neither credentials nor query string', () => {
  assert.equal(
    redactUrl('http://admin:secret@192.0.2.40/cgi-bin/api.cgi?cmd=Snap&user=admin&password=secret'),
    'http://***@192.0.2.40/cgi-bin/api.cgi?…',
  );
  assert.equal(redactUrl('https://192.0.2.40/snap.jpg'), 'https://192.0.2.40/snap.jpg');
  assert.equal(redactUrl('nope'), '(invalid URL)');
});

test('image types are recognized by their first bytes', () => {
  assert.equal(sniffImageType(SNAPSHOT), 'image/jpeg');
  assert.equal(sniffImageType(Buffer.from('GIF89a......')), 'image/gif');
  assert.equal(sniffImageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ')), 'image/webp');
  assert.equal(sniffImageType(Buffer.from('<!doctype html>')), null);
});
