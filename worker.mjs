import { receiveLead } from './leads.mjs';

// Static Assets supplies the full representation. The Worker serves one byte range for MP4.
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/api/leads') return receiveLead(request, env);
    const { ASSETS } = env;
    if (!path.startsWith('/assets/') || !path.endsWith('.mp4')) return ASSETS.fetch(request);

    const range = request.headers.get('Range');
    const forwarded = new Request(request);
    forwarded.headers.delete('Range');
    forwarded.headers.delete('If-Range');
    forwarded.headers.set('Accept-Encoding', 'identity');
    const file = await ASSETS.fetch(forwarded);
    if (file.status !== 200) return file;

    const headers = new Headers(file.headers);
    headers.set('Accept-Ranges', 'bytes');
    const complete = () => new Response(file.body, { status: 200, headers });
    const match = /^bytes=(\d*)-(\d*)$/i.exec(range ?? '');
    const ifRange = request.headers.get('If-Range');
    const etag = headers.get('ETag');
    const sameVersion = !ifRange || (etag && !etag.startsWith('W/') && ifRange === etag);
    if (request.method !== 'GET' || !match || !sameVersion) return complete();

    const [, first, last] = match;
    if ((!first && !last) || (first && last && Number(first) > Number(last))) return complete();

    const contentLength = headers.get('Content-Length');
    const buffered = /^\d+$/.test(contentLength ?? '') ? null : await file.arrayBuffer();
    const size = buffered?.byteLength ?? Number(contentLength);
    const start = first ? Number(first) : Math.max(0, size - Number(last));
    const end = first && last ? Math.min(size - 1, Number(last)) : size - 1;
    if (start >= size || start > end) {
      if (!buffered) void file.body?.cancel().catch(() => {});
      headers.set('Content-Range', `bytes */${size}`);
      headers.set('Content-Length', '0');
      return new Response(null, { status: 416, headers });
    }

    const length = end - start + 1;
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    headers.set('Content-Length', String(length));
    if (buffered) return new Response(buffered.slice(start, end + 1), { status: 206, headers });

    const reader = file.body.getReader();
    const { readable, writable } = new FixedLengthStream(length);
    let offset = 0;
    const slice = new ReadableStream({
      async pull(controller) {
        while (offset <= end) {
          const { value, done } = await reader.read();
          if (done) {
            controller.error(new Error('MP4 asset ended before the requested range'));
            return;
          }
          const chunkStart = offset;
          offset += value.byteLength;
          if (offset <= start) continue;
          controller.enqueue(value.subarray(Math.max(0, start - chunkStart), end + 1 - chunkStart));
          if (offset > end) {
            controller.close();
            void reader.cancel().catch(() => {});
          }
          return;
        }
      },
      cancel(reason) {
        return reader.cancel(reason);
      }
    });
    void slice.pipeTo(writable).catch(() => {});
    return new Response(readable, { status: 206, headers });
  }
};
