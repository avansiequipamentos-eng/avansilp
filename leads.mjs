import './content.js';

const { equipment, additionalEquipment } = globalThis.AVANSI_CONTENT;
const products = new Map([...equipment, ...additionalEquipment].map(({ id, title }) => [id, title]));
const supabase = 'https://lixvtyqlwhttdduwyrwp.supabase.co';
const maxBody = 8192;
const states = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));

function error(status, code, headers) {
  return Response.json({ ok: false, code }, {
    status, headers: { 'Cache-Control': 'no-store', ...headers }
  });
}

async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return;
  const buffer = new Uint8Array(maxBody);
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, size)));
    if (size + value.length > maxBody) {
      void reader.cancel().catch(() => {});
      throw new RangeError();
    }
    buffer.set(value, size);
    size += value.length;
  }
}

function normalizeLead(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return;
  const { id, nome, telefone, cidade, mensagem, equipamento, website } = data;
  if ([id, nome, telefone, cidade, mensagem, equipamento, website].some(value => typeof value !== 'string')) return;
  if (website !== '' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)) return;
  const name = nome.trim().replace(/\s+/g, ' ');
  const location = cidade.trim();
  const notes = mensagem.trim();
  if (name.length < 2 || name.length > 120 || location.length > 120 || notes.length > 1500) return;
  if (!/^[+\d\s().-]{8,25}$/.test(telefone.trim())) return { invalidPhone: true };
  const digits = telefone.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (!/^[1-9]\d(?:9\d{8}|[2-5]\d{7})$/.test(digits)) return { invalidPhone: true };
  if (equipamento && !products.has(equipamento)) return;
  const cityUF = /^(.+?)(?:\s*[/,–-]\s*|\s+)([a-z]{2})$/i.exec(location);
  const state = cityUF?.[2].toUpperCase();
  const hasState = states.has(state);
  return {
    p_id: id, p_name: name, p_whatsapp: '55' + digits,
    p_city: (hasState ? cityUF[1].trim() : location) || null,
    p_state: hasState ? state : null,
    p_notes: notes || null,
    p_service: products.get(equipamento) ?? null,
  };
}

export async function receiveLead(request, env) {
  if (request.method !== 'POST') return error(405, 'method', { Allow: 'POST' });
  if (request.headers.get('Origin') !== new URL(request.url).origin) return error(403, 'origin');
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') ?? '')) return error(415, 'format');
  if (Number(request.headers.get('Content-Length')) > maxBody) return error(413, 'size');

  try {
    const client = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const { success } = await env.LP_LEAD_LIMIT.limit({ key: client });
    if (!success) return error(429, 'rate', { 'Retry-After': '60' });
  } catch {
    return error(503, 'unavailable');
  }

  let body;
  try {
    body = await readBody(request);
  } catch (cause) {
    return cause instanceof RangeError ? error(413, 'size') : error(400, 'fields');
  }
  const lead = normalizeLead(body);
  if (!lead) return error(400, 'fields');
  if (lead.invalidPhone) return error(400, 'phone');
  if (!env.AVANSI_LP_INGEST_SECRET || !env.SUPABASE_PUBLISHABLE_KEY) return error(503, 'unavailable');

  try {
    const saved = await fetch(`${supabase}/rest/v1/rpc/receive_avansi_lp_lead`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        'x-avansi-lp-secret': env.AVANSI_LP_INGEST_SECRET,
      },
      body: JSON.stringify(lead)
    });
    if (saved.status === 409) return error(409, 'conflict');
    if (!saved.ok || await saved.json() !== true) return error(502, 'unavailable');
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return error(502, 'unavailable');
  }
}
