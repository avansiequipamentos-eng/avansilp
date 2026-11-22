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
const formUrl = 'https://example.test/api/leads';
const fixture = {
  id: 'b9e7afbe-6e1f-4d24-bf61-f72e7b45cd03', nome: 'Homologação AVANSI',
  telefone: '(44) 99999-0000', cidade: 'Jesuítas / PR', mensagem: 'Consulta de teste',
  equipamento: 'enleirador-avs1500', website: ''
};
const formEnv = {
  SUPABASE_PUBLISHABLE_KEY: 'fixture-test',
  AVANSI_LP_INGEST_SECRET: 'fixture-test',
  LP_LEAD_LIMIT: { limit: async () => ({ success: true }) }
};
const formRequest = (body, origin = 'https://example.test') => worker.fetch(new Request(formUrl, {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
}), formEnv);

test('rejects cross-origin, invalid, honeypot, oversized and rate-limited submissions before CRM', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', () => assert.fail('Unexpected CRM request'));
  assert.equal((await worker.fetch(new Request(formUrl), formEnv)).status, 405);
  assert.equal((await formRequest(fixture, 'https://external.test')).status, 403);
  assert.deepEqual(await (await formRequest({ ...fixture, telefone: '12345678' })).json(), { ok: false, code: 'phone' });
  assert.equal((await formRequest({ ...fixture, equipamento: 'not-in-catalog' })).status, 400);
  assert.equal((await formRequest({ ...fixture, website: 'spam' })).status, 400);
  assert.equal((await formRequest({ ...fixture, mensagem: 'x'.repeat(9000) })).status, 413);
  t.mock.method(formEnv.LP_LEAD_LIMIT, 'limit', async () => ({ success: false }));
  const limited = await formRequest(fixture);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '60');
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('forwards normalized lead once per request with its original ID and reports CRM failures', async (t) => {
  const saved = t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.match(url, /supabase\.co\/rest\/v1\/rpc\/receive_avansi_lp_lead$/);
    assert.equal(init.headers['x-avansi-lp-secret'], 'fixture-test');
    const payload = JSON.parse(init.body);
    assert.deepEqual(payload, {
      p_id: fixture.id, p_name: fixture.nome, p_whatsapp: '5544999990000',
      p_city: 'Jesuítas', p_state: 'PR', p_notes: fixture.mensagem, p_service: 'Enleirador de Cama AVS1500'
    });
    return Response.json(true);
  });
  const response = await formRequest(fixture);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(saved.mock.callCount(), 1);
  saved.mock.mockImplementation(async () => Response.json({ message: 'internal details' }, { status: 500 }));
  const failed = await formRequest(fixture);
  assert.equal(failed.status, 502);
  assert.deepEqual(await failed.json(), { ok: false, code: 'unavailable' });
  saved.mock.mockImplementation(async () => Response.json({}, { status: 409 }));
  assert.equal((await formRequest(fixture)).status, 409);
});

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
