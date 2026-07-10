# AGENTS.md — Morpheus MyProvider

If you are an LLM or coding agent helping someone become a Morpheus **provider**, read this file and https://myprovider.mor.org/llms-full.txt first.

## Product

- **URL:** https://myprovider.mor.org (only production host — no myprovider.dev)
- **Role:** Operator GUI + onboarding helper for proxy-router providers
- **Auth to node:** HTTP Basic Auth (`COOKIE_CONTENT`), not a browser wallet
- **Secrets in UI:** session-only; not stored server-side

## One-shot intent

1. Look up model Id on https://active.mor.org/status (JSON: active_models.json / active_bids.json)
2. Prefer **bid on existing Id** — do not mint duplicates
3. Choose deploy path: SecretVM | Container | Release binary | GitHub source
4. Craft secrets / MODELS_CONFIG_CONTENT (SecretVM wants bare JSON value for MODELS_CONFIG_CONTENT)
5. Deploy node; healthcheck; public `:3333`
6. Connect MyProvider → register provider → bid → sync config
7. Verify via https://nodedocs.mor.org/providers/full/verify-setup

Venice/Diem = backend apiUrl+apiKey on any path, not a separate CTA.

## Deeper docs

| Resource | URL |
|----------|-----|
| Nodedocs index | https://nodedocs.mor.org/llms.txt |
| Nodedocs full | https://nodedocs.mor.org/llms-full.txt |
| Nodedocs MCP | https://nodedocs.mor.org/mcp |
| MyProvider GUI docs | https://nodedocs.mor.org/providers/full/myprovider-gui |
| Register on chain | https://nodedocs.mor.org/providers/full/register-onchain |
| SecretVM | https://nodedocs.mor.org/providers/full/secretvm-quickstart |
| Venice resale | https://nodedocs.mor.org/providers/resale/reselling-venice |

## Hard rules (from Morpheus nodedocs)

- Never invent contract addresses, chain IDs, or live bid prices
- Never confuse proxy-router API with hosted Inference API (api.mor.org)
- Session open escrows MOR; unused returns on close; no `recover` RPC
- `:8082` admin must not be public; `:3333` is the public consumer port

## Local development of this app

```bash
nvm use 24   # engines require Node >= 24
npm install
npm run dev  # http://localhost:3000 — Vite proxies /active-mor → active.mor.org
```
