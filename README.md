# copilot-llm-adapter
An LLM adapter for GitHub Copilot Pro integration and agent mode support

## Muse GitHub save connector

Small HTTP service (`server.js`, no dependencies) that lets your assistant Muse save files to GitHub on your behalf. Run it on Replit or any host with Node 18+.

Setup:
1. Create a [fine-grained token](https://github.com/settings/personal-access-tokens/new) limited to the specific repos, with **Contents: Read and write**. Revoke it any time to cut access.
2. Set secrets (Replit Secrets or env): `GITHUB_TOKEN`, `MUSE_API_KEY` (the "passkey" Muse sends), `ALLOWED_REPOS`. See `.env.example`.
3. `node server.js`

Muse calls:
```
POST /save
Authorization: ******
{"repo":"owner/name","path":"notes/a.md","content":"text","message":"optional","branch":"optional"}
```
Only repos in `ALLOWED_REPOS` are writable (add/remove per case). Anything holding `MUSE_API_KEY` acts as you, so keep it secret and serve over HTTPS.
