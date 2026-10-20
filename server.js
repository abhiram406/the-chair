// The Chair: a tiny server for the CEO/CTO simulator.
//
// What it does:
//   1. Serves the game (public/index.html) to anyone who visits.
//   2. Receives AI requests from the game at POST /api/llm and forwards them to an
//      "OpenAI-compatible" provider (Groq by default). The API key stays here on the
//      server, so visitors never see it.
//
// Needs Node.js 18 or newer. No packages to install.

'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

loadDotEnv(path.join(__dirname, '.env'));

const PORT = Number(process.env.PORT) || 3000;
const API_KEY = process.env.LLM_API_KEY || process.env.GROQ_API_KEY || '';
const BASE_URL = (process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
const MODEL = process.env.LLM_MODEL || 'openai/gpt-oss-120b';
const QUICK_MODEL = process.env.LLM_QUICK_MODEL || MODEL;
const REASONING_EFFORT = process.env.LLM_REASONING_EFFORT ?? 'low';   // set to empty to never send it
const JSON_MODE = process.env.LLM_JSON_MODE !== 'false';
const MAX_TOKENS = Number(process.env.LLM_MAX_TOKENS) || 4096;
const TEMPERATURE = process.env.LLM_TEMPERATURE === undefined ? 0.8 : Number(process.env.LLM_TEMPERATURE);
const PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE) || 6;
const PER_DAY = Number(process.env.RATE_LIMIT_PER_DAY) || 150;
const ACCESS_CODE = process.env.ACCESS_CODE || '';
const MAX_BODY = 200 * 1024;

const INDEX_PATH = path.join(__dirname, 'public', 'index.html');

// ---------- Per-visitor rate limiting (protects your free quota) ----------
const hits = new Map();
function allow(ip){
  const now = Date.now();
  let h = hits.get(ip);
  if (!h || now - h.dayStart > 86400000) h = { dayStart: now, day: 0, recent: [] };
  h.recent = h.recent.filter(t => now - t < 60000);
  if (h.recent.length >= PER_MINUTE || h.day >= PER_DAY){ hits.set(ip, h); return false; }
  h.recent.push(now); h.day++; hits.set(ip, h);
  return true;
}
setInterval(() => { const now = Date.now(); for (const [ip, h] of hits) if (now - h.dayStart > 86400000) hits.delete(ip); }, 3600000).unref();

function clientIp(req){
  const fwd = req.headers['x-forwarded-for'];
  return (typeof fwd === 'string' && fwd.split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';
}

// ---------- Helpers ----------
function send(res, status, body, type = 'application/json; charset=utf-8'){
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  });
  res.end(data);
}
function readBody(req){
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY){ reject(new Error('too_large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function callProvider(messages, wantJson, tier){
  const model = tier === 'quick' ? QUICK_MODEL : MODEL;
  const base = { model, messages, max_tokens: MAX_TOKENS };
  if (Number.isFinite(TEMPERATURE)) base.temperature = TEMPERATURE;
  const extras = {};
  if (wantJson && JSON_MODE) extras.response_format = { type: 'json_object' };
  if (REASONING_EFFORT) extras.reasoning_effort = REASONING_EFFORT;

  const attempt = body => fetch(BASE_URL + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000)
  });

  let r = await attempt({ ...base, ...extras });
  // Some providers or models reject optional settings like JSON mode or reasoning_effort.
  // If so, retry once without them.
  if (r.status === 400 && Object.keys(extras).length){
    const detail = await r.text().catch(() => '');
    console.warn('[llm] provider rejected optional settings, retrying without them:', detail.slice(0, 300));
    r = await attempt(base);
  }
  return r;
}

// ---------- Routes ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if ((req.method === 'GET' || req.method === 'HEAD') && (url.pathname === '/' || url.pathname === '/index.html')){
    fs.readFile(INDEX_PATH, (err, buf) => err ? send(res, 500, 'Missing public/index.html', 'text/plain') : send(res, 200, buf, 'text/html; charset=utf-8'));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/health'){
    return send(res, 200, { ai: !!API_KEY, model: API_KEY ? MODEL : '', needsCode: !!ACCESS_CODE });
  }

  if (req.method === 'POST' && url.pathname === '/api/llm'){
    if (!API_KEY) return send(res, 503, { error: 'not_configured', message: 'No LLM_API_KEY set on the server.' });
    if (ACCESS_CODE && req.headers['x-access-code'] !== ACCESS_CODE) return send(res, 401, { error: 'needs_code' });
    if (!allow(clientIp(req))) return send(res, 429, { error: 'rate_limited' });

    let payload;
    try { payload = JSON.parse(await readBody(req)); }
    catch(e){ return send(res, e.message === 'too_large' ? 413 : 400, { error: e.message === 'too_large' ? 'too_large' : 'invalid_request' }); }

    const msgs = Array.isArray(payload.messages) ? payload.messages : [];
    const clean = msgs
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content.slice(0, 60000) }));
    if (!clean.length || clean[clean.length - 1].role !== 'user') return send(res, 400, { error: 'invalid_request' });

    try {
      const r = await callProvider(clean, !!payload.json, payload.tier);
      if (!r.ok){
        const detail = await r.text().catch(() => '');
        console.error('[llm] provider error', r.status, detail.slice(0, 500));
        if (r.status === 429) return send(res, 429, { error: 'rate_limited' });
        if (r.status === 401 || r.status === 403) return send(res, 502, { error: 'bad_key' });
        return send(res, 502, { error: 'upstream_error' });
      }
      const data = await r.json();
      const choice = data.choices && data.choices[0];
      const text = choice && choice.message && typeof choice.message.content === 'string' ? choice.message.content : '';
      if (!text.trim()) return send(res, 502, { error: 'empty_completion' });
      return send(res, 200, { text, truncated: choice.finish_reason === 'length' });
    } catch(e){
      console.error('[llm] request failed:', e && e.message);
      return send(res, 504, { error: 'upstream_error' });
    }
  }

  send(res, 404, 'Not found', 'text/plain');
});

server.listen(PORT, () => {
  console.log(`The Chair is running on http://localhost:${PORT}`);
  console.log(API_KEY ? `AI scenarios: ${MODEL} via ${BASE_URL}` : 'AI scenarios OFF: set LLM_API_KEY to turn them on (built-in library still works).');
  if (ACCESS_CODE) console.log('Access code required for AI features.');
});

// Minimal .env reader so local runs work without extra packages.
function loadDotEnv(file){
  let txt; try { txt = fs.readFileSync(file, 'utf8'); } catch(e){ return; }
  for (const line of txt.split(/\r?\n/)){
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
