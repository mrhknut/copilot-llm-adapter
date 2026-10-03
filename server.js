'use strict';
const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 8787;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const MUSE_API_KEY = process.env.MUSE_API_KEY;
const ALLOWED_REPOS = (process.env.ALLOWED_REPOS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

async function gh(path, opts = {}) {
  return fetch('https://api.github.com' + path, {
    ...opts,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'muse-github-connector',
      'Content-Type': 'application/json',
    },
  });
}

async function save({ repo, path, content, message, branch }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '')) throw Object.assign(new Error('repo must be owner/name'), { status: 400 });
  if (!ALLOWED_REPOS.includes(repo.toLowerCase())) throw Object.assign(new Error('repo not in ALLOWED_REPOS'), { status: 403 });
  if (typeof path !== 'string' || !path || path.startsWith('/') || path.split('/').includes('..')) throw Object.assign(new Error('invalid path'), { status: 400 });
  if (typeof content !== 'string') throw Object.assign(new Error('content must be a string'), { status: 400 });

  const url = `/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
  const q = branch ? `?ref=${encodeURIComponent(branch)}` : '';
  let sha;
  const existing = await gh(url + q);
  if (existing.ok) sha = (await existing.json()).sha;
  else if (existing.status !== 404) throw Object.assign(new Error('GitHub lookup failed: ' + existing.status), { status: 502 });

  const body = { message: message || `Save ${path} via Muse`, content: Buffer.from(content, 'utf8').toString('base64') };
  if (sha) body.sha = sha;
  if (branch) body.branch = branch;
  const res = await gh(url, { method: 'PUT', body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || 'GitHub save failed'), { status: 502 });
  return { ok: true, commit: data.commit.sha, url: data.content.html_url };
}

function createServer() {
  return http.createServer((req, res) => {
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true });
    if (req.method !== 'POST' || req.url !== '/save') return send(404, { error: 'not found' });
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ') || !safeEqual(auth.slice(7), MUSE_API_KEY)) return send(401, { error: 'unauthorized' });
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on('end', async () => {
      try {
        send(200, await save(JSON.parse(raw)));
      } catch (e) {
        send(e instanceof SyntaxError ? 400 : e.status || 500, { error: e.message });
      }
    });
  });
}

if (require.main === module) {
  if (!GITHUB_TOKEN || !MUSE_API_KEY || !ALLOWED_REPOS.length) {
    console.error('Set GITHUB_TOKEN, MUSE_API_KEY and ALLOWED_REPOS (see .env.example)');
    process.exit(1);
  }
  createServer().listen(PORT, () => console.log(`Muse GitHub connector on :${PORT}`));
}

module.exports = { createServer };
