const test = require('node:test');
const assert = require('node:assert');
process.env.MUSE_API_KEY = 'k'; process.env.ALLOWED_REPOS = 'a/b'; process.env.GITHUB_TOKEN = 't';
const { createServer } = require('../server');
test('auth and allowlist', async () => {
  const s = createServer().listen(0); const p = s.address().port;
  const call = (h, b) => fetch(`http://localhost:${p}/save`, { method: 'POST', headers: h, body: JSON.stringify(b) });
  assert.equal((await call({}, {})).status, 401);
  const h = { Authorization: 'Bearer k' };
  assert.equal((await call(h, { repo: 'x/y', path: 'f', content: 'c' })).status, 403);
  assert.equal((await call(h, { repo: 'a/b', path: '../f', content: 'c' })).status, 400);
  s.close();
});
