import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './worker.mjs';

globalThis.FixedLengthStream = class extends TransformStream {
  constructor(length) {
    let written = 0;
    super({
      transform(chunk, controller) {
        written += chunk.byteLength;
        controller.enqueue(chunk);
      },
      flush() {
        assert.equal(written, length);
      }
    });
  }
};
const bytes = Uint8Array.from({ length: 16 }, (_, index) => index);
const url = 'https://example.test/assets/Aradinho%20Motorizado/hero.mp4.mp4?v=1';

async function request(headers = {}, { method = 'GET', contentLength = true } = {}) {
  return worker.fetch(new Request(url, { method, headers }), {
    ASSETS: {
      fetch(forwarded) {
        assert.equal(forwarded.headers.has('Range'), false);
        assert.equal(forwarded.headers.has('If-Range'), false);
        const source = new Headers({ ETag: '"asset"', 'Content-Type': 'video/mp4' });
        if (contentLength) source.set('Content-Length', String(bytes.length));
        const chunks = new ReadableStream({
          start(controller) {
            controller.enqueue(bytes.subarray(0, 6));
            controller.enqueue(bytes.subarray(6, 12));
            controller.enqueue(bytes.subarray(12));
            controller.close();
          }
        });
        return new Response(method === 'HEAD' ? null : chunks, { headers: source });
      }
    }
  });
}

test('serves explicit, open-ended, suffix and clamped ranges with the exact MP4 bytes', async () => {
  for (const [header, start, end] of [['0-1', 0, 1], ['4-8', 4, 8], ['9-', 9, 15],
    ['-3', 13, 15], ['12-99', 12, 15], ['-99', 0, 15]]) {
    for (const contentLength of [true, false]) {
      const response = await request({ Range: `bytes=${header}` }, { contentLength });
      assert.equal(response.status, 206);
      assert.equal(response.headers.get('Content-Range'), `bytes ${start}-${end}/16`);
      assert.equal(Number(response.headers.get('Content-Length')), end - start + 1);
      assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes.slice(start, end + 1));
    }
  }
});

test('handles unsatisfiable ranges, unchanged HEAD and If-Range validators', async () => {
  for (const range of ['bytes=16-', 'bytes=-0']) {
    const response = await request({ Range: range });
    assert.equal(response.status, 416);
    assert.equal(response.headers.get('Content-Range'), 'bytes */16');
  }
  const head = await request({ Range: 'bytes=0-1' }, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('Accept-Ranges'), 'bytes');
  assert.equal(head.headers.get('Content-Length'), '16');
  assert.equal(head.body, null);
  for (const headers of [
    { Range: 'bytes=0-1', 'If-Range': '"old"' },
    { Range: 'bytes=8-4' },
    { Range: 'bytes=0-1,4-8' }
  ]) {
    const response = await request(headers);
    assert.equal(response.status, 200);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  }
  const conditional = await request({ Range: 'bytes=0-1', 'If-Range': '"asset"' });
  assert.equal(conditional.status, 206);
  await conditional.arrayBuffer();
});
